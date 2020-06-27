// Test by performing dummy drawing movements.
function DrawUiTester(roomUi) {

	this.init = function(roomUi) {
		self.roomUi = roomUi;
		self.active = false;
	}

	this.start = function() {
		self.active = true;
		self.initTool();
	}

	// Reset tool - shared between start and interrupt
	this.initTool = function() {
		self.cursor = { // attributes of our virtual mouse
			x: Math.round(self.roomUi.width / 2),
			y: Math.round(self.roomUi.height / 2),
		};
		self.roomUi.setToolColour(self.getRandomColor()); // set hopefully unique random colour to test
		self.roomUi.startTool(self.cursor)
		self.draw();
	}

	// Only to be called when the user physically picks a different tool.
	this.stop = function() {
		self.active = false;
		self.roomUi.stopTest();
	}

	// Called when a new stroke needs to be introduced for testing
	this.interrupt = function() {
		// We need to pretend to switch tools and then go back to the test mode again, doing it other
		// ways is complicated and annoying
		setTimeout(function() {
			// executed first
			self.roomUi.setTool("paint");
			setTimeout(function() {
				// executed after paint
				self.roomUi.setTool("test");
			}, 500);
		}, 500);
	}
	
	this.draw = function() {

		var drawTl = new Timeline("draw() call");

		if (self.iterationTl != null) {
			// find out how long each cycle lasts
			self.iterationTl.dump()
		}
		self.iterationTl = new Timeline("between test draws");

		if (!self.active) {
			return;
		}

		// Do we need to interrupt?
		if (	// random restart
				Math.random() * 100 >= 99 ||  

				// outside boundaries
				self.cursor.x < 0 ||
				self.cursor.x >= self.roomUi.width || 
				self.cursor.y < 0 ||
				self.cursor.y >= self.roomUi.height) {

			self.interrupt(); // Stop, quits the user back to brush
			return;
		}

		// Move the cursor
		self.cursor = {
			x: self.cursor.x + (-1 + Math.floor(Math.random() * 3)) * 5,
			y: self.cursor.y + (-1 + Math.floor(Math.random() * 3)) * 5
		};

		self.roomUi.tool.newCoord = self.cursor;
		self.roomUi.tool.meta.lineEntries.push(
			{"state": self.roomUi.tool.state, "coord": self.roomUi.tool.newCoord});

		self.roomUi.handleAction(self.roomUi.tool, true);
		// setTimeout(self.draw, 16);
		setTimeout(self.draw, 200);

		drawTl.dump();
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
