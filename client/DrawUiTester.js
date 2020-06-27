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

		// Stop repeat tools
		// ... TODO

		// Handle the action using standard method
		self.roomUi.handleAction(tool, false);
	}

	// Reset tool - shared between start and interrupt
	this.initTest = function(tool) {
		console.log("initTest called");
		tool.cursor = { // attributes of our virtual mouse
			x: Math.round(self.roomUi.width / 2),
			y: Math.round(self.roomUi.height / 2),
		};

		// self.roomUi.setToolColour(self.utils.getRandomColor()); // set hopefully unique random colour to test
		// self.roomUi.pickerToToolColour(tool); // bit of a hack to get the colour set

		console.log("1:", tool.colour);

		// tool.colour = "rgba("+col[0]+", "+col[1]+", "+col[2]+", "+col[3]+")";
		var rgb = self.utils.hexToRgb(self.utils.getRandomColor());
		tool.colour = "rgba("+rgb.r+", "+rgb.g+", "+rgb.b+", 0.5)";

		// console.log("2:", tool.colour);

		self.roomUi.startTool(tool.cursor, tool);
		self.draw(tool);
	}

	// Called when a new stroke needs to be introduced for testing
	this.interrupt = function(tool) {
		// We need to pretend to switch tools and then go back to the test mode again, doing it other
		// ways is complicated and annoying
		// setTimeout(function() {
		// 	// executed first
		// 	self.roomUi.setTool("paint", tool);
		// 	setTimeout(function() {
		// 		// executed after paint
		// 		self.roomUi.setTool("test", tool);
		// 	}, 100);
		// }, 500);

		tool.state = "end"

		// .. restart the tool
	}
	
	// Make the tool draw
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

		// We must handle the tool action and also receive the tool
		self.manageToolState(tool);
		self.roomUi.receiveTool(tool);
		
		setTimeout(function() { self.draw(tool); }, 16);
	}

	// like handlePaint but without all the chuff.. prepare the tool to be injected into receiveTool
	this.manageToolState = function(tool) {
		if (tool.state == "start") {
			tool.state = "drawing";
		}
	}

	var self = this;
	self.init(roomUi);
}
