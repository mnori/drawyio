// Test by performing dummy drawing movements.
function DrawUiTester(roomUi) {

	this.init = function(roomUi) {
		self.roomUi = roomUi;
	}

	// this.startLocal = function() {
	// 	var tool = self.roomUi.toolManager.createRepeatTool();
	// 	self.initLocalTest(tool);
	// 	// var tool = self.roomUi.toolManager.getLocalTool();
	// 	// self.initLocalTest(tool);
	// }

	this.startRepeat = function(tool) {
		var tool = self.roomUi.toolManager.createRepeatTool();
		self.initTest(tool);
	}

	// Stops everything
	this.stop = function() {
		console.log("STOPPING")

		// Stop local tool
		var tool = self.roomUi.toolManager.getLocalTool();
		if (tool.state == "drawing" || tool.state == "start") {
			tool.state = "end";
		}

		// Stop repeat tools
		// ... TODO

		// Handle the action using standard method
		self.roomUi.handleAction(tool, true);
	}

	// Reset tool - shared between start and interrupt
	this.initTest = function(tool) {
		tool.cursor = { // attributes of our virtual mouse
			x: Math.round(self.roomUi.width / 2),
			y: Math.round(self.roomUi.height / 2),
		};
		self.roomUi.setToolColour(self.getRandomColor()); // set hopefully unique random colour to test
		self.roomUi.pickerToToolColour(tool); // bit of a hack to get the colour set
		self.roomUi.startTool(tool.cursor, tool);
		self.draw(tool);
	}

	// Called when a new stroke needs to be introduced for testing
	this.interrupt = function(tool) {
		// We need to pretend to switch tools and then go back to the test mode again, doing it other
		// ways is complicated and annoying
		setTimeout(function() {
			// executed first
			self.roomUi.setTool("paint", tool);
			setTimeout(function() {
				// executed after paint
				self.roomUi.setTool("test", tool);
			}, 100);
		}, 100);
	}
	
	this.draw = function(tool) {

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

		// if it has a socket id then we know it should go through receiveTool instead of handleAction
		self.roomUi.receiveTool(tool);

		setTimeout(function() { self.draw(tool); }, 16);
	}

	this.getRandomColor = function() {
		var letters = '0123456789ABCDEF';
		var color = '#';
		for (var i = 0; i < 6; i++) {
			color += letters[Math.floor(Math.random() * 16)];
		}
		return color;
	}

	var self = this;
	self.init(roomUi);
}
