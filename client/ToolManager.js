// Class to manage a collection of tools, including local and test tools.
// Just handles the collection management rather than functionality of tools

function ToolManager() {

	this.init = function() {
		self._localTool = self._createTool();
		self._repeatTools = new AssocArray();
		self.nTools = 0;
	}

	this.getLocalTool = function() { 
		return self._localTool;
	}

	this.createRepeatTool = function() {
		self.nTools++;
		var tool = self._createTool();
		tool.socketId = "dummy_socket_"+self.nTools
		tool.nickname = "Dummy";
		self._repeatTools.set(tool.socketId, tool);
		return tool;
	}

	this.getRepeatTool = function(dummySocketId) {
		return self._repeatTools.get(dummySocketId);
	}

	this._createTool = function() {
		return {
			state: "idle",
			tool: "paint",
			requiresFlatten: true,
			meta: {
				"brushSize": 13,
				"lineEntries": []
			}
		};
	}

	var self = this;
	self.init();
}