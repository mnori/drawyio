// Represents a layer which is linked to a particular user/socket
// Consists of a render texture which has various Strokes superimposed over the top of it
// In future, will add other types of drawing element
function Layer(drawUi, layerId, local) {
	var self = this;
	this.init = function() {
		self.type = "Layer";
		self.id = layerId;
		self.order = drawUi.getNLayers();
		self.drawUi = drawUi;
		self.stroke = new Stroke(this);
		self.container = new PIXI.Container();
		self.local = local ? local : false; // whether currently the local target
		self.createdLocal = self.local; // debugging		
		self.drawUi.utils.createRenderSprite(self);
	}

	this.bindSprite = function() {
		if (self.local) {
			// if local, it's handled by drawUi
			return;
		}
		self.drawUi.container.addChild(self.renderSprite);
		self.drawUi.container.addChild(self.stroke.renderSprite); // might add twice!
	}

	// Renders finished Stroke render texture to the layer's render texture.
	// Only called after a stroke is completed. Not called between frames.
	this.renderStroke = function() {
		// Attach the stroke sprite to the layer container
		self.container.addChild(self.stroke.renderSprite); 

		// Render layer container onto layer render texture
		self.drawUi.renderer.render(self.container, self.renderTexture);

		// Remove stroke sprite from the layer container, since we just rendered it
		self.container.removeChildren();

		self.stroke.reset();
	}

	this.destroy = function() {
		// need to delete all the render stuff properly, otherwise memory will leak
		self.stroke.destroy();
		self.renderTexture.destroy(true);
	}

	self.init();
}
