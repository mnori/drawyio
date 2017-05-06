// Holds the code for rendering drawings using coordinate data
// This is the new version that uses WebGL (pixijs)

function DrawUI(roomUI) {
	console.log("DrawUI() invoked");

	this.roomUI = roomUI;

	// Create pixi app object, should only be called once
	this.app = new PIXI.Application(this.roomUI.width, this.roomUI.height, { 
		"antialias": false,
		"transparent": false
	});

	// Create the element to render into
	var targetID = "renderer";
	document.body.appendChild(this.app.view);
	$(this.app.view).attr("id", targetID);

	this.plotLine = function(ctx, toolIn, x0, y0, x1, y1) {

		var tl = new Timeline();
		tl.log("1");

		var width = 45;
		var radius = parseInt(width / 2);
		var colour = 0xffffff;
		var alpha = 0.2;
		if (typeof(ctx.renderTexture) === "undefined") {
			console.log("boom");
			// ctx.renderElement = this.app.renderer;
			// ctx.renderTexture = PIXI.RenderTexture.create(this.roomUI.width, this.roomUI.height);
	
			// object for drawing shapes
			ctx.graphics = new PIXI.Graphics();
			ctx.graphics.blendMode = PIXI.BLEND_MODES.NORMAL;
			// ctx.graphics.blendMode = "wrong";

			// console.log(PIXI.BLEND_MODES.LIGHTEN);

			ctx.container = new PIXI.Container();
			ctx.container.addChild(ctx.graphics)


			var brt = new PIXI.BaseRenderTexture(
				this.roomUI.width, this.roomUI.height, PIXI.SCALE_MODES.LINEAR, 1);
			ctx.renderTexture = new PIXI.RenderTexture(brt);


			 // = new PIXI.RenderTexture.create(ctx.container);
			ctx.sprite = new PIXI.Sprite(ctx.renderTexture)
			// ctx.container.mask = ctx.container;
			// ctx.sprite.x = 50;
			// ctx.sprite.y = 50;
			ctx.sprite.alpha = 0.5;
			this.app.stage.addChild(ctx.container);
		}

		tl.log("2");

		// ctx.graphics.clear();
		// ctx.graphics.beginFill(colour);
		ctx.graphics.lineStyle(width, colour, alpha);
	    ctx.graphics.moveTo(x0, y0); 
	    ctx.graphics.lineTo(x1, y1);

	    ctx.graphics.lineStyle(0);
		ctx.graphics.beginFill(colour, alpha);
		ctx.graphics.drawCircle(x0, y0, radius);
		ctx.graphics.drawCircle(x1, y1, radius);
		ctx.graphics.endFill();

		tl.log("3");

		// Render the container to the rendertexture
		// This is slow, unfortunately
		// this.app.renderer.render(ctx.container, ctx.renderTexture);
		tl.log("4");
		// tl.dump();
	}
}