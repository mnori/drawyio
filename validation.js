// General purpose endpoint validation methods for drawyio
const settings = require("./settings")

module.exports = {
	// Check drawing identifier
	checkDrawID: function(drawID) {
		return this.checkCode(drawID, settings.ID_LEN);
	},

	// check an alphanumeric code, generic
	checkCode: function(codeIn, codeLength) {
		var regexStr = "[a-z1-9]{"+codeLength+"}"
		var re = RegExp(regexStr);
		var matches = re.exec(codeIn);
		return (matches != null && matches.length == 1) ? true : false;
	}
}

