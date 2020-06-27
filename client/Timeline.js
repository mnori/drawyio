// For performance measurements

function Timeline(label) {
	this.init = function(label) {
		this.entries = [];
		self.log(label ? label : "start");
	}

	this.log = function(name) {
		self.entries.push({
			"name": name, 
			"time": window.performance.now()
		});	
	}

	this.dump = function(label) {
		self.log(label ? label : "end");
		var currEntry;
		var prevEntry = null;
		for (var i = 0; i < self.entries.length; i++) {
			var currEntry = self.entries[i];
			if (prevEntry != null) {
				var diffMs = currEntry.time - prevEntry.time;
				console.log("["+prevEntry.name+"] => ["+currEntry.name+"] "+diffMs+" ms");
			}
			prevEntry = currEntry;
		}
	}

	var self = this;
	self.init(label);
}
