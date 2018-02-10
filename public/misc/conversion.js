var renderer, container, graphics, blend;

function main() {
	setup();
	renderCircle();
	createCanvas();
}

function setup() {
	// Create the source canvas to render a circle onto
	renderer = new PIXI.WebGLRenderer(200, 200, {
		transparent: true,
		alpha: true,
		premultipliedAlpha: true,

		// other parameters
		// antialias: true,
		// clearBeforeRender: true, // makes no difference
		// preserveDrawingBuffer: true // also makes no difference
	});
	var gl = renderer.gl;

	console.log(renderer);
	var view = $(self.renderer.view);
	$("#before").append(view);
	view.addClass("source_canvas");

	container = new PIXI.Container();
	graphics = new PIXI.Graphics();

	console.log("blendMode", graphics.blendMode);
	container.addChild(graphics);
}

function renderCircle() {
	// Render circle into container
	// graphics.worldAlpha = 0; // nothing happens
	graphics.clear();
	graphics.beginFill(0xff0000, 0.2);
	graphics.lineStyle(0);
	graphics.drawCircle(100, 100, 50);
	graphics.endFill();
	renderer.render(container);
}

function createCanvas() {
	// this right here is where the conversion occurs
	var canvas = renderer.extract.canvas(graphics);

	// // exactly the same result
	// var pixels = renderer.extract.pixels(container, true);
	$("#after").append(canvas);	
	$(canvas).addClass("dest_canvas");
}


// can't seem to make it work after fiddling with the color matrix
// colorMatrix = [
// 	1, 0, 0, 0, 0,
// 	0, 1, 0, 0, 0,
// 	0, 0, 1, 0, 0,
// 	0, 0, 0, 1, 0
// ];
// filter = new PIXI.filters.ColorMatrixFilter();
// filter._loadMatrix(colorMatrix, false);
// container.filters = [filter];

// set up blend mode - again this doesn't work either
// var gl = renderer.gl;
// blend = new PIXI.BlendMode(gl.ONE, gl.ONE, gl.ONE, gl.SRC_ALPHA)
// graphics.blendMode = blend;

main();