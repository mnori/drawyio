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