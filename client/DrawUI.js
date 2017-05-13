// Holds the code for rendering drawings using coordinate data
// This is the new version that uses WebGL (via pixijs wrapper library)

function DrawUI(roomUI) {
	var self = this;

	this.n = 0;
	this.roomUI = roomUI;

	// set up the main container
	this.init = function() {
		this.container = new PIXI.Container();

		// Setup renderer
		var targetID = "renderer";
		this.renderer = PIXI.autoDetectRenderer(this.roomUI.width, this.roomUI.height, {
			"antialias": false,
			"transparent": true,
			"clearBeforeRender": false,
			"preserveDrawingBuffer": true
		});
		document.body.appendChild(self.renderer.view);
		$(this.renderer.view).attr("id", targetID);

		// there is always a local layer
		self.layers = new AssocArray();
		self.layers.set("local", new Layer(self));
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

	// Gets all the ducks in a row
	this.bindSprites = function() {

		// Empty the container
		self.container.removeChildren();		

		// Sort the layers, most recent at the bottom - these will render on top
		var entries = self.layers.getValues();
		entries.sort(function(a, b) {
			if (b.order < a.order) {
				return -1;
			}
			if (b.order > a.order) {
				return 1;
			}
			return 0;
		});

		// Add layers to container in the correct order
		for (var i = 0; i < entries.length; i++) {
			var layer = entries[i];
			self.container.addChild(layer.renderSprite);
			self.container.addChild(layer.stroke.renderSprite);	
		}
	}

	// Render the main container
	// Should only be called once per frame - WIP
	this.render = function() {
		// Render stroke data onto each sprite
		self.renderStrokes();

		// Attach the sprites to the main container
		self.bindSprites();

		// true means we're clearing before render
		self.renderer.render(self.container, null, true);
	}

	this.renderStrokes = function() {
		var entries = self.layers.getValues();
		for (var i = 0; i < entries.length; i++) {
			var layer = entries[i];
			layer.stroke.render(); // won't render unless active
		}
	}

	this.getLayer = function(layerID) {
		var layer = self.layers.get(layerID);
		if (!layer) {
			layer = new Layer(self);
			self.layers.set(layerID, layer);
		}
		return layer;
	}

	this.init();
}

// Represents a layer which is linked to a particular user/socket
// Consists of a render texture which has various Strokes superimposed over the top of it
// In future, will add other types of drawing element
function Layer(drawUI) {
	var self = this;
	this.init = function() {
		self.order = drawUI.getNLayers();
		self.drawUI = drawUI;
		self.stroke = new Stroke(this);
		self.container = new PIXI.Container();
		
		createRenderSprite(self);
	}

	this.renderStroke = function() {
		// Move the stroke sprite to the layer container
		self.container.addChild(self.stroke.renderSprite); 

		// render
		self.drawUI.renderer.render(self.container, self.renderTexture);

		// cleanup
		self.container.removeChildren();	
		self.drawUI.renderer.clearRenderTexture(self.stroke.renderTexture, 0x00000000);

		// Put the stroke render sprite back in the main container
		self.drawUI.container.addChild(self.stroke.renderSprite);
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
		self.graphics = new PIXI.Graphics();
		self.container = new PIXI.Container();
		createRenderSprite(self);
	}

	// Might need a destroy method as well

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

	// Render part of a stroke in a single batch
	this.startBatch = function(toolIn) {
		self.toolIn = toolIn;

		// Removes all the line elements that got drawn previously
		self.graphics.clear(); 
	}

	this.plotLine = function(x0, y0, x1, y1) {
		self.stroking = true;
		var width = self.tool.meta.brushSize;
		self.graphics.beginFill(self.colour, 1);
		self.graphics.lineStyle(width, self.colour, 1);
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

		// clear for next iteration
		self.container.removeChildren();
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

// Generic render sprite creation
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

    var str = "0x" + r.toString(16) + g.toString(16) + b.toString(16);
    return parseInt(str);
}

function rgbaTrim(str) {
  return str.replace(/^\s+|\s+$/gm,'');
}