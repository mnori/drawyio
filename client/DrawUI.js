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
	var width = 45;
	var radius = parseInt(width / 2);
	var colour = 0x660000;
	var alpha = 0.2;

	var targetID = "renderer";
	document.body.appendChild(this.app.view);
	$(this.app.view).attr("id", targetID);
	// $(this.app.view).css("opacity", alpha);

	this.plotLine = function(ctx, toolIn, x0, y0, x1, y1) {

		

		if (typeof(ctx.renderTexture) === "undefined") {
			// colourMatrix.desaturate();
			// ctx.renderElement = this.app.renderer;
			// ctx.renderTexture = PIXI.RenderTexture.create(this.roomUI.width, this.roomUI.height);
	
			// object for drawing shapes
			ctx.graphics = new PIXI.Graphics();
			// ctx.graphics.blendMode = PIXI.BLEND_MODES.NORMAL;
			// ctx.graphics.alpha = 0.5;
			// ctx.graphics.blendMode = "wrong";

			// console.log(PIXI.BLEND_MODES.LIGHTEN);

			ctx.container = new PIXI.Container();
			ctx.container.addChild(ctx.graphics)
			// ctx.graphics.filters = [colourMatrix];

			// let colorMatrix = new PIXI.ColorMatrixFilter();
			ctx.container.filters = [ctx.colourMatrix];

			// var brt = new PIXI.BaseRenderTexture(
			// 	this.roomUI.width, this.roomUI.height, PIXI.SCALE_MODES.LINEAR, 1);
			// ctx.renderTexture = new PIXI.RenderTexture(brt);


			 // = new PIXI.RenderTexture.create(ctx.container);
			// ctx.sprite = new PIXI.Sprite(ctx.renderTexture)
			// ctx.sprite.alpha = alpha;
			// this.app.stage.addChild(ctx.container);
			this.app.stage.addChild(ctx.container);

			// ctx.colourMatrix = new PIXI.filters.ColorMatrixFilter();
		}

		// ctx.colourMatrix.contrast(2);

		// console.log("MATRIX");
		// console.log(ctx.colourMatrix.matrix);

		ctx.graphics.lineStyle(width, colour, 1);
	    ctx.graphics.moveTo(x0, y0); 
	    ctx.graphics.lineTo(x1, y1);

	    ctx.graphics.lineStyle(0);
		ctx.graphics.beginFill(colour, 1);
		ctx.graphics.drawCircle(x0, y0, radius);
		ctx.graphics.drawCircle(x1, y1, radius);
		ctx.graphics.endFill();

		// Render the container to the rendertexture
		// This is slow, unfortunately
		// this.app.renderer.render(ctx.container, ctx.renderTexture);
	}
}