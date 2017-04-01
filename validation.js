const settings = require("./settings")

// Endpoint validation for drawyio
module.exports = {
	validateDrawID: function(drawIdIn) {
		var re = RegExp("[a-z1-9]{"+drawIdIn+"}");
		var matches = re.exec(drawIdIn);
		console.log(matches);
		return true;
	}
}

