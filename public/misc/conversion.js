function run() {
	console.log("run()");
	// var canvas = self.renderer.extract.canvas(self.stagingContainer);
	self.renderer = PIXI.autoDetectRenderer(200, 200, {
		"antialias": true,
		"transparent": true,
		"clearBeforeRender": false,
		"preserveDrawingBuffer": true
	});
	var view = $(self.renderer.view);
	$("body").append(view);
	view.addClass("source_canvas")
}