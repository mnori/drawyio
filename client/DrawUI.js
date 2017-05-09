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
	this.plotLine = function(toolIn, x0, y0, x1, y1) {
		this.layer.plotLine(toolIn, x0, y0, x1, y1);
	}

	this.start = function() {
		this.layer.start();
	}

	this.render = function() {
		this.layer.render();

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

	this.plotLine = function(toolIn, x0, y0, x1, y1) {
		this.stroke.plotLine(toolIn, x0, y0, x1, y1);
	}

	this.start = function() {
		this.stroke.start();
	}

	this.render = function() {
		this.stroke.render();
	}

}

// Represents a single stroke drawing
function Stroke(layer) {
	var self = this;
	this.layer = layer;

	// TODO read from tool
	var width = 45;
	var radius = parseInt(width / 2);
	var colour = 0xff0000;
	var alpha = 0.2;

	this.init = function() {
		// Bind graphics to container
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

		// Bind the sprite onto the main container
	 	self.layer.drawUI.container.addChild(self.renderSprite);

		// Create circle texture
		self.createCircleSprite(colour, radius);
	}

	// Might need a destroy method as well

	this.plotLine = function(toolIn, x0, y0, x1, y1) {
		self.graphics.beginFill(colour, 1);
		self.graphics.lineStyle(width, colour, 1);
	    self.graphics.moveTo(x0, y0); 
	    self.graphics.lineTo(x1, y1);
	    self.graphics.endFill();

	 	self.placeCircleSprite(x0, y0, radius);
	 	self.placeCircleSprite(x1, y1, radius);
	}

	this.placeCircleSprite = function(x, y, radius) {
		var circleSprite = new PIXI.Sprite(self.circleTexture)
	 	circleSprite.x = x - (radius);
	 	circleSprite.y = y - (radius);
	 	self.container.addChild(circleSprite);
	}

	this.render = function() {
		// Render stroke stuff onto the render texture
		self.layer.drawUI.renderer.render(self.container, self.renderTexture);

		// Remove sprites from container
		// Otherwise the container fills with old sprites
		self.container.removeChildren();
		self.container.addChild(self.graphics);
		self.renderSprite.alpha = alpha;
	}

	// this is not necessarily the beginning! It can also be in between batches
	// of data
	this.start = function() {
		self.graphics.clear();
	}

	this.createCircleSprite = function(colour, radius) {	
		// Render a circle into the circle graphics element
		var circleGraphics = new PIXI.Graphics();
		circleGraphics.beginFill(colour, 1);
		circleGraphics.lineStyle(0);
		circleGraphics.drawCircle(radius, radius, radius);
		circleGraphics.endFill();

		// Create a sprite from the graphics
		var brt = new PIXI.BaseRenderTexture(width, width, PIXI.SCALE_MODES.LINEAR, 1);
		self.circleTexture = new PIXI.RenderTexture(brt);
		self.layer.drawUI.renderer.render(circleGraphics, self.circleTexture);
	}

	self.init();
}