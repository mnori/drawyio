// Misc utilities

// Define a nice java-like associative array wrapper with cleaner access than plain JS.
module.exports = {
	AssocArray: function() {
		this.values = {};
		this.get = function(key) {
			if (typeof(this.values[key]) !== "undefined") {
				return this.values[key];
			}
			return null;
		}
		this.set = function(key, value) {
			// if (this.get(key)) {
			// 	console.log("Replacing existing layer!");
			// }
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
	}
};