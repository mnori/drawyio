// Layer containing an image sprite

function ImageLayer(drawUi, layerData) {
	var self = this;
	this.init = function() {
		self.type = "ImageLayer";
		self.id = layerData.code;
		self.order = drawUi.getNLayers();
		self.drawUi = drawUi;
		self.createSprite(layerData);
	}
	this.createSprite = function(layerData) {
		self.sprite = PIXI.Sprite.from(layerData.base64);
		self.sprite.x = layerData.offsets.left;
		self.sprite.y = layerData.offsets.top;
		self.sprite.texture.on('update', function() { // render every time a layer loads
			self.drawUi.render();
	    });
	}
	this.destroy = function() {
		self.sprite.destroy(true);
	}

	this.bindSprite = function() {
		self.drawUi.container.addChild(self.sprite);
	}
	this.init();
}