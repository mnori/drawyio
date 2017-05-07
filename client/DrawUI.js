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
		var tl = new Timeline();
		tl.log("a");
		if (typeof(ctx.renderElement) === "undefined") {
			ctx.renderElement = this.app.view;
			ctx.graphics = new PIXI.Graphics();

			ctx.container = new PIXI.Container();
			// ctx.container.alpha = alpha;
			ctx.container.addChild(ctx.graphics)

			// set up colour matrix
			ctx.colourMatrix = new PIXI.filters.ColorMatrixFilter();
			ctx.container.filters = [ctx.colourMatrix];

			this.app.stage.addChild(ctx.container);
		}
		tl.log("b");

		// The matrix
		// this will multiply the alpha by a really high number
		// so that it is no longer transparent
		ctx.colourMatrix.matrix = [
			1, 0, 0, 0, 0,
			0, 1, 0, 0, 0,
			0, 0, 1, 0, 0,
			0, 0, 0, 10000000, 0 
		]
		// ctx.colourMatrix.contrast(1);
		tl.log("c");
		console.log(ctx.colourMatrix.matrix);

		ctx.graphics.beginFill(colour);
		// ctx.graphics.clear(); // this works
		ctx.graphics.lineStyle(width, colour, 1);
	    ctx.graphics.moveTo(x0, y0); 
	    ctx.graphics.lineTo(x1, y1);

	    ctx.graphics.lineStyle(0);
		ctx.graphics.beginFill(colour, 1);
		ctx.graphics.drawCircle(x0, y0, radius);
		ctx.graphics.drawCircle(x1, y1, radius);
		ctx.graphics.endFill();


		// The matrix
		// Now we move back to the brush alpha
		ctx.colourMatrix.matrix = [
			1, 0, 0, 0, 0,
			0, 1, 0, 0, 0,
			0, 0, 1, 0, 0,
			0, 0, 0, alpha, 0 
		]


		tl.log("d");
		tl.dump();
	}
}