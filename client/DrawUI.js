// Holds the code for rendering drawings using coordinate data
// This is the new version that uses WebGL (via pixijs wrapper library)
// It's supposed to be a replacement for various parts of RoomUI.js

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
		// Setup main renderer
		self.renderer = new PIXI.WebGLRenderer(this.roomUI.width, this.roomUI.height, {
			"antialias": true,
			"transparent": true,
			"clearBeforeRender": false,
			"preserveDrawingBuffer": true
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

	this.startBatch = function(layerID) {
		self.getLayer(layerID).stroke.startBatch();
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
		var tl = new Timeline();
		
		tl.log("1");
		// Empty the container
		self.container.removeChildren();

		tl.log("2");

		// Render stroke data onto each sprite
		self.renderStrokes();

		tl.log("3");

		// Bind the layer sets
		self.bindSorted(self.imageLayers);
		self.bindSorted(self.layers);

		tl.log("4");
		
		// Add the local layer last, so user's strokes always appear on top
		if (self.localLayer) {
			self.container.addChild(self.localLayer.renderSprite)
			self.container.addChild(self.localLayer.stroke.renderSprite);
		}
		
		tl.log("5");

		// true means we're clearing before render
		// - must specify since we set clear to false in the initialiser
		
		self.renderer.render(self.container, null, true);
		tl.log("6");
		// tl.dump();
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
			// console.log(layer.type+" "+layer.id+" "+layer.order);
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
		// console.log("Remember to destroy imageLayer! "+self.id);
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
		console.log("Layer.init()")
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
		console.log("Layer.bindSprite()")
		if (self.local) {
			return;
		}
		self.drawUI.container.addChild(self.renderSprite);
		self.drawUI.container.addChild(self.stroke.renderSprite); // might add twice!
	}

	// Renders finished Stroke render texture to the layer's render texture
	this.renderStroke = function() {
		console.log("Layer.renderStroke()")
		// Move the stroke sprite to the layer container
		self.container.addChild(self.stroke.renderSprite); 

		// render
		self.drawUI.renderer.render(self.container, self.renderTexture);

		// Remove the stroke components from the container (circle sprites and line shapes)
		self.container.removeChildren();

		// Clear the stroke render texture for the next iteration
		// console.log(self.drawUI.renderer);

		// this call does clear, but it also causes issues, we need to clear the SPRITE's 
		// render teture, not the layer's!
		// self.drawUI.renderer.render(self.container, self.renderTexture, true)

		// self.drawUI.renderer.clearRenderTexture(self.stroke.renderTexture, 0x00000000);
		// self.renderTexture.clear();

		// Clear stroke render texture (self.container probably not the best thing to pass in)
		// self.drawUI.renderer.render(self.container, self.stroke.renderTexture, true)
		self.stroke.renderTexture.destroy(true); 
		createRenderSprite(self.stroke)

		// Put the stroke render sprite back in the main container
		self.drawUI.container.addChild(self.stroke.renderSprite);

	}

	this.destroy = function() {
		console.log("Layer.destroy()")
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

	this.init = function() {
		console.log("Stroke.init()");
		self.graphics = new PIXI.Graphics();
		self.container = new PIXI.Container();
		createRenderSprite(self);
	}

	this.destroy = function() { 
		console.log("Stroke.destroy()");
		self.renderTexture.destroy(true); 
	}

	// Might need a destroy method as well

	this.startStroke = function(toolIn) {
		console.log("Stroke.startStroke()");
		self.tool = toolIn;
		self.width = self.tool.meta.brushSize;
		self.radius = parseInt(self.tool.meta.brushSize / 2);
		self.colour = rgbaToHex(self.tool.colour);
		self.renderSprite.alpha = rgbaToAlpha(self.tool.colour);
		self.createCircleSprite();
	}

	// Render the stroke data onto the layer render sprite
	this.endStroke = function(toolIn) { 
		console.log("Stroke.endStroke()");
		self.layer.renderStroke(toolIn); 
	}

	// Render part of a stroke in a single batch
	this.startBatch = function(toolIn) {
		console.log("Stroke.startBatch()");
		self.toolIn = toolIn;

		// Removes all the line elements that got drawn previously
		// We should not actually do this, since it leads to bits of the drawing disappearing
		// self.graphics.clear(); 
	}

	this.plotLine = function(x0, y0, x1, y1) {
		console.log("Stroke.plotLine()");
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
		console.log("Stroke.placeCircleSprite("+x+", "+y+")");
		var circleSprite = new PIXI.Sprite(self.circleTexture)
	 	circleSprite.x = x - (self.radius);
	 	circleSprite.y = y - (self.radius);
	 	self.container.addChild(circleSprite);
	}

	this.render = function() {
		console.log("Stroke.render()");
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
		console.log("Stroke.createCircleSprite()");
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
    // console.log(rgba);
    // console.log(str);
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