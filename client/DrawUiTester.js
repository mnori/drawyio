// Test by performing dummy drawing movements.
function DrawUiTester(roomUi) {

	this.init = function(roomUi) {
		self.roomUi = roomUi;
		self.utils = new Utils();
	}

	// Stops everything
	this.stop = function() {
		// Stop local tool
		var tool = self.roomUi.toolManager.getLocalTool();
		if (tool.state == "drawing" || tool.state == "start") {
			tool.state = "end";
		}
		self.roomUi.handleAction(tool, false); // Handle the action using standard method
	}

	// Reset tool - shared between start and interrupt
	this.initTest = function(tool) {
		tool.cursor = { // attributes of our virtual mouse
			x: Math.round(self.roomUi.width / 2),
			y: Math.round(self.roomUi.height / 2),
		};

		var rgb = self.utils.hexToRgb(self.utils.getRandomColor());
		tool.colour = "rgba("+rgb.r+", "+rgb.g+", "+rgb.b+", 0.5)";
		tool.layerCode = self.utils.randomString(self.roomUi.layerCodeLen);
		tool.state = "start";
		self.draw(tool);
	}

	// Called when stroke ends
	this.interrupt = function(tool) {
		tool.state = "end"
		self.roomUi.handleAction(tool);
	}
	
	// Make the tool draw
	this.draw = function(tool) {

		// remember, this gets set to false every draw() interation so we
		// need to put it back again.
		tool.testReceive = true; 

		// Do we need to interrupt?
		if (	// random restart
				Math.random() * 100 >= 99 ||  

				// outside boundaries
				tool.cursor.x < 0 ||
				tool.cursor.x >= self.roomUi.width || 
				tool.cursor.y < 0 ||
				tool.cursor.y >= self.roomUi.height) {

			self.interrupt(tool); // Stop, quits the user back to brush
			return;
		}

		// Move the cursor
		tool.cursor = {
			x: tool.cursor.x + (-1 + Math.floor(Math.random() * 3)) * 5,
			y: tool.cursor.y + (-1 + Math.floor(Math.random() * 3)) * 5
		};

		tool.newCoord = tool.cursor;
		tool.meta.lineEntries.push(
			{"state": tool.state, "coord": tool.newCoord});

		// We must handle the tool action and also receive the tool
		// self.manageToolState(tool);
		self.roomUi.handleAction(tool);
		setTimeout(function() { self.draw(tool); }, self.roomUi.emitInterval);
	}

	var self = this;
	self.init(roomUi);
}
