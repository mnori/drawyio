// Holds the code for rendering drawings using coordinate data
// This is the new version that uses WebGL (via pixijs wrapper library)

function DrawUI(roomUI) {
	var self = this;

	this.roomUI = roomUI;

	// set up the main container
	this.graphics = new PIXI.Graphics();
	this.container = new PIXI.Container();
	this.container.addChild(self.graphics)

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
	this.plotLine = function(x0, y0, x1, y1) {
		this.layer.stroke.plotLine(x0, y0, x1, y1);
	}

	this.start = function(toolIn) {
		this.layer.stroke.start(toolIn);
	}

	// Render the main container
	this.render = function() {
		// Render stroke data onto its sprite
		self.layer.stroke.render();

		// we're clearing before render, so it's set true here.
		this.renderer.render(self.container, null, true);
	}
}

// Represents a layer which is linked to a particular user/socket
// Consists of a render texture which 
function Layer(drawUI) {
	var self = this;
	this.drawUI = drawUI;
	this.stroke = new Stroke(this);

	this.init = function() {
		createRenderSprite(self);
	}
	// this.finishStroke = function() {
	// 	this.stroke.
	// }
}

// Represents a single stroke drawing
function Stroke(layer) {
	var self = this;
	this.layer = layer;
	this.tool = null;

	var colour = 0xff0000;

	this.init = function() {
		createRenderSprite(self);

		// Bind the sprite onto the main container
	 	self.layer.drawUI.container.addChild(self.renderSprite);
	}

	// Might need a destroy method as well

	this.plotLine = function(x0, y0, x1, y1) {
		var width = self.tool.meta.brushSize;
		self.graphics.beginFill(colour, 1);
		self.graphics.lineStyle(width, colour, 1);
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

	// this is not necessarily the beginning! It can also be in between batches
	// of data
	this.start = function(toolIn) {
		self.tool = toolIn;
		self.width = self.tool.meta.brushSize;
		self.radius = parseInt(self.tool.meta.brushSize / 2);

		console.log(self.tool.meta.brushSize);

		// Create circle sprite texture - faster than drawing
		self.createCircleSprite(colour);

		// Removes all the line elements that got drawn previously
		self.graphics.clear(); 
	}

	this.createCircleSprite = function(colour) {
		var width = self.tool.meta.brushSize;

		// Render a circle into the circle graphics element
		var circleGraphics = new PIXI.Graphics();
		circleGraphics.beginFill(colour, 1);
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
	self.graphics = new PIXI.Graphics();
	self.container = new PIXI.Container();
	self.container.addChild(self.graphics)

	// Create render texture for drawing onto
	var brt = new PIXI.BaseRenderTexture(
		self.layer.drawUI.roomUI.width, 
		self.layer.drawUI.roomUI.height, 
		PIXI.SCALE_MODES.LINEAR, 1);
	self.renderTexture = new PIXI.RenderTexture(brt);

	// Create sprite from render texture
	self.renderSprite = new PIXI.Sprite(self.renderTexture)
}
		