// Holds the code for rendering drawings using coordinate data
// This is the new version that uses WebGL (via pixijs wrapper library)
// It's supposed to be a replacement for various parts of RoomUI.js
// All PIXI.* library calls go here.

function DrawUi(roomUI) {
	var self = this;

	// set up the main container
	this.init = function() {
		// Define some vars
		this.n = 0;
		this.roomUI = roomUI;
		this.container = new PIXI.Container();
		this.createRenderers();

		// Set up layer storage
		self.layers = new AssocArray();
		self.imageLayers = new AssocArray();
		this.localId = null;
		self.localLayer = null;
		self.utils = new DrawUtils(self);

		// This is for cropping images and sending to the server
		self.stagingContainer = new PIXI.Container();
	}

	this.createRenderers = function() {
		// Setup main renderer, all the parameters are in an options object passed as 1st parameter
		self.renderer = new PIXI.Renderer({
			"width": this.roomUI.width,
			"height": this.roomUI.height,
			"antialias": true,
			"transparent": true,
			"clearBeforeRender": false, // needed for overlay rendering
			"preserveDrawingBuffer": true // as above
		});

		var view = $(self.renderer.view);
		$("#drawing_layers").append(view);
		view.attr("id", "renderer");
	}

	// Create new local layer, setting the old one to being a normal layer
	// Returns canvas of the old layer
	this.newLocal = function(layerId) {
		var oldLayer = null;
		if (self.localLayer) {
			self.localLayer.local = false;
			oldLayer = self.localLayer;
		}
		self.localId = layerId;
		self.localLayer = null; // will get created automatically when drawing begins

		// now we generate a png image from the old local
		if (oldLayer) {
			return self.getLocalPixels(oldLayer);
		}
		return null;
	}

	this.getLocalPixels = function(oldLayer) {
		// Extract pixels from render sprite
		self.stagingContainer.removeChildren();
		self.stagingContainer.addChild(oldLayer.renderSprite);
		var canvas = self.renderer.extract.canvas(self.stagingContainer);
		// $("#drawing_layers").append(self.renderer.extract.image(self.stagingContainer));
		return canvas;		
	}

	this.getNLayers = function() {
		return ++this.n;
	}

	this.plotLine = function(layerId, x0, y0, x1, y1) {
		self.getLayer(layerId).stroke.plotLine(x0, y0, x1, y1);
	}

	this.startStroke = function(layerId, toolIn) {
		self.getLayer(layerId).stroke.startStroke(toolIn);
	}

	this.endStroke = function(layerId, toolIn) {
		self.getLayer(layerId).stroke.endStroke();
	}

	// happens when new layer data comes from the server - ditch the old layers
	this.destroyLayer = function(layerId) {
		var layer = self.getLayer(layerId); // can get image layers as well
		if (layer) {
			layer.destroy();
			self.layers.remove(layerId);
		}
		var imageLayer = self.getImageLayer(layerId);
		if (imageLayer) {
			imageLayer.destroy();
			self.imageLayers.remove(layerId);
		}
	}

	// Render the main container
	// Should only be called once per frame - WIP
	this.render = function() {
		// Empty the container
		self.container.removeChildren();

		// Render stroke data onto each sprite
		self.renderStrokes();

		// Bind the layer sets
		self.bindSorted(self.imageLayers);
		self.bindSorted(self.layers);

		// Add the local layer last, so user's strokes always appear on top
		if (self.localLayer) {
			self.container.addChild(self.localLayer.renderSprite)
			self.container.addChild(self.localLayer.stroke.renderSprite);
		}
		
		// true means we're clearing before render
		self.renderer.render(self.container, null, true);
	}

	// Render Helper method
	// Sort the layers, most recent at the bottom - these will render on top
	// Bind sprites to container
	this.bindSorted = function(layers) {
		var entries = layers.getValues();
		entries.sort(function(a, b) {
			if (a.order < b.order) {
				return -1;
			}
			if (a.order > b.order) {
				return 1;
			}
			return 0;
		});
		// Add layers to container in the correct order
		for (var i = 0; i < entries.length; i++) {
			var layer = entries[i];
			layer.bindSprite();
		}
	}

	this.renderStrokes = function() {
		var entries = self.layers.getValues();
		for (var i = 0; i < entries.length; i++) {
			var layer = entries[i];
			layer.stroke.render(); // won't render unless active
		}
	}

	// Get a layer by its layer code.
	// Generates a new layer if it doesn't exist.
	this.getLayer = function(layerId) {
		layer = self.layers.get(layerId);
		if (!layer) {
			var local = (layerId == self.localId) ? true : false; 
			layer = new Layer(self, layerId, local);
			self.layers.set(layerId, layer);
			if (local) {
				self.localLayer = layer;
			}
		}
		return layer;
	}

	this.getImageLayer = function(layerId) {
		var layer = self.imageLayers.get(layerId);
		if (layer) {
			return layer;
		}
		return null;
	}

	this.addImageLayer = function(layerData) {
		var newLayer = new ImageLayer(self, layerData);
		self.imageLayers.set(layerData.code, newLayer);
	}

	this.init();
}

