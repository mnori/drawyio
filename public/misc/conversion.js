var renderer, container, graphics;

function main() {
	console.log("main()");

	// Render the circle
	setup();
	renderCircle();
}

function setup() {
	// Create the source canvas to render a circle onto
	renderer = PIXI.autoDetectRenderer(200, 200, {
		"antialias": true,
		"transparent": true,
		"clearBeforeRender": false,
		"preserveDrawingBuffer": true
	});
	var view = $(self.renderer.view);
	$("body").append(view);
	view.addClass("source_canvas");

	container = new PIXI.Container();
	graphics = new PIXI.Graphics();

	container.addChild(graphics);
}

function renderCircle() {
	graphics.beginFill(0xff0000dd, 1);
	graphics.lineStyle(0);
	graphics.drawCircle(100, 100, 50);
	graphics.endFill();
	renderer.render(container);
}