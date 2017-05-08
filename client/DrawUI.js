// Holds the code for rendering drawings using coordinate data
// This is the new version that uses WebGL (pixijs)

function DrawUI(roomUI) {
	console.log("DrawUI() invoked");
	var self = this;

	this.roomUI = roomUI;

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

	// Create pixi app object, should only be called once
	// this.app = new PIXI.Application(this.roomUI.width, this.roomUI.height, { 
	// 	"antialias": false,
	// 	"transparent": true
	// });

	// Create the element to render into
	// var targetID = "renderer";
	// document.body.appendChild(this.app.view);
	// $(this.app.view).attr("id", targetID);

	var width = 45;
	var radius = parseInt(width / 2);
	var colour = 0xff0000;
	var alpha = 0.2;

	this.plotLine = function(ctx, toolIn, x0, y0, x1, y1) {
		ctx.graphics.beginFill(colour, 1);
		ctx.graphics.lineStyle(width, colour, 1);
	    ctx.graphics.moveTo(x0, y0); 
	    ctx.graphics.lineTo(x1, y1);
	    ctx.graphics.endFill();

	 	self.placeCircleSprite(ctx, x0, y0, radius);
	 	self.placeCircleSprite(ctx, x1, y1, radius);
	}

	this.placeCircleSprite = function(ctx, x, y, radius) {
		var circleSprite = new PIXI.Sprite(ctx.renderTexture)
	 	circleSprite.x = x - (radius);
	 	circleSprite.y = y - (radius);
	 	ctx.container.addChild(circleSprite);
	}

	this.render = function(ctx) {
		// Render the container
		this.renderer.render(ctx.container);

		// Remove sprites from container
		ctx.container.removeChildren();
		ctx.container.addChild(ctx.graphics);
	}

	this.start = function(ctx) {
		if (typeof(ctx.renderElement) === "undefined") {
			console.log("Initialisation");

			// Bind render element to context (might want to use container instead)
			ctx.renderElement = this.renderer.view;

			// Bind graphics to container
			ctx.graphics = new PIXI.Graphics();
			ctx.container = new PIXI.Container();
			ctx.container.addChild(ctx.graphics)

			// set up colour matrix
			// ctx.colourMatrix = new PIXI.filters.ColorMatrixFilter();
			// ctx.container.filters = [ctx.colourMatrix];

			// CIRCLE SETUP
			this.setupCircle(ctx, colour, radius);

			// Bind the container to the stage
			// this.renderer.stage.addChild(ctx.container);
		}
		ctx.graphics.clear();
	}

	this.setupCircle = function(ctx, colour, radius) {	
		// Render a circle into the circle graphics element
		ctx.circleGraphics = new PIXI.Graphics();
		ctx.circleGraphics.beginFill(colour, 1);
		ctx.circleGraphics.lineStyle(0);
		ctx.circleGraphics.drawCircle(radius, radius, radius);
		ctx.circleGraphics.endFill();

		// Create a sprite from the graphics
		var brt = new PIXI.BaseRenderTexture(width, width, PIXI.SCALE_MODES.LINEAR, 1);
		ctx.renderTexture = new PIXI.RenderTexture(brt);
		this.renderer.render(ctx.circleGraphics, ctx.renderTexture);
	}
}