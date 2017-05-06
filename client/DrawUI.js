// Holds the code for rendering drawings using coordinate data
// This is the new version that uses WebGL (pixijs)

function DrawUI(roomUI) {
	console.log("DrawUI() invoked");

	this.roomUI = roomUI;

	this.sketch = Sketch.create({
        container: document.getElementById("renderer" ),
        autoclear: false,
        retina: 'auto',
        setup: function() {
            console.log( 'setup' );
        }
        // update: function() {
        //     radius = 2 + abs( sin( this.millis * 0.003 ) * 50 );
        // },
        // // Event handlers
        // keydown: function() {
        //     if ( this.keys.C ) this.clear();
        // },
        // // Mouse & touch events are merged, so handling touch events by default
        // // and powering sketches using the touches array is recommended for easy
        // // scalability. If you only need to handle the mouse / desktop browsers,
        // // use the 0th touch element and you get wider device support for free.
        // touchmove: function() {
        //     for ( var i = this.touches.length - 1, touch; i >= 0; i-- ) {
        //         touch = this.touches[i];
        //         this.lineCap = 'round';
        //         this.lineJoin = 'round';
        //         this.fillStyle = this.strokeStyle = COLOURS[ i % COLOURS.length ];
        //         this.lineWidth = radius;
        //         this.beginPath();
        //         this.moveTo( touch.ox, touch.oy );
        //         this.lineTo( touch.x, touch.y );
        //         this.stroke();
        //     }
        // }
    });

	this.plotLine = function(ctx, toolIn, x0, y0, x1, y1) {
		var width = 45;
		var radius = parseInt(width / 2);
		var colour = 0x000000;
		var alpha = 0.2;

		console.log(this);

		this.sketch.filter = "opacity(0.5)";
		// this.sketch.globalAlpha = 0.5;
		this.sketch.lineCap = 'round';
		this.sketch.lineJoin = 'round';
		this.sketch.fillStyle = this.sketch.strokeStyle = '#f00';
		this.sketch.lineWidth = width;
		this.sketch.beginPath();
		this.sketch.moveTo(x0, y0);
		this.sketch.lineTo(x1, y1);
		this.sketch.stroke();
	}


	// // Create pixi app object, should only be called once
	// this.app = new PIXI.Application(this.roomUI.width, this.roomUI.height, { 
	// 	"antialias": false,
	// 	"transparent": true
	// });

	// // Create the element to render into
	// var targetID = "renderer";
	// document.body.appendChild(this.app.view);
	// $(this.app.view).attr("id", targetID);

	// this.plotLine = function(ctx, toolIn, x0, y0, x1, y1) {
	// 	var width = 45;
	// 	var radius = parseInt(width / 2);
	// 	var colour = 0x000000;
	// 	var alpha = 0.2;
	// 	if (typeof(ctx.renderElement) === "undefined") {
	// 		console.log("boom");
	// 		ctx.renderElement = this.app.view;
	// 		ctx.graphics = new PIXI.Graphics();

	// 		ctx.container = new PIXI.Container();
	// 		ctx.container.alpha = alpha;
	// 		ctx.container.addChild(ctx.graphics)
	// 		this.app.stage.addChild(ctx.container);
	// 	}

	// 	// ctx.graphics.beginFill(0xFF3300);
	// 	// ctx.graphics.clear(); // this works
	// 	// ctx.graphics.lineStyle(width, colour, 1);
	//  //    ctx.graphics.moveTo(x0, y0); 
	//  //    ctx.graphics.lineTo(x1, y1);

	//     ctx.graphics.lineStyle(0);
	// 	ctx.graphics.beginFill(colour, 1);
	// 	ctx.graphics.drawCircle(x0, y0, radius);
	// 	ctx.graphics.drawCircle(x1, y1, radius);
	// 	ctx.graphics.endFill();
	// }
}