// drawcloud.js
// The draw.io front end client
// Copyright (C) 2017 draw.io

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
function initDrawing(drawIdIn) {
	var canvas = $("#drawing_canvas");
	var ctx = canvas[0].getContext('2d'); // the user editable element
	var prevCoord = null; // if this is null, it means we are not drawing
	var socket = io.connect("/");
	var drawID = drawIdIn;
	var layerID = 1

	function setup() { 

		// start drawing
		canvas.mousedown(function(ev) {
			prevCoord = getMousePos(ev);
		});

		// draw a stroke
		canvas.mousemove(function(ev) { 
			if (prevCoord != null) {
				var newCoord = getMousePos(ev);
				drawLine(prevCoord, newCoord);
				prevCoord = newCoord;
			}
		});

		// stop drawing
		canvas.mouseup(stopDrawing);
		canvas.mouseleave(stopDrawing);

		// Listen for new drawing data from the server
		socket.on("update_drawing", receiveDrawing);

		getDrawing();
	}

	// Ask the server for drawing data
	function getDrawing() {
		socket.emit("get_drawing", {"drawID": drawID});
	}

	// Update drawing with new draw data from the server
	// This resets everything
	function receiveDrawing(data) {
		data = $.parseJSON(data);

		// Lets start off simple and just show the data
		// Remove all the old layers, if there are any
		$(".drawing_layer").remove()

		// Add the new layers
		$.each(data, function(key, value) {
			addLayer(parseInt(key), value);
		});
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

	function addLayer(layerIDIn, base64) {
		var layersHtml = 
			"<img class=\"drawing_layer\" "+
			"src=\""+base64+"\" "+
			"style=\"z-index: "+layerIDIn+"\" />";
		$("#drawing_layers").prepend(layersHtml);
		if (layerIDIn > layerID) {
			layerID = layerIDIn;
		}
	}

	// Converts canvas to various useful things
	function processCanvas(cv) {

		// First generate a png blob
		var blob = cv.toBlob(function(blob) {

			// Generate data URL, to be displayed on the front end, from the blob
			var fr = new FileReader();
			fr.onload = function(e) {
				addLayer(layerID, e.target.result)

				// Update the front end png stack
				layerID++; // this lets us create a nice stack

				// attr("src", e.target.result)

				// Clear the canvas
				ctx.clearRect(0, 0, cv.width, cv.height)
				ctx.beginPath()

				// Now convert to base64 - this will be send back to the server
				var fr = new window.FileReader();
				fr.readAsDataURL(blob); 
				fr.onloadend = function() {
					var base64 = fr.result;
					socket.emit("add_layer", {
						"drawID": drawID,
						"base64": base64
					});
				}
			}
			fr.readAsDataURL(blob);

		}, "image/png");
	}

	setup();
}