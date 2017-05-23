var renderer, container, graphics;

function main() {
	setup();
	renderCircle();
	createCanvas();
}

function setup() {
	// Create the source canvas to render a circle onto
	renderer = PIXI.autoDetectRenderer(200, 200, {
		antialias: true,
		transparent: "notMultiplied",
		clearBeforeRender: false,
		preserveDrawingBuffer: true
	});
	var view = $(self.renderer.view);
	$("#before").append(view);
	view.addClass("source_canvas");

	container = new PIXI.Container();
	graphics = new PIXI.Graphics();
	container.addChild(graphics);
}

function renderCircle() {
	// Render circle into container
	// graphics.worldAlpha = 0; // nothing happens
	graphics.beginFill(0xff0000, 0.2);
	graphics.lineStyle(0);
	graphics.drawCircle(100, 100, 50);
	graphics.endFill();
	renderer.render(container);
}

function createCanvas() {
	// can't seem to make it work after fiddling with the color matrix
	colorMatrix = [
		1, 0, 0, 0, 0,
		0, 1, 0, 0, 0,
		0, 0, 1, 0, 0,
		0, 0, 0, 1, 0
	];
	filter = new PIXI.filters.ColorMatrixFilter();
	filter._loadMatrix(colorMatrix, true);
	container.filters = [filter];
	
	var canvas = renderer.extract.canvas(container);
	$("#after").append(canvas);	
	$(canvas).addClass("dest_canvas");
}

main();