// drawcloud.js

// Intialise the splash screen
function initSplash() {
	$("#create_drawing_btn").click(function() {
		// Send ajax request to create new drawing
		$.ajax({
			url: "/create_drawing"

		}).done(function(drawingID) {
			// Redirect to the drawing's page
			window.location.href = "/drawings/"+drawingID
		});
	});
}

// Initialise the drawing image
function initDrawing() {
	var canvas = $("#drawing_canvas");
	var prevCoord = null;

	function setup() {
		canvas.mousedown(function(ev) {
			var orig = ev.originalEvent
			prevCoord = {x: orig.pageX, y:orig.pageY}
		});

		canvas.mousemove(function(ev) {
			if (prevCoord != null) {
				var newX = ev.originalEvent.pageX
				var newY = ev.originalEvent.pageY
				drawLine(prevCoord.x, prevCoord.y, newX, newY);
				prevCoord = {x: newX, y: newY}
			}
		});

		canvas.mouseup(stopDrawing);
		canvas.mouseleave(stopDrawing);
	}

	function drawLine(fromX, fromY, toX, toY) {
		console.log(fromX+", "+fromY+", "+toX+", "+toY);
	}

	function stopDrawing(ev) {
		console.log("Left!");
		prevCoord = null;
	}

	setup();
}