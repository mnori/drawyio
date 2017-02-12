// The draw.io front end client
// (C) 2017 drawy.io

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
	// gives around 60fps
	// used for both drawing and sending drawing data
	var mouseEmitInterval = 16; 

	var canvas = $("#drawing_canvas");
	var croppingCanvas = $("#crop_canvas");
	var ctx = canvas[0].getContext('2d'); // the user editable element
	var prevCoord = null; // if this is null, it means we are not drawing
	var socket = io.connect("/drawing_socket_"+drawIdIn);
	var drawID = drawIdIn;
	var layerID = 1
	var lastEmit = $.now();
	var labelFadeOutMs = 120;
	var labelFadeInMs = 500;

	function setup() { 

		// start drawing
		var body = $("body");
		body.mousedown(function(ev) {
			prevCoord = getMousePos(ev);
		});

		// draw a stroke. Sync with the tick so coords send are the same used for drawing
		body.mousemove(function(ev) { 
			var newCoord = getMousePos(ev);
			if (newCoord == null) {
				emitMouseCoords(prevCoord, null); // fell off edge of screen
				stopDrawing();
				return;
			}
			if($.now() - lastEmit > mouseEmitInterval) { 
				if (prevCoord != null) {
					drawLine(prevCoord, newCoord);
					emitMouseCoords(prevCoord, newCoord);
					prevCoord = newCoord;
				} else {
					// this indicates that we are not drawing.
					emitMouseCoords(null, newCoord);
				}
				lastEmit = $.now();
			}
		});

		// stop drawing
		body.mouseup(stopDrawing);
		body.mouseleave(stopDrawing);

		// Listen for new drawing data from the server
		socket.on("update_drawing", receiveDrawing);
		socket.on("add_layer", receiveLayer);
		socket.on("receive_mouse_coords", receiveMouseCoords);

		getDrawing();
	}

	function emitMouseCoords(prevCoord, newCoord) {
		// send mouse position data to the server
		socket.emit('mousemove', {
			nickname: $("#nickname").val(),
			prevCoord: prevCoord,
			newCoord: newCoord
		});
	}

	function receiveMouseCoords(data) {
		var sockID = data.socketID;
		var pointerElement = $("#drawing_pointer_"+sockID);
		if (data.newCoord == null) {
			// also fades out when the mouse is not drawing
			pointerElement.fadeOut(labelFadeOutMs, function() {
				pointerElement.remove();
			});
			return;
		}

		// data = $.parseJSON(data);
		if (pointerElement.length == 0) { // avoid a duplicate element
			var divBuf = 
				"<div id=\"drawing_pointer_"+sockID+"\" class=\"drawing_pointer\">"+
					"<div class=\"pointer_dot\"></div>"+
					"<div id=\"drawing_pointer_label_"+sockID+"\" class=\"pointer_label\"></div>"+
				"</div>";
			$("#drawing_layers").append(divBuf)
			pointerElement = $("#drawing_pointer_"+sockID);
			// position the pointer element
		}
		pointerElement.css({ // did try animate but it didn't work particularly well
			left: data.newCoord.x+"px",
			top: data.newCoord.y+"px"
		});
		var nick = !data.nickname ? "Anonymous" : data.nickname;
		$("#drawing_pointer_label_"+sockID).text(nick);
		pointerElement.fadeIn(labelFadeInMs);
	}

	// Ask the server for drawing data
	function getDrawing() {
		socket.emit("get_drawing", {"drawID": drawID});
	}

	// Update drawing with new draw data from the server
	// This resets the layers
	function receiveDrawing(data) {
		data = $.parseJSON(data);

		// Add the new layers
		var minKey = null;
		$.each(data, function(key, value) {
			var keyInt = parseInt(key);
			if (minKey == null || key < minKey) {
				minKey = key;
			}
			addLayer(keyInt, value);
		});

		// remove the older layers - those with z-index less than minKey
		$(".drawing_layer").each(function() {
			var element = $(this);
			var index = element.css("z-index");
			if (index < minKey) { // this is an old layer
				element.remove();
			}
		});
	}

	function receiveLayer(data) {
		data = $.parseJSON(data);
		addLayer(data.id, data.layer);
	}	

	// get the mouse position inside the canvas
	// returns null if the mouse is outside the canvas
	function getMousePos(ev) {
		var rect = canvas[0].getBoundingClientRect(); // [0] gets DOM object from jquery obj
		var mousePos = {
			x: Math.floor(ev.clientX - rect.left),
			y: Math.floor(ev.clientY - rect.top)
		};

		// attempt to wrap edges
		// if (mousePos.x < 0) mousePos.x = 0;
		// if (mousePos.y < 0) mousePos.y = 0;
		// if (mousePos.x >= rect.width) mousePos.x = rect.width;
		// if (mousePos.y >= rect.height) mousePos.y = rect.height;
		
		if (	mousePos.x < 0 || mousePos.x >= rect.width ||
				mousePos.y < 0 || mousePos.y >= rect.height) {
			return null
		}
		console.log(mousePos);
		return mousePos;
	}

	function drawLine(prevCoord, newCoord) {
		ctx.beginPath();
		ctx.moveTo(prevCoord.x, prevCoord.y);
		ctx.lineTo(newCoord.x, newCoord.y);
		ctx.strokeStyle = "black";
		ctx.lineCap = "round";
		ctx.lineJoin = "round";
	  	ctx.lineWidth = 5;
		ctx.stroke()
		ctx.closePath();
	}

	function stopDrawing(ev) {
		if (prevCoord != null) {
			processCanvas(canvas[0], croppingCanvas[0])
		}
		prevCoord = null;
	}

	// TODO squash cropCoords and base64 into an object?
	function addLayer(layerIDIn, layer) {
				
		var existingLayer = $("#drawing_layer_"+layerIDIn);
		var layersHtml = 
			"<img class=\"drawing_layer\" id=\"drawing_layer_"+layerIDIn+"\""+
			"src=\""+layer.base64+"\" "+
			"style=\""+
				"z-index: "+layerIDIn+";"+
				"left: "+layer.offsets.left+"px;"+
				"top: "+layer.offsets.top+"px;\"/>";

		if (existingLayer.length != 0) { // avoid a duplicate element
			existingLayer.remove();
		}
		$("#drawing_layers").append(layersHtml);

		if (layerIDIn > layerID) { // only add if it's a new layer
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
				addLayer(layerID + 1, {base64: e.target.result, offsets: cropCoords});

				// Update the front end png stack
				// attr("src", e.target.result)

				// Clear the canvas
				ctx.clearRect(0, 0, sourceCanvas.width, sourceCanvas.height)

				// Now convert to base64 - this will be send back to the server
				var fr = new window.FileReader();
				fr.readAsDataURL(blob); 
				fr.onloadend = function() {
					var base64 = fr.result;
					socket.emit("add_layer", {
						"drawID": drawID,
						"base64": base64,
						"offsets": cropCoords
					});
				}
			}
			fr.readAsDataURL(blob);

		}, "image/png");
	}

	setup();
}

// Crop a sourceCanvas by alpha=0. Results are written to destCanvas.
// Adapted from https://stackoverflow.com/questions/12175991/crop-image-white-space-automatically-using-jquery
function cropCanvas(sourceCanvas, destCanvas) {
    var context = sourceCanvas.getContext("2d");
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
                for (var x = 0; x < imgWidth; x++) { // loop through each column
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
                for (var y = 0; y < imgHeight; y++) { // loop through each row
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