function DrawUtils(drawUi) {
	var self = this;
	self.drawUi = drawUi;

	// Generic RenderTexture and Sprite creation
	self.createRenderSprite = function(self) {

		// Create render texture for drawing onto
		var brt = new PIXI.BaseRenderTexture(
			self.drawUi.roomUI.width, 
			self.drawUi.roomUI.height, 
			PIXI.SCALE_MODES.LINEAR, 1);
		self.renderTexture = new PIXI.RenderTexture(brt);

		// Create sprite from render texture
		self.renderSprite = new PIXI.Sprite(self.renderTexture)
	}

	// Extract alpha value from rgba() string
	self.rgbaToAlpha = function(strIn) {
		if (strIn.search("rgba") == -1) { // no alpha
			return 1;
		}

		// fetch the alpha value from the string
		var strBit = strIn.split(",").pop().slice(0, -1);
		var floatOut = parseFloat(strBit);
		return floatOut; // return it

	}

	// Extract hex colour code string from rgba() string
	self.rgbaToHex = function(rgba) {
		var parts = rgba.substring(rgba.indexOf("(")).split(","),
			r = parseInt(self.rgbaTrim(parts[0].substring(1)), 10),
			g = parseInt(self.rgbaTrim(parts[1]), 10),
			b = parseInt(self.rgbaTrim(parts[2]), 10);
			// a = parseFloat(rgbaTrim(parts[3].substring(0, parts[3].length - 1))).toFixed(2);

		var str = "0x" + self.extractHex(r) + self.extractHex(g) + self.extractHex(b);
		return parseInt(str);
	}

	self.extractHex = function(intVal) {
		var str = intVal.toString(16);
		if (str.length == 1) {
			str = "0"+str;
		}
		return str;
	}

	self.rgbaTrim = function(str) {
		return str.replace(/^\s+|\s+$/gm,'');
	}
}