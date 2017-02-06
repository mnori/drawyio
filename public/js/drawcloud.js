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
	var canvasID = "drawing_canvas"
	var canvas = $("#"+canvasID);
	var ctx = canvas[0].getContext('2d'); // used for drawing stuff
	var prevCoord = null; // if this is null, it means we are not drawing

	function setup() {
		canvas.mousedown(function(ev) {
			prevCoord = getMousePos(ev);
		});

		canvas.mousemove(function(ev) {
			if (prevCoord != null) {
				var newCoord = getMousePos(ev);
				drawLine(prevCoord, newCoord);
				prevCoord = newCoord
			}
		});

		canvas.mouseup(stopDrawing);
		canvas.mouseleave(stopDrawing);
	}

	function getMousePos(ev) {
	    var rect = canvas[0].getBoundingClientRect(); // [0] gets DOM object from jquery obj
	    return {
			x: ev.clientX - rect.left,
			y: ev.clientY - rect.top
	    };
	}

	function drawLine(prevCoord, newCoord) {
		ctx.moveTo(prevCoord.x, prevCoord.y);
		ctx.lineTo(newCoord.x, newCoord.y);

		console.log(prevCoord)
		console.log(newCoord)
		ctx.stroke()
	}

	function stopDrawing(ev) {
		prevCoord = null;
	}

	setup();
}