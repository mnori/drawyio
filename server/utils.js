// Misc utilities that are shared between js files

// Define a nice java-like associative array wrapper with cleaner access than plain JS.
// TODO: decide whether we actually need this? Can just use built in stuff?
// e.g. https://zellwk.com/blog/looping-through-js-objects/ for more info
var _assocArray = function(valuesIn) {
	this.values = valuesIn ? valuesIn : {};
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
};

module.exports = {

	AssocArray: _assocArray,

	getSettingReplacements: function(keys, settings) {
		var out = new _assocArray();
		for (var i = 0; i < keys.length; i++) {
			var key = keys[i];
			out.set("settings."+key, settings[key]);		
		}
		return out;
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
	}, 

	getNowMysql: function() {
		return (new Date ((new Date((new Date(new Date())).toISOString() )).getTime() - ((new Date()).getTimezoneOffset()*60000))).toISOString().slice(0, 19).replace('T', ' ');
	},

	// Replace all instances of "search" string with "replace" string
	replaceAll: function(input, search, replace) {
		return input.split(search).join(replace);
	}
};