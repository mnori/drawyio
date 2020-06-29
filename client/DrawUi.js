// Holds the code for rendering drawings using coordinate data
// This is the new version that uses WebGL (via pixijs wrapper library)
// It's supposed to be a replacement for various parts of RoomUI.js
// All PIXI.* library calls go here.

// Note: It's slow with Chrome on Linux due to lack of GPU acceleration
// Nice and quick on Firefox though

function DrawUi(roomUI) {
	var self = this;

	// set up the main container
	this.init = function() {
		// Define some vars
		this.n = 0;
		this.roomUI = roomUI;
		this.container = new PIXI.Container();
		this.createRenderers();

		// Set up layer storage
		self.layers = new AssocArray();
		self.imageLayers = new AssocArray();
		this.localId = null;
		self.localLayer = null;
		self.utils = new Utils();

		// This is for cropping images and sending to the server
		self.stagingContainer = new PIXI.Container();
	}

	this.createRenderers = function() {
		// Setup main renderer, all the parameters are in an options object passed as 1st parameter
		self.renderer = new PIXI.Renderer({
			"width": this.roomUI.width,
			"height": this.roomUI.height,
			"antialias": true,
			"transparent": true,
			"clearBeforeRender": false, // needed for overlay rendering
			"preserveDrawingBuffer": true // as above
		});

		var view = $(self.renderer.view);
		$("#drawing_layers").append(view);
		view.attr("id", "renderer");
	}

	// Create new local layer with ID of layerId
	// Return a canvas containing the old image data, for processing
	this.newLocal = function(layerId) {
		var oldLayer = null;
		if (self.localLayer) {
			self.localLayer.local = false;
			oldLayer = self.localLayer;
		}
		self.localId = layerId;
		self.localLayer = null; // will get created automatically when drawing begins

		// now we generate a png image from the old local
		if (oldLayer) {
			return self.convertToCanvas(oldLayer);
		}
		return null;
	}

	// Finish a repeat layer by returning its pixels
	this.finishRepeat = function(repeatId) {
		var layer = self.layers.get(repeatId);
		if (layer) {
			self.layers.remove(repeatId);
			return self.convertToCanvas(layer);
		}
		return null;
	}

	this.convertToCanvas = function(oldLayer) {
		// Extract pixels from render sprite
		self.stagingContainer.removeChildren();
		self.stagingContainer.addChild(oldLayer.renderSprite);
		var canvas = self.renderer.extract.canvas(self.stagingContainer);
		// $("#drawing_layers").append(self.renderer.extract.image(self.stagingContainer));
		return canvas;		
	}

	this.getNLayers = function() {
		return ++this.n;
	}

	this.plotLine = function(layerId, x0, y0, x1, y1) {
		self.getLayer(layerId).stroke.plotLine(x0, y0, x1, y1);
	}

	this.startStroke = function(layerId, toolIn) {
		self.getLayer(layerId).stroke.startStroke(toolIn);
	}

	this.endStroke = function(layerId, toolIn) {
		self.getLayer(layerId).stroke.endStroke();
	}

	// happens when new layer data comes from the server - ditch the old layers
	this.destroyLayer = function(layerId) {
		var layer = self.getLayer(layerId); // can get image layers as well
		if (layer) {
			layer.destroy();
			self.layers.remove(layerId);
		}
		var imageLayer = self.getImageLayer(layerId);
		if (imageLayer) {
			imageLayer.destroy();
			self.imageLayers.remove(layerId);
		}
	}

	// Render the main container
	// Should only be called once per frame - WIP
	this.render = function() {

		// Empty the container
		self.container.removeChildren();

		// Render stroke data onto each sprite
		self.renderStrokes();

		// Bind the layer sets
		self.bindSorted(self.imageLayers);
		self.bindSorted(self.layers);

		console.log("render()");
		console.log(" - self.imageLayers: "+self.imageLayers.getLength());
		console.log(" - self.layers: "+self.layers.getLength());

		// Add the local layer last, so user's strokes always appear on top
		if (self.localLayer) {
			self.container.addChild(self.localLayer.renderSprite)
			self.container.addChild(self.localLayer.stroke.renderSprite);
		}
		
		// This render call makes it slow. The code above this call is fast.

		// true means we're clearing before render
		self.renderer.render(self.container, null, true);
	}

	// Render Helper method
	// Sort the layers, most recent at the bottom - these will render on top
	// Bind sprites to container
	this.bindSorted = function(layers) {
		var entries = layers.getValues();
		entries.sort(function(a, b) {
			if (a.order < b.order) {
				return -1;
			}
			if (a.order > b.order) {
				return 1;
			}
			return 0;
		});
		// Add layers to container in the correct order
		for (var i = 0; i < entries.length; i++) {
			var layer = entries[i];
			layer.bindSprite();
		}
	}

	this.renderStrokes = function() {
		var entries = self.layers.getValues();
		for (var i = 0; i < entries.length; i++) {
			var layer = entries[i];
			layer.stroke.render(); // won't render unless active
		}
	}

	// Get a layer by its layer code.
	// Generates a new layer if it doesn't exist.
	this.getLayer = function(layerId) {
		layer = self.layers.get(layerId);
		if (!layer) {
			var local = (layerId == self.localId) ? true : false; 
			layer = new Layer(self, layerId, local);
			self.layers.set(layerId, layer);
			if (local) {
				self.localLayer = layer;
			}
		}
		return layer;
	}

	this.getImageLayer = function(layerId) {
		var layer = self.imageLayers.get(layerId);
		if (layer) {
			return layer;
		}
		return null;
	}

	this.addImageLayer = function(layerData) {
		var newLayer = new ImageLayer(self, layerData);
		self.imageLayers.set(layerData.code, newLayer);
	}

	this.init();
}
