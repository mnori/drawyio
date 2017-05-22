var renderer, container, graphics;

function main() {
	console.log("main()");
	setup();
	renderCircle();
	createCanvas();
}

function setup() {
	// Create the source canvas to render a circle onto
	renderer = PIXI.autoDetectRenderer(200, 200, {
		antialias: true,
		transparent: true,
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
	graphics.beginFill(0xff0000, 0.2);
	graphics.lineStyle(0);
	graphics.drawCircle(100, 100, 50);
	graphics.endFill();
	renderer.render(container);
}

function createCanvas() {
	// Extract canvas using Pixi API
	var stagingContainer = new PIXI.Container();
	stagingContainer.addChild(graphics);
	var canvas = renderer.extract.canvas(stagingContainer);
	$("#after").append(canvas);	
	$(canvas).addClass("dest_canvas");
}

main();