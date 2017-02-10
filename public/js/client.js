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
	var croppingCanvas = $("#crop_canvas");
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
			processCanvas(canvas[0], croppingCanvas[0])
		}
		prevCoord = null;
	}

	function addLayer(layerIDIn, cropCoords, base64) {
		var layersHtml = 
			"<img class=\"drawing_layer\" "+
			"src=\""+base64+"\" "+
			"style=\""+
				"z-index: "+layerIDIn+";"+
				"left: "+cropCoords.left+"px;"+
				"top: "+cropCoords.top+"px;\"/>";
		$("#drawing_layers").prepend(layersHtml);
		if (layerIDIn > layerID) {
			layerID = layerIDIn;
		}
	}

	// Converts canvas to various useful things
	function processCanvas(sourceCanvas, croppingCanvas) {
		var cropCoords = cropCanvas(sourceCanvas, croppingCanvas);

		// First generate a png blob
		var blob = croppingCanvas.toBlob(function(blob) {

			// Generate data URL, to be displayed on the front end, from the blob
			var fr = new FileReader();
			fr.onload = function(e) {
				addLayer(layerID, cropCoords, e.target.result)

				// Update the front end png stack
				layerID++; // this lets us create a nice stack

				// attr("src", e.target.result)

				// Clear the canvas
				ctx.clearRect(0, 0, sourceCanvas.width, sourceCanvas.height)
				ctx.beginPath()

				// Now convert to base64 - this will be send back to the server
				var fr = new window.FileReader();
				fr.readAsDataURL(blob); 
				fr.onloadend = function() {
					var base64 = fr.result;
					socket.emit("add_layer", {
						"drawID": drawID,
						"base64": base64,
						"coords": cropCoords
					});
				}
			}
			fr.readAsDataURL(blob);

		}, "image/png");
	}

	setup();
}

// Adapted from https://stackoverflow.com/questions/12175991/crop-image-white-space-automatically-using-jquery
function cropCanvas(sourceCanvas, destCanvas) {
    var context = sourceCanvas.getContext('2d');
    // context.drawImage(imageObject, 0, 0);

    var imgWidth = sourceCanvas.width, 
    	imgHeight = sourceCanvas.height;

    var imageData = context.getImageData(0, 0, imgWidth, imgHeight),
        data = imageData.data,
        hasData = function (x, y) {
        	var offset = imgWidth * y + x;
        	var value = data[offset * 4 + 3]; // this fetches the opacity value
        	if (value != 0) { 
        		return true;
        	}
        	return false;
        },
        scanY = function (fromTop) {
            var offset = fromTop ? 1 : -1;

            // loop through each row
            for (var y = fromTop ? 0 : imgHeight - 1; fromTop ? (y < imgHeight) : (y > -1); y += offset) {

                // loop through each column
                for (var x = 0; x < imgWidth; x++) {
                    if (hasData(x, y)) {
                        return y;                        
                    }
                    
                }
            }
            return null; // all image is transparent
        },
        scanX = function (fromLeft) {
            var offset = fromLeft? 1 : -1;

            // loop through each column
            for (var x = fromLeft ? 0 : imgWidth - 1; fromLeft ? (x < imgWidth) : (x > -1); x += offset) {

                // loop through each row
                for (var y = 0; y < imgHeight; y++) {
                    if (hasData(x, y)) {
                        return x;                        
                    }
                }
            }
            return null; // all image is transparent
        };

    var cropTop = scanY(true),
        cropBottom = scanY(false) + 1,
        cropLeft = scanX(true),
        cropRight = scanX(false) + 1,
        cropWidth = cropRight - cropLeft,
        cropHeight = cropBottom - cropTop;

    destCanvas.setAttribute("width", cropWidth);
    destCanvas.setAttribute("height", cropHeight);

    // this is where the cropping happens
    destCanvas.getContext("2d").drawImage(sourceCanvas,
        cropLeft, cropTop, cropWidth, cropHeight,
        0, 0, cropWidth, cropHeight);

    return {top: cropTop, right: cropRight, bottom: cropBottom, left: cropLeft};
}