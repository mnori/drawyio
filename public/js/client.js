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
				tool.state = "drawing";
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
		thisCtx.beginPath();
		thisCtx.moveTo(tool.prevCoord.x, tool.prevCoord.y);
		thisCtx.lineTo(tool.newCoord.x, tool.newCoord.y);
		thisCtx.strokeStyle = tool.colourFg;
		thisCtx.lineCap = "round";
		thisCtx.lineJoin = "round";
	  	thisCtx.lineWidth = tool.brushSize;
		thisCtx.stroke()
		thisCtx.closePath();
	}

	function flood(tool, emit) {
		// step 1. find the background image
		var backgroundImage = null;
		var backgroundZ = null;
		$(".drawing_layer").each(function() {
			var element = $(this);
			var z = parseInt(element.css("z-index"));
			if (backgroundZ == null || z > backgroundZ) {
				backgroundImage = element;
				backgroundZ = z;
			}
		});

		// Draw the background image onto a flood fill canvas
		var canvas = floodCanvas[0];
		canvas.setAttribute("width", width);
		canvas.setAttribute("height", height);
		var ctx = canvas.getContext('2d'); // the user editable element
		ctx.drawImage(backgroundImage[0], 0, 0);


    	// Fetch the RGBA colour at the position
    	var canvasColor = ctx.getImageData(0, 0, 1,1); // rgba e [0,255]
    	var rgba = canvasColor.data;

		floodFill(ctx, 0, 0, rgba, [255, 0, 0, 1]);
	}
	/* / */

	// from http://www.somethinghitme.com/2012/03/07/html5-canvas-flood-fill/
	function floodFill(ctx, x, y, oldVal, newVal) {
        if (oldVal == null){
            oldVal = ctx.getImageData(x, y, 1, 1).data;
            console.log(oldVal);
        }
 
        if(!rgbaEqual(ctx.getImageData(x, y, 1, 1).data, oldVal)) { // found flood fill edge
            return true;
        }
	 	
	 	// write data to canvas
	    // mapData[x][y] = newVal;
		ctx.fillStyle = "rgba("+newVal[0]+","+newVal[1]+","+newVal[2]+","+newVal[3]+")";
		ctx.fillRect( x, y, 1, 1 )

	    // var id = ctx.createImageData(1,1); // only do this once per page
	    // ctx.putImageData(id, x, y );     
	    // console.log("Wrote "+x+", "+y)
	 
	    if (x > 0) {
	        floodFill(ctx, x - 1, y, oldVal, newVal);
	    }
	 
	    if (y > 0) {
	        floodFill(ctx, x, y - 1, oldVal, newVal);
	    }
	 
	    if (x < width-1) {
	        floodFill(ctx, x + 1, y, oldVal, newVal);
	    }
	 
	    if (y < height-1) {
	        floodFill(ctx, x, y + 1, oldVal, newVal);
	    }
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
		if (tool.state == "drawing") {
			tool.state = "end";
		}
		handleAction(tool, true);
	}

	function handleAction(tool, emit) {
		if (tool.state == "drawing") { // drawing stroke in progress
			if (tool.tool == "paint") {
				drawLine(tool, emit);
			} else if (tool.tool == "flood") {
				flood(tool, emit);
			}
			bumpCanvas(canvas);
			if (emit) emitTool();
		} else if (tool.state == "end") { // mouseup or other stroke end event
			if (emit) {
				// convert canvas to png and send to the server
				processCanvas(canvas[0], croppingCanvas[0], tool); 
				emitTool();
				tool.state = "idle";
				tool.layerCode = null;
			}
		} else { // if state = "idle", do nothing except emit data with mouse coords
			if (emit) emitTool();
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