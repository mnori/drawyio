// General purpose endpoint validation methods for drawyio
const settings = require("./settings")

const verbose = false;

module.exports = {
	// Check drawing identifier
	checkRoomID: function(roomID) {
		if (this.checkCode(roomID, settings.ID_LEN)) {
			return true;
		}
		if (verbose) console.log("Invalid roomID ["+roomID+"]");
		return false;
	},

	checkSnapshotID: function(snapID) {
		if (this.checkCode(snapID, settings.SNAPSHOT_ID_LEN)) {
			return true;
		}
		if (verbose) console.log("Invalid snapshotID ["+snapID+"]");
		return false;	
	},

	// Check layer code
	checkLayerCode: function(layerCode) {
		if (this.checkCode(layerCode, settings.LAYER_CODE_LEN)) {
			return true;
		}
		if (verbose) console.log("Invalid layerCode ["+layerCode+"]");
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

