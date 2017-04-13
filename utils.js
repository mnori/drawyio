// Misc utilities that are shared between js files

module.exports = {

	// Define a nice java-like associative array wrapper with cleaner access than plain JS.
	AssocArray: function() {
		this.values = {};
		this.get = function(key) {
			if (typeof(this.values[key]) !== "undefined") {
				return this.values[key];
			}
			return null;
		}
		this.set = function(key, value) {
			this.values[key] = value;
		}
		this.getLength = function() {
			return this.getKeys().length;
		}
		this.getKeys = function() {
			return Object.keys(this.values);
		}
		this.getValues = function() {
			return Object.values(this.values);
		}		

		this.getJson = function() {
			return JSON.stringify(this.values);	
		}
		this.empty = function() {
			this.values = {}
		}
		this.remove = function(key) {
			delete this.values[key]
		}
	},

	// Convert a base64 encoded PNG string into a Buffer object
	base64ToBuffer: function(base64) {
		var str = base64.replace("data:image/png;base64,", "");
		return Buffer.from(str, 'base64')
	},
	
	// Create a random string, to be used as an ID code
	randomString: function(length) {
		var text = "";
		var charset = "abcdefghijklmnopqrstuvwxyz0123456789";
		for (var i = 0; i < length; i++) { 
			text += charset.charAt(Math.floor(Math.random() * charset.length));
		}
		return text;
	}
};