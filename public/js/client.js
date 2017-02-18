// The draw.io front end client
// (C) 2017 drawy.io

// Intialise the splash screen
function initSplash() {
	$("#create_drawing_btn").click(function() {
		// "New drawing" button AJAX
		$.ajax({
			url: "/create_drawing"

		}).done(function(drawingID) {
			// Redirect to the drawing's page
			window.location.href = "/d/"+drawingID
		});
	});
}

// Initialise the drawing image UI
function initDrawing(drawIdIn) {
	// gives around 60fps. Is used for both drawing and sending drawing data
	var mouseEmitInterval = 16; 

	var canvas = $("#drawing_canvas");
	var croppingCanvas = $("#crop_canvas");
	var ctx = canvas[0].getContext('2d'); // the user editable element
	var socket = io.connect("/drawing_socket_"+drawIdIn);
	var drawID = drawIdIn;
	var layerCodeLen = 32;
	var highestLayerID = 1;
	var lastEmit = $.now();
	var labelFadeOutMs = 120;
	var labelFadeInMs = 500;

	// Metadata about the action being performed
	var tool = {prevCoord: null, newCoord: null, state: "idle"};

	function setup() { 

		// PLAN HERE
		// - Each mouse event should generate a draw command struct
		// - Send the struct to a handler
		// - Tackle each handler method one a time

		// start drawing
		var body = $("body");
		body.mousedown(function(ev) {
			tool.newCoord = getMousePos(ev);
			tool.prevCoord = tool.newCoord;
			tool.state = "drawing";
			handleAction(tool);

			// tool.prevCoord = getMousePos(ev);
			// if (tool.prevCoord == null) { // click occured outside of canvas
			// 	return;
			// }
			// tool.newCoord = tool.prevCoord;
			// handleAction(tool);
		});

		// draw a stroke. Sync with the tick so coords send are the same used for drawing
		body.mousemove(function(ev) {
			tool.newCoord = getMousePos(ev);
			handleAction(tool);
			// if (tool.newCoord == null) { // mouse fell off edge of screen
			// 	handleAction(tool);
			// }
			// if($.now() - lastEmit > mouseEmitInterval) { 
			// 	if (tool.prevCoord != null) {
			// 		handleAction(tool);
			// 		tool.prevCoord = tool.newCoord;
			// 	} else {
			// 		// this indicates that we are not drawing.
			// 		tool.prevCoord = null;
			// 		handleAction(tool);
			// 	}
			// 	lastEmit = $.now();
			// }
			tool.prevCoord = tool.newCoord;
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

	function stopDrawing() {
		if (tool.state == "drawing") {
			tool.state = "end";
		}
		// tool.prevCoord = tool.newCoord
		// tool.newCoord = null;
		handleAction(tool);
	}

	function handleAction(tool) {
		console.log("handleAction() invoked with state "+tool.state);
		if (tool.state == "drawing") {
			drawLine(tool.prevCoord, tool.newCoord);
		} else if (tool.state == "end") {
			processCanvas(canvas[0], croppingCanvas[0])
			tool.state = "idle";
		}

		// always emit those mouse coords
		emitMouseCoords(tool.prevCoord, tool.newCoord);
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
		// var maxNew = null;
		var minNew = null;
		$.each(data, function(key, value) {
			var keyInt = parseInt(key);
			if (minNew == null || keyInt < minNew) {
				minNew = keyInt;
			}
			renderLayerHtml(keyInt, value, false);
		});
	}

	function receiveLayer(data) {
		data = $.parseJSON(data);
		renderLayerHtml(data.id, data.layer, false);
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
		// if (mousePos.x >= rect.width) mousePos.x = rect.width - 1;
		// if (mousePos.y >= rect.height) mousePos.y = rect.height - 1;
		
		if (	mousePos.x < 0 || mousePos.x >= rect.width ||
				mousePos.y < 0 || mousePos.y >= rect.height) {
			return null
		}
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

	function getLayerByCode(code) {
		var existingLayer = $("#drawing_layer_"+code);
		if (existingLayer.length > 0) { // avoid a duplicate element
			return existingLayer;
		}
		return null;
	}
	
	// add layer data to the dom
	// isTemp: whether this is a temporary layer created by the client
	function renderLayerHtml(layerIDIn, layer, isTemp) {

		// Remove duplicate layer with same ID as this one
		var duplicate = getLayerByCode(layer.code);
		if (duplicate != null) {
			duplicate.remove();
		}

		// check if there are any component layers to remove from a flattened image
		var bump = (isTemp) ? 1000 : 0; // temporary layers always above the rest
		var layersHtml = 
			"<img id=\"drawing_layer_"+layer.code+"\" class=\"drawing_layer\" "+
				"src=\""+layer.base64+"\" "+
				"style=\""+
					"z-index: "+(layerIDIn + bump)+";"+
					"left: "+layer.offsets.left+"px;"+
					"top: "+layer.offsets.top+"px;\"/>";
		$("#drawing_layers").append(layersHtml);

		// If this is a flatten layer, removes the components
		if (typeof(layer["components"]) !== "undefined") {
			var codes = layer["components"]
			for (var i = 0; i < codes.length; i++) {
				var layer = getLayerByCode(codes[i].code);
				if (layer != null) {
					layer.remove();
				}
			}
		}

		if (layerIDIn > highestLayerID) {
			highestLayerID = layerIDIn;
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
				
				// create a random identifier for this layer
				var code = randomString(layerCodeLen);

				var layer = {
					drawID: drawID,
					base64: e.target.result, 
					offsets: cropCoords,
					code: code
				}
				// true will bump the layer z-index since it's temporary
				renderLayerHtml(highestLayerID + 1, layer, true);

				// Clear the canvas
				ctx.clearRect(0, 0, sourceCanvas.width, sourceCanvas.height)

				// Now convert to base64 - this will be send back to the server
				var fr = new window.FileReader();
				fr.readAsDataURL(blob); 
				fr.onloadend = function() {
					var base64 = fr.result;
					socket.emit("add_layer", layer);
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

// just for debugging, see http://stackoverflow.com/questions/951021/what-is-the-javascript-version-of-sleep
function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, ms));
}

function randomString(length) {
    var text = "";
    var charset = "abcdefghijklmnopqrstuvwxyz0123456789";
    for (var i = 0; i < length; i++) { 
        text += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    return text;
}