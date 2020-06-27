// Class to manage a collection of tools, including local and test tools.
// Just handles the collection management rather than functionality of tools

function ToolManager() {

	this.init = function() {
		self._localTool = self._createTool();
	}

	this.getLocalTool = function() { 
		return self._localTool;
	}

	this._createTool = function() {
		return {
			state: "idle",
			tool: "paint",
			meta: null
		};
	}

	var self = this;
	self.init();
}