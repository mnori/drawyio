// Holds the code for rendering drawings using coordinate data
// This is the new version that uses WebGL (pixijs)

function DrawUI(roomUI) {
	console.log("DrawUI() invoked");

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

		// The matrix
		// this will multiply the alpha by a really high number
		// so that it is no longer transparent
		// ctx.colourMatrix.matrix = [
		// 	1, 0, 0, 0, 0,
		// 	0, 1, 0, 0, 0,
		// 	0, 0, 1, 0, 0,
		// 	0, 0, 0, 10000000, 0 
		// ]

		// this is slow too
		ctx.graphics.clear();
		ctx.graphics.beginFill(colour, 1);
		ctx.graphics.lineStyle(width, colour, 1);
	    ctx.graphics.moveTo(x0, y0); 
	    ctx.graphics.lineTo(x1, y1);
	    ctx.graphics.endFill();

	 	ctx.circleSprite.x = x0 - (radius + 1);
	 	ctx.circleSprite.y = y0 - (radius + 1);
	 	// this.renderer.render(ctx.container);

	 	// ctx.graphics.clear();
	 	ctx.circleSprite.x = x1 - radius;
	 	ctx.circleSprite.y = y1 - radius;
	 	this.renderer.render(ctx.container);

		// The matrix
		// Now we move back to the brush alpha again
		// ctx.colourMatrix.matrix = [
		// 	1, 0, 0, 0, 0,
		// 	0, 1, 0, 0, 0,
		// 	0, 0, 1, 0, 0,
		// 	0, 0, 0, alpha, 0 
		// ]

		// this call slows things down
		
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
		ctx.circleSprite = new PIXI.Sprite(ctx.renderTexture)
		this.renderer.render(ctx.circleGraphics, ctx.renderTexture);
		ctx.container.addChild(ctx.circleSprite);
	}
}