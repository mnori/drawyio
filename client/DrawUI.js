// Holds the code for rendering drawings using coordinate data
// This is the new version that uses WebGL (pixijs)

function DrawUI(roomUI) {
	console.log("DrawUI() invoked");

	this.roomUI = roomUI;
	this.app = new PIXI.Application(this.roomUI.width, this.roomUI.height, { 
		"antialias": true
	});

	this.plotLine = function(ctx, toolIn, x0, y0, x1, y1) {
		var targetID = $(ctx.canvas).attr("id")+"_rendering";

		if ($(targetID).length == 0) { // must create new element
			document.body.appendChild(this.app.view);
			$(this.app.view).attr("id", targetID);
		}

	    // app.stage.interactive = true;

	    var graphics = new PIXI.Graphics();

	    // set a fill and line style
	    graphics.beginFill(0xFF3300);
	    graphics.lineStyle(10, 0xffd900, 1);

	    // draw a shape
	    graphics.moveTo(x0, y0);
	    graphics.lineTo(x1, y1);

	    // console.log(x0, y0);
	    // console.log(x1, y1);
	    // graphics.lineTo(250, 50);
	    // graphics.lineTo(100, 100);
	    // graphics.lineTo(250, 220);
	    // graphics.lineTo(50, 220);
	    // graphics.lineTo(50, 50);
	    graphics.endFill();

	    this.app.stage.addChild(graphics);
	}
}