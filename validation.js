// General purpose endpoint validation methods for drawyio
const settings = require("./settings")

module.exports = {
	// Check drawing identifier
	checkDrawID: function(drawID) {
		return this.checkCode(drawID, settings.ID_LEN);
	},

	// check an alphanumeric code, generic
	checkCode: function(codeIn, codeLength) {
		var regexStr = "[a-z0-9]{"+codeLength+"}"
		var re = RegExp(regexStr);
		var matches = re.exec(codeIn);
		if (matches != null && matches.length == 1) {
			return true;
		}
		console.log("Invalid code ["+codeIn+"]");
		return false;
	}
}

