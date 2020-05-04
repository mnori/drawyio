// Holds the code for rendering drawings using coordinate data
// This is the new version that uses WebGL (via pixijs wrapper library)
// It's supposed to be a replacement for various parts of RoomUI.js
// All PIXI.* library calls go here.

function DrawUI(roomUI) {
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
		this.localID = null;
		self.localLayer = null;

		// This is for cropping images and sending to the server
		self.stagingContainer = new PIXI.Container();
	}

	this.createRenderers = function() {
		// Setup main renderer, all the parameters are in an options object passed as 1st parameter
		self.renderer = new PIXI.WebGLRenderer({
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
	this.newLocal = function(layerID) {
		var oldLayer = null;
		if (self.localLayer) {
			self.localLayer.local = false;
			oldLayer = self.localLayer;
		}
		self.localID = layerID;
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

	this.plotLine = function(layerID, x0, y0, x1, y1) {
		self.getLayer(layerID).stroke.plotLine(x0, y0, x1, y1);
	}

	this.startStroke = function(layerID, toolIn) {
		self.getLayer(layerID).stroke.startStroke(toolIn);
	}

	this.endStroke = function(layerID, toolIn) {
		self.getLayer(layerID).stroke.endStroke();
	}

	// happens when new layer data comes from the server - ditch the old layers
	this.destroyLayer = function(layerID) {
		var layer = self.getLayer(layerID); // can get image layers as well
		if (layer) {
			layer.destroy();
			self.layers.remove(layerID);
		}
		var imageLayer = self.getImageLayer(layerID);
		if (imageLayer) {
			imageLayer.destroy();
			self.imageLayers.remove(layerID);
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
	this.getLayer = function(layerID) {
		layer = self.layers.get(layerID);
		if (!layer) {
			var local = (layerID == self.localID) ? true : false; 
			layer = new Layer(self, layerID, local);
			self.layers.set(layerID, layer);
			if (local) {
				self.localLayer = layer;
			}
		}
		return layer;
	}

	this.getImageLayer = function(layerID) {
		var layer = self.imageLayers.get(layerID);
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

function ImageLayer(drawUI, layerData) {
	var self = this;
	this.init = function() {
		self.type = "ImageLayer";
		self.id = layerData.code;
		self.order = drawUI.getNLayers();
		self.drawUI = drawUI;
		self.createSprite(layerData.base64);
	}
	this.createSprite = function(base64) {
		// this seems to have some async problems
		self.sprite = PIXI.Sprite.fromImage(base64);
		self.sprite.texture.on('update', function() {

			// render every time a layer loads
			self.drawUI.render();
	    });
	}
	this.destroy = function() {
		self.sprite.destroy(true);
	}

	this.bindSprite = function() {
		self.drawUI.container.addChild(self.sprite);
	}
	this.init();
}

// Represents a layer which is linked to a particular user/socket
// Consists of a render texture which has various Strokes superimposed over the top of it
// In future, will add other types of drawing element
function Layer(drawUI, layerID, local) {
	var self = this;
	this.init = function() {
		self.type = "Layer";
		self.id = layerID;
		self.order = drawUI.getNLayers();
		self.drawUI = drawUI;
		self.stroke = new Stroke(this);
		self.container = new PIXI.Container();
		self.local = local ? local : false; // whether currently the local target
		self.createdLocal = self.local; // debugging
		createRenderSprite(self);
	}

	this.bindSprite = function() {
		if (self.local) {
			// if local, it's handled by drawUI
			return;
		}
		self.drawUI.container.addChild(self.renderSprite);
		self.drawUI.container.addChild(self.stroke.renderSprite); // might add twice!
	}

	// Renders finished Stroke render texture to the layer's render texture.
	// Only called after a stroke is completed. Not called between frames.
	this.renderStroke = function() {
		// Attach the stroke sprite to the layer container
		self.container.addChild(self.stroke.renderSprite); 

		// Render layer container onto layer render texture
		self.drawUI.renderer.render(self.container, self.renderTexture);

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
	this.drawUI = this.layer.drawUI;
	this.tool = null;
	this.stroking = false;

	// Initialise the stroke
	this.init = function() {
		self.graphics = new PIXI.Graphics();
		self.container = new PIXI.Container();
		createRenderSprite(self);
	}

	// Reset the stroke, this is more efficient than destroy() as we don't start from scratch
	this.reset = function() {
		// Remove our circle sprite elements from the stroke container
		self.container.removeChildren(); 

		// Remove circles from renderTexture by passing the cleared container, true means clear
		self.drawUI.renderer.render(self.container, self.renderTexture, true);

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
		self.colour = rgbaToHex(self.tool.colour);
		self.renderSprite.alpha = rgbaToAlpha(self.tool.colour);
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
		self.layer.drawUI.renderer.render(self.container, self.renderTexture);

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
		self.layer.drawUI.renderer.render(circleGraphics, self.circleTexture);
	}

	self.init();
}

// Generic RenderTexture and Sprite creation
function createRenderSprite(self) {

	// Create render texture for drawing onto
	var brt = new PIXI.BaseRenderTexture(
		self.drawUI.roomUI.width, 
		self.drawUI.roomUI.height, 
		PIXI.SCALE_MODES.LINEAR, 1);
	self.renderTexture = new PIXI.RenderTexture(brt);

	// Create sprite from render texture
	self.renderSprite = new PIXI.Sprite(self.renderTexture)
}

// Extract alpha value from rgba() string
function rgbaToAlpha(strIn) {
	if (strIn.search("rgba") == -1) { // no alpha
		return 1;
	}

	// fetch the alpha value from the string
	var strBit = strIn.split(",").pop().slice(0, -1);
	var floatOut = parseFloat(strBit);
	return floatOut; // return it

}

// Extract hex colour code string from rgba() string
function rgbaToHex(rgba) {
    var parts = rgba.substring(rgba.indexOf("(")).split(","),
        r = parseInt(rgbaTrim(parts[0].substring(1)), 10),
        g = parseInt(rgbaTrim(parts[1]), 10),
        b = parseInt(rgbaTrim(parts[2]), 10);
        // a = parseFloat(rgbaTrim(parts[3].substring(0, parts[3].length - 1))).toFixed(2);

    var str = "0x" + extractHex(r) + extractHex(g) + extractHex(b);
    return parseInt(str);
}

function extractHex(intVal) {
	var str = intVal.toString(16);
	if (str.length == 1) {
		str = "0"+str;
	}
	return str;
}

function rgbaTrim(str) {
  return str.replace(/^\s+|\s+$/gm,'');
}