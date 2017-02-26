// The draw.io front end client
// (C) 2017 drawy.io

// Intialise the splash screen
function initSplash() {
	$("#create_drawing_btn").click(function() {
		// "New drawing" button AJAX
		$.ajax({url: "/create_drawing"}).done(function(drawingID) {
			// Redirect to the drawing's page
			window.location.href = "/d/"+drawingID
		});
	});
}

// Initialise the drawing image UI
function initDrawing(drawIdIn, widthIn, heightIn) {
	var mouseEmitInterval = 8; 
	var width = widthIn;
	var height = heightIn;
	var canvas = $("#drawing_canvas");
	var croppingCanvas = $("#crop_canvas");
	var floodCanvas = $("#flood_canvas");
	var ctx = canvas[0].getContext('2d'); // the user editable element

	ctx['imageSmoothingEnabled'] = false;       /* standard */
    ctx['mozImageSmoothingEnabled'] = false;    /* Firefox */
    ctx['oImageSmoothingEnabled'] = false;      /* Opera */
    ctx['webkitImageSmoothingEnabled'] = false; /* Safari */
    ctx['msImageSmoothingEnabled'] = false;     /* IE */

	var socket = io.connect("/drawing_socket_"+drawIdIn);
	var drawID = drawIdIn;
	var layerCodeLen = 32;
	var highestLayerID = 1;
	var lastEmit = $.now();
	var labelFadeOutMs = 120;
	var canvasCeiling = 1000000000;

	// Metadata about the action being performed
	var tool = {
		prevCoord: null,
		newCoord: null,
		state: "idle",
		tool: "paint"
	};

	function setup() { 

		setupControls();

		// start drawing
		var body = $("body");
		body.mousedown(function(ev) {
			tool.newCoord = getMousePos(ev);
			if (tool.newCoord != null) { // make sure mouse is within canvas
				tool.prevCoord = tool.newCoord;
				tool.state = "start";
				tool.layerCode = randomString(layerCodeLen);
			}
			addToolSettings();
			handleAction(tool, true);
		});

		// Handle mouse move. 
		body.mousemove(function(ev) {
			// Sync with the tick so coords send are the same used for drawing
			if($.now() - lastEmit > mouseEmitInterval) { 
				tool.newCoord = getMousePos(ev);
				if (tool.state == "start") {
					tool.state = "drawing";
				}
				addToolSettings();
				if (tool.newCoord == null) {
					stopDrawing();
				} else {
					handleAction(tool, true);
				}
				lastEmit = $.now();
			}
			tool.prevCoord = tool.newCoord;
		});

		// stop drawing if mouse up or mouse leaves canvas
		body.mouseup(stopDrawing);
		body.mouseleave(stopDrawing);

		// Listen for new drawing data from the server
		socket.on("update_drawing", receiveDrawing);
		socket.on("add_layer", receiveLayer);
		socket.on("receive_mouse_coords", receiveTool);

		getDrawing();
	}

	/* TOOL METHODS */
	function drawLine(tool, emit) {
		var thisCtx = ctx;
		if (!emit) { // if it came from remote user, draw on a different canvas
			var peerCanvas = createPeerCanvas(tool);
			thisCtx = peerCanvas[0].getContext("2d");
		}
		var destData = thisCtx.getImageData(0, 0, width, height);
		var colour = parseColour(tool.colourFg);
		plotLine(destData.data, colour, tool.prevCoord.x, tool.prevCoord.y, tool.newCoord.x, tool.newCoord.y);
		thisCtx.putImageData(destData, 0, 0);




		// thisCtx.beginPath();
		// thisCtx.moveTo(tool.prevCoord.x, tool.prevCoord.y);
		// thisCtx.lineTo(tool.newCoord.x, tool.newCoord.y);
		// thisCtx.strokeStyle = tool.colourFg;
		// thisCtx.lineCap = "round";
		// thisCtx.lineJoin = "round";
	 //  	thisCtx.lineWidth = tool.brushSize;
		// thisCtx.stroke()
		// thisCtx.closePath();
	}

	// from http://members.chello.at/easyfilter/bresenham.js
	function plotLine(data, colour, x0, y0, x1, y1)
	{
		var dx =  Math.abs(x1-x0), sx = x0<x1 ? 1 : -1;
		var dy = -Math.abs(y1-y0), sy = y0<y1 ? 1 : -1;
		var err = dx+dy, e2;

		for (;;) {
			setColour(data, x0, y0, colour);
			if (x0 == x1 && y0 == y1) break;
			e2 = 2*err;
			if (e2 >= dy) { err += dy; x0 += sx; }
			if (e2 <= dx) { err += dx; y0 += sy; }
		}
	}

	function flood(tool, emit) {
		// // step 1. find the background images
		var elements = []
		$(".drawing_layer").each(function() {
			elements.push($(this));
		});

		// sort the background images
		elements.sort(function(eA, eB) {
			var zA = parseInt(eA.css("z-index"));
			var zB = parseInt(eB.css("z-index"));
			if (zA < zB) {
				return -1;
			}
			if (zA > zB) {
				return 1;
			}
			return 0; // should not actually happen
		});

		// Draw the background images onto a flood fill canvas
		var scatchCanvas = floodCanvas[0];
		scatchCanvas.setAttribute("width", width);
		scatchCanvas.setAttribute("height", height);
		var scratchCtx = scatchCanvas.getContext('2d'); // the user editable element
		scratchCtx.clearRect(0, 0, width, height); // Clear the canvas - pretty important

		for (var i = 0; i < elements.length; i++) {
			var el = elements[i];
			var left = parseInt(el.css("left"));
			var top = parseInt(el.css("top"));
			scratchCtx.drawImage(el[0], left, top);	
		}
	

		// Get the colours from the background image and tool
		var oldColour = scratchCtx.getImageData(tool.newCoord.x, tool.newCoord.y, 1, 1).data;
		var newColour = parseColour(tool.colourFg);

		floodFill(scratchCtx, ctx, tool.newCoord.x, tool.newCoord.y, oldColour, newColour);
	}

	// Non-recursive flood fill algo
	// Adapted from https://stackoverflow.com/questions/21865922/non-recursive-implementation-of-flood-fill-algorithm
	function floodFill(sourceCtx, destCtx, x, y, oldColour, newColour) {
		var sourceData = sourceCtx.getImageData(0, 0, width, height);
		var destData = destCtx.getImageData(0, 0, width, height);
		var queue = []

		queue.push([x, y]);
		while(queue.length > 0) {

			// Retrieve the next x and y position of cursor
			var coords = queue.pop();

			var x = coords[0];
			var y = coords[1];
			
			var sourceColour = getColour(sourceData.data, x, y);
			var destColour = getColour(destData.data, x, y);

	        if( // Found different colour in original image?
	        	!rgbaEqual(sourceColour, oldColour) ||

	        	// Are we hitting an area that has already been filled?
	        	rgbaEqual(destColour, newColour)
	        ) { 
	            continue;
	        }

			// At this point, we are writing data to storage
			// Data is written to canvas in later step
			setColour(sourceData.data, x, y, newColour);
			setColour(destData.data, x, y, newColour);

			// Determine another cursor movement
			if (x > 0) {
				queue.push([x - 1, y]);
		    }
		 
		    if (y > 0) {
		    	queue.push([x, y - 1]);
		    }
		 
		    if (x < width - 1) {
		 		queue.push([x + 1, y]);
		    }
		 
		    if (y < height - 1) {
		        queue.push([x, y + 1]);
		    }
		}

		// Write the new flood filled data to the canvas
		destCtx.putImageData(destData, 0, 0);
	}

	// parse CSS colour details
	function parseColour(strIn) {
		var str = strIn.replace("rgb(", "").replace("rgba(", "").replace(")", "");
		var bits = str.split(",");
		var alpha = parseFloat(bits[3]);
		out = [
			parseInt(bits[0]),
			parseInt(bits[1]),
			parseInt(bits[2]),
			Math.round(255 * (isNaN(alpha) ? 1 : alpha)) // if is nan, max alpha should be used (1)
		]
		return out;
	}

	// Get colour from image data
	function getColour(data, x, y) {
		var base = getXYBase(x, y);
		return [data[base], data[base+1], data[base+2], data[base+3]];
	}

	// from https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Pixel_manipulation_with_canvas
	function getXYBase(x, y) {
		return (y * (width * 4)) + (x * 4);
	}

	// Set colour into the image data
	function setColour(data, x, y, colour) {
		var base = getXYBase(x, y);
		data[base] = colour[0];
		data[base + 1] = colour[1];
		data[base + 2] = colour[2];
		data[base + 3] = colour[3];
	}

	function rgbaEqual(query, target) {
		for (var i = 0; i < 4; i++) {
			if (query[i] != target[i]) {
				return false; // not identical
			}
		}
		return true; // identical
	}

	function addToolSettings() {
		tool.colourFg = $("#colour_fg").css("backgroundColor");
		tool.brushSize = parseInt($("#brush_size").val());
	}

	function setupControls() {
		// set up colour picker
		$("#colour_fg").colorPicker();
		$("#paint").on("mousedown", function() {
			toggleButtons($(this));
			tool.tool = "paint";
		});
		$("#flood").on("mousedown", function() {
			toggleButtons($(this));
			tool.tool = "flood";
		});
		toggleButtons($("#paint"));
	}

	function toggleButtons(clickedElement) {
		$(".button_tool").each(function() {
			var element = $(this);
			if (element.attr("id") == clickedElement.attr("id")) {
				element.addClass("button_pressed")
			} else {
				element.removeClass("button_pressed")
			}
		});
	}

	// Stop drawing but only if already drawing
	function stopDrawing() {
		addToolSettings();
		if (tool.state == "drawing" || tool.state == "start") {
			tool.state = "end";
		}
		handleAction(tool, true);
	}

	function handleAction(tool, emit) {
		if (tool.state == "start" && tool.tool == "flood") { // flood fill - only on mousedown
			flood(tool, emit);
			processCanvasAndEmit(tool, emit);
		} else if (
			(tool.state == "start" || tool.state == "drawing") && 
			tool.tool != "flood"
		) { // drawing stroke in progress
			if (tool.tool == "paint") {
				drawLine(tool, emit);
			}
			bumpCanvas(canvas);
			if (emit) emitTool();
		} else if (tool.state == "end" && tool.tool != "flood") { // mouseup or other stroke end event
			processCanvasAndEmit(tool, emit);
		} else { // if state = "idle", do nothing except emit data with mouse coords
			if (emit) emitTool();
		}
	}

	function processCanvasAndEmit(tool, emit) {
		if (emit) {
			// convert canvas to png and send to the server
			processCanvas(canvas[0], croppingCanvas[0], tool); 
			emitTool();
			tool.state = "idle";
			tool.layerCode = null;
		}
	}

	// emit a tool action
	function emitTool(prevCoord, newCoord) { 
		var nickname = $("#nickname").val();
		socket.emit('mousemove', tool);
	}

	// receive a tool action from another user
	function receiveTool(tool) {
		var sockID = tool.socketID;
		var pointerElement = $("#drawing_pointer_"+sockID);
		if (tool.newCoord == null) {
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
		pointerElement.css({
			left: tool.newCoord.x+"px",
			top: tool.newCoord.y+"px"
		});
		var nick = !tool.nickname ? "Anonymous" : tool.nickname;
		$("#drawing_pointer_label_"+sockID).text(nick);

		handleAction(tool, false);
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

		// attempt to wrap edges - troublesome since it messes up exit behaviour
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

	function createPeerCanvas(tool) {
		var canvasID = "canvas_layer_"+tool.layerCode
		var existingCanvas = $("#"+canvasID);	
		if (existingCanvas.length == 0) {
			var buf = 
				"<canvas id=\""+canvasID+"\" "+
					"width=\""+width+"\" height=\""+height+"\" "+
					"style=\"z-index: 9000;\" "+
					"class=\"drawing_canvas\"> "+
				"</canvas>";
			$("#drawing_layers").append(buf)
			existingCanvas = $("#"+canvasID);
		}
		bumpCanvas(existingCanvas);
		return existingCanvas;
	}

	function bumpCanvas(canvasElement) {
		$(".drawing_canvas").each(function() { // shift everything else -1 on zindex
			var element = $(this);
			var zIndex = parseInt(element.css("z-index")) - 1;
			element.css("z-index", zIndex);
		});
		canvasElement.css("z-index", canvasCeiling);
	}

	function getLayerByCode(code) {
		var existingLayer = $("#canvas_layer_"+code);
		if (existingLayer.length > 0) { // avoid a duplicate element
			return existingLayer;
		}
		var existingLayer = $("#drawing_layer_"+code);
		if (existingLayer.length > 0) { // avoid a duplicate element
			return existingLayer;
		}
		return null;
	}
	
	// add layer data to the dom
	// isTemp: whether this is a temporary layer created by the client
	function renderLayerHtml(layerIDIn, layerIn, isTemp) {
		var context = {}
		context.layer = layerIn; // for scope

		// Get duplicate layer with same ID and rename its ID
		context.duplicate = getLayerByCode(context.layer.code);	
		if (context.duplicate != null) {
			context.duplicate.attr("id", "duplicate_temp");
		}

		// check if there are any component layers to remove from a flattened image
		var bump = (isTemp) ? 1000 : 0; // temporary layers always above the rest
		var newLayerID = "drawing_layer_"+context.layer.code;
		var layersHtml = 
			"<img id=\""+newLayerID+"\" class=\"drawing_layer\" "+
				"src=\""+context.layer.base64+"\" "+
				"style=\""+
					"z-index: "+(layerIDIn + bump)+"; "+
					"left: "+context.layer.offsets.left+"px; "+
					"top: "+context.layer.offsets.top+"px;\"/>";

		$("#drawing_layers").append(layersHtml);

		// use imagesLoaded library to determine when it has definitely loaded
		// this was an attempt to fix firefox flicker bug
		$("#"+newLayerID).imagesLoaded().done(function() {
			// If this is a flatten layer, removes the components
			if (typeof(context.layer["components"]) !== "undefined") {
				var codes = context.layer["components"]
				for (var i = 0; i < codes.length; i++) {
					var layer = getLayerByCode(codes[i]);
					if (layer != null) {
						layer.remove();
					}
				}
			}
			if (context.duplicate != null) {
				context.duplicate.remove();
			}
		});

		if (layerIDIn > highestLayerID) {
			highestLayerID = layerIDIn;
		}
	}

	// Converts canvas to various useful things
	function processCanvas(sourceCanvas, croppingCanvas, tool) {

		var layerCode = tool.layerCode; // must keep copy since it gets reset to null

		var cropCoords = cropCanvas(sourceCanvas, croppingCanvas);

		// First generate a png blob
		var blob = croppingCanvas.toBlob(function(blob) {

			// Generate data URL, to be displayed on the front end, from the blob
			var fr = new FileReader();
			fr.onload = function(e) {
				
				var layer = {
					drawID: drawID,
					base64: e.target.result, 
					offsets: cropCoords,
					code: layerCode
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
