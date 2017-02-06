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
	var ctx = canvas[0].getContext('2d'); // used for drawing stuff
	var prevCoord = null; // if this is null, it means we are not drawing
	var socket = io.connect("/");

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
		ctx.stroke()
	}

	function stopDrawing(ev) {
		if (prevCoord != null) {
			processCanvas(canvas[0])
		}
		prevCoord = null;
	}

	// Converts canvas to various useful things
	function processCanvas(cv) {

		// First generate a png blob
		var blob = cv.toBlob(function(blob) {

			// Generate data URL, to be displayed on the front end, from the blob
			var fr = new FileReader();
		    fr.onload = function(e) {

		    	// Update the front end png stack
		    	$("#drawing_main").attr("src", e.target.result)

		    	// Clear the canvas
		    	ctx.clearRect(0, 0, cv.width, cv.height)
		    	ctx.beginPath()

		    	// Now convert to base64 - this will be send back to the server
				var fr = new window.FileReader();
				fr.readAsDataURL(blob); 
				fr.onloadend = function() {
					var base64 = fr.result;



					// console.log(base64)
					// send back to server

					// 
				}
		    }
		    fr.readAsDataURL(blob);

		}, "image/png");
	}

	setup();
}