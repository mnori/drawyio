// Holds the code for rendering drawings using coordinate data
// This is the new version that uses WebGL (pixijs)

function DrawUI(roomUI) {
	console.log("DrawUI() invoked");

	this.roomUI = roomUI;

	// Create pixi app object, should only be called once
	this.app = new PIXI.Application(this.roomUI.width, this.roomUI.height, { 
		"antialias": false,
		"transparent": true
	});

	// Create the element to render into
	var targetID = "renderer";
	document.body.appendChild(this.app.view);
	$(this.app.view).attr("id", targetID);

	var width = 45;
	var radius = parseInt(width / 2);
	var colour = 0xff0000;
	var alpha = 0.2;

	this.plotLine = function(ctx, toolIn, x0, y0, x1, y1) {
		if (typeof(ctx.renderElement) === "undefined") {
			ctx.renderElement = this.app.view;
			ctx.graphics = new PIXI.Graphics();

			ctx.container = new PIXI.Container();
			// ctx.container.alpha = alpha;
			ctx.container.addChild(ctx.graphics)

			// set up colour matrix
			ctx.colourMatrix = new PIXI.filters.ColorMatrixFilter();
			ctx.container.filters = [ctx.colourMatrix];

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
			this.app.renderer.render(ctx.circleGraphics, ctx.renderTexture);
			this.app.stage.addChild(ctx.container);
			this.app.stage.addChild(ctx.circleSprite);
		}

		// The matrix
		// this will multiply the alpha by a really high number
		// so that it is no longer transparent
		ctx.colourMatrix.matrix = [
			1, 0, 0, 0, 0,
			0, 1, 0, 0, 0,
			0, 0, 1, 0, 0,
			0, 0, 0, 10000000, 0 
		]
		ctx.graphics.lineStyle(width, colour, 1);
	    ctx.graphics.moveTo(x0, y0); 
	    ctx.graphics.lineTo(x1, y1);

	 	ctx.circleSprite.x = x0;
	 	ctx.circleSprite.y = y0;
	 	// this.app.stage.addChild(ctx.circleSprite);
	 	// this.app.renderer.render(ctx.circleSprite, ctx.container);

	 	ctx.circleSprite.x = x1;
	 	ctx.circleSprite.y = y1;
	 	// this.app.stage.addChild(ctx.circleSprite);
	 	// this.app.renderer.render(ctx.circleSprite, ctx.container);

		// The matrix
		// Now we move back to the brush alpha again
		ctx.colourMatrix.matrix = [
			1, 0, 0, 0, 0,
			0, 1, 0, 0, 0,
			0, 0, 1, 0, 0,
			0, 0, 0, alpha, 0 
		]
	}
}