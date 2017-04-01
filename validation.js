// General purpose endpoint validation methods for drawyio
const settings = require("./settings")

module.exports = {
	// Check drawing identifier
	checkDrawID: function(drawID) {
		if (this.checkCode(drawID, settings.ID_LEN)) {
			return true;
		}
		console.log("Invalid drawID ["+drawID+"]");
		return false;
	},

	// Check layer code
	checkLayerCode: function(layerCode) {
		if (this.checkCode(layerCode, settings.LAYER_CODE_LEN)) {
			return true;
		}
		console.log("Invalid layerCode ["+layerCode+"]");
		return false;
	},

	// Check an alphanumeric code, generic
	checkCode: function(codeIn, codeLength) {
		var regexStr = "[a-z0-9]{"+codeLength+"}"
		var re = RegExp(regexStr);
		var matches = re.exec(codeIn);
		if (matches != null && matches.length == 1) {
			return true;
		}
		return false;
	}
}

