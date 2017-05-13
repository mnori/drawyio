// Holds the code for rendering drawings using coordinate data
// This is the new version that uses WebGL (via pixijs wrapper library)

function DrawUI(roomUI) {
	var self = this;

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
		document.body.appendChild(this.renderer.view);
		$(this.renderer.view).attr("id", targetID);
		this.layer = new Layer(this);

		// bind sprites to container
		self.container.addChild(this.layer.renderSprite);
		self.container.addChild(this.layer.stroke.renderSprite);

	}

	this.plotLine = function(x0, y0, x1, y1) {
		this.layer.stroke.plotLine(x0, y0, x1, y1);
	}

	this.startStroke = function(toolIn) {
		this.layer.stroke.startStroke(toolIn);
	}

	this.endStroke = function(toolIn) {
		this.layer.stroke.endStroke();
	}

	this.startBatch = function() {
		this.layer.stroke.startBatch();
	}

	// Render the main container
	this.render = function() {
		// Render stroke data onto its sprite
		self.layer.stroke.render();

		// Remember that layer data is only rendered onto its sprite when stroke 
		// is finished

		// we're clearing before render, so it's set true here.
		this.renderer.render(self.container, null, true);
	}
	this.init();
}

// Represents a layer which is linked to a particular user/socket
// Consists of a render texture which has various Strokes superimposed over the top of it
// In future, will add other types of drawing element
function Layer(drawUI) {
	var self = this;

	this.init = function() {
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

	this.init = function() {
		self.graphics = new PIXI.Graphics();
		self.container = new PIXI.Container();
		// self.container.addChild(self.graphics);

		createRenderSprite(self);
	}

	// Might need a destroy method as well

	this.startStroke = function(toolIn) {
		// Create circle sprite texture - faster than drawing
		// Shoudl actually be at the beginning of the stroke along with the tool settings

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
		// Render stroke stuff onto the render texture
		self.container.addChild(self.graphics);
		self.layer.drawUI.renderer.render(self.container, self.renderTexture);

		// clear for next iteration
		self.container.removeChildren();
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