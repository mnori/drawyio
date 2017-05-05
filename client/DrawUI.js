// Holds the code for rendering drawings using coordinate data
// This is the new version that uses WebGL (pixijs)

function DrawUI(roomUI) {
	console.log("DrawUI() invoked");

	this.roomUI = roomUI;
	this.app = new PIXI.Application(this.roomUI.width, this.roomUI.height, { 
		"antialias": true
	});

	this.plotLine = function(ctx, toolIn, x0, y0, x1, y1) {

		var tl = new Timeline();
		tl.log("1");

		var targetID = $(ctx.canvas).attr("id")+"_rendering";

		tl.log("1.1");

		if ($("#"+targetID).length == 0) { // must create new element
			document.body.appendChild(this.app.view);
			$(this.app.view).attr("id", targetID);
		}

		tl.log("1.2");

	    // app.stage.interactive = true;

	    tl.log("2");

	    var graphics = new PIXI.Graphics();

	    tl.log("3");

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
	    tl.log("4");
	    this.app.stage.addChild(graphics);
	    tl.log("5");
	    tl.dump();
	}
}