function ImageLayer(drawUi, layerData) {
	var self = this;
	this.init = function() {
		self.type = "ImageLayer";
		self.id = layerData.code;
		self.order = drawUi.getNLayers();
		self.drawUi = drawUi;
		self.createSprite(layerData);
	}
	this.createSprite = function(layerData) {
		self.sprite = PIXI.Sprite.from(layerData.base64);
		self.sprite.x = layerData.offsets.left;
		self.sprite.y = layerData.offsets.top;
		self.sprite.texture.on('update', function() { // render every time a layer loads
			self.drawUi.render();
	    });
	}
	this.destroy = function() {
		self.sprite.destroy(true);
	}

	this.bindSprite = function() {
		self.drawUi.container.addChild(self.sprite);
	}
	this.init();
}

// Represents a layer which is linked to a particular user/socket
// Consists of a render texture which has various Strokes superimposed over the top of it
// In future, will add other types of drawing element
function Layer(drawUi, layerId, local) {
	var self = this;
	this.init = function() {
		self.type = "Layer";
		self.id = layerId;
		self.order = drawUi.getNLayers();
		self.drawUi = drawUi;
		self.stroke = new Stroke(this);
		self.container = new PIXI.Container();
		self.local = local ? local : false; // whether currently the local target
		self.createdLocal = self.local; // debugging		
		self.drawUi.utils.createRenderSprite(self);
	}

	this.bindSprite = function() {
		if (self.local) {
			// if local, it's handled by drawUi
			return;
		}
		self.drawUi.container.addChild(self.renderSprite);
		self.drawUi.container.addChild(self.stroke.renderSprite); // might add twice!
	}

	// Renders finished Stroke render texture to the layer's render texture.
	// Only called after a stroke is completed. Not called between frames.
	this.renderStroke = function() {
		// Attach the stroke sprite to the layer container
		self.container.addChild(self.stroke.renderSprite); 

		// Render layer container onto layer render texture
		self.drawUi.renderer.render(self.container, self.renderTexture);

		// Remove stroke sprite from the layer container, since we just rendered it
		self.container.removeChildren();

		self.stroke.reset();
	}

	this.destroy = function() {
		// need to delete all the render stuff properly, otherwise memory will leak
		self.stroke.destroy();
		self.renderTexture.destroy(true);
	}

	self.init();
}

// Represents a single stroke drawing
function Stroke(layer) {
	var self = this;
	this.layer = layer;
	this.drawUi = this.layer.drawUi;
	this.tool = null;
	this.stroking = false;

	// Initialise the stroke
	this.init = function() {
		self.graphics = new PIXI.Graphics();
		self.container = new PIXI.Container();
		self.drawUi.utils.createRenderSprite(self);
	}

	// Reset the stroke, this is more efficient than destroy() as we don't start from scratch
	this.reset = function() {
		// Remove our circle sprite elements from the stroke container
		self.container.removeChildren(); 

		// Remove circles from renderTexture by passing the cleared container, true means clear
		self.drawUi.renderer.render(self.container, self.renderTexture, true);

		// Clear out line elements, attached to a graphics object
		self.graphics.clear(); 
	}

	// Get rid of our render texture
	this.destroy = function() { 
		self.renderTexture.destroy(true); 
	}

	this.startStroke = function(toolIn) {
		self.tool = toolIn;
		self.width = self.tool.meta.brushSize;
		self.radius = parseInt(self.tool.meta.brushSize / 2);
		self.colour = self.drawUi.utils.rgbaToHex(self.tool.colour);
		self.renderSprite.alpha = self.drawUi.utils.rgbaToAlpha(self.tool.colour);
		self.createCircleSprite();
	}

	// Render the stroke data onto the layer render sprite
	this.endStroke = function(toolIn) { 
		self.layer.renderStroke(toolIn); 
	}

	this.plotLine = function(x0, y0, x1, y1) {
		self.stroking = true;
		self.graphics.beginFill(self.colour, 1);
		self.graphics.lineStyle(self.tool.meta.brushSize, self.colour, 1);
	    self.graphics.moveTo(x0, y0); 
	    self.graphics.lineTo(x1, y1);
	    self.graphics.endFill();

	 	self.placeCircleSprite(x0, y0, self.radius);
	 	self.placeCircleSprite(x1, y1, self.radius);
	}

	this.placeCircleSprite = function(x, y, radius) {
		var circleSprite = new PIXI.Sprite(self.circleTexture)
	 	circleSprite.x = x - (self.radius);
	 	circleSprite.y = y - (self.radius);
	 	self.container.addChild(circleSprite);
	}

	this.render = function() {
		if (!self.stroking) { // don't render if there is nothing to do
			return;
		}
		// Render stroke stuff onto the render texture
		self.container.addChild(self.graphics);
		self.layer.drawUi.renderer.render(self.container, self.renderTexture);

		// clear for next iteration. 
		// We shouldn't do this here, because it removves the circle textures....
		// self.container.removeChildren(); // <-- TODO, remove this and the comment 
		// above when confirmed working!
		self.stroking = false;
	}

	this.createCircleSprite = function() {
		var width = self.tool.meta.brushSize;

		// Render a circle into the circle graphics element
		var circleGraphics = new PIXI.Graphics();
		circleGraphics.beginFill(self.colour, 1);
		circleGraphics.lineStyle(0);
		circleGraphics.drawCircle(self.radius, self.radius, self.radius);
		circleGraphics.endFill();

		// Create a sprite from the graphics
		var brt = new PIXI.BaseRenderTexture(width, width, PIXI.SCALE_MODES.LINEAR, 1);
		self.circleTexture = new PIXI.RenderTexture(brt);
		self.layer.drawUi.renderer.render(circleGraphics, self.circleTexture);
	}

	self.init();
}

