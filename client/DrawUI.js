// Holds the code for rendering drawings using coordinate data
// This is the new version that uses WebGL (pixijs)

function DrawUI(roomUI) {
	console.log("DrawUI() invoked");

	this.roomUI = roomUI;
	this.app = new PIXI.Application(this.roomUI.width, this.roomUI.height, { 
		"antialias": true
	});

	this.plotLine = function(ctx, toolIn, x0, y0, x1, y1) {
		if (typeof(ctx.renderElement) === "undefined") {
			var targetID = $(ctx.canvas).attr("id")+"_rendering";	
			document.body.appendChild(this.app.view);
			$(this.app.view).attr("id", targetID);
			ctx.renderElement = this.app.view;
			ctx.graphics = new PIXI.Graphics();
			this.app.stage.addChild(ctx.graphics);
		}

		// var tl = new Timeline();
		// tl.log("a");

	    // set a fill and line style
	    // ctx.graphics.beginFill(0xFF3300);
	    ctx.graphics.lineStyle(20, 0xffd900, 0.5);

	    // tl.log("b");

	    // draw a shape
	    ctx.graphics.moveTo(x0, y0);
	    ctx.graphics.lineTo(x1, y1);

	    // tl.log("c");
	    // tl.dump();
	}
}