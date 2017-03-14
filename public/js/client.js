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
	var emitInterval = 33;
	var paintEmitInterval = emitInterval; 
	var lineEmitInterval = emitInterval; 
	var textEmitInterval = emitInterval; 
	var width = widthIn;
	var height = heightIn;
	var canvas = $("#drawing_canvas");
	var previewCanvas = $("#drawing_canvas_preview");
	var croppingCanvas = $("#crop_canvas");
	var scratchCanvas = $("#scratch_canvas"); // used by flood
	var ctx = canvas[0].getContext('2d'); // the user editable element
	var previewCtx = previewCanvas[0].getContext('2d'); // the user editable element
	var doc = $(document);
	var socket = io.connect("/drawing_socket_"+drawIdIn);
	var drawID = drawIdIn;
	var layerCodeLen = 32;
	var highestLayerID = 1;
	var lastEmit = $.now(); // part of general purpose intervalling system
	var labelFadeOutMs = 120;
	var canvasCeiling = 999999999;
	// var canvasCeiling = 1000000000;
	var colourPicker = $("#colour_picker");
	var finaliseTimeout = null;
	var finaliseTimeoutMs = 500; // mainly for brush and line drawing

	// Metadata about the action being performed
	var tool = {
		data: null,
		state: "idle",
		tool: "paint"
	};

	function setup() { 
		setupControls();
		var body = $("body");

		// Handle mouse down.
		previewCanvas.mousedown(function(ev) {
			regenLayerCode();
			// colourPicker.spectrum("get");
			pickerToToolColour();
			// colourPicker.spectrum("hide");

			if (ev.which == 3) { // right click
				activateDropperToggle();
			}
		    startTool(getMousePos(ev));
		});	

		previewCanvas.mouseenter(function(ev) {
			if (pickerVisible()) { // no mouse enter when colour picker is visible
				return;
			}
			if (event.which == 1) { // left mouse button is pressed
				regenLayerCode();
				startTool(getMousePos(ev));
			}
		})

		// Right click activates the eye dropper - not the contex menu
		previewCanvas.contextmenu(function(ev) { return false; });

		// key bindings
		body.keydown(function(ev) {
			if (ev.which == 16) { // shift
				regenLayerCode(); 
				closeSelectMenus();
				tool.rightClick = true; 
				activateDropperToggle();
				startTool(tool.newCoord); // use the old coord, since there is no mouse data
			}
		});
		body.keyup(function(ev) {
			if (ev.which == 16) { // shift
				regenLayerCode();
				resetDropperToggle(ev); 
				stopTool();
			}
		});

		// Handle mouse move. 
		body.mousemove(function(ev) {
			regenLayerCode();
			// Sync with the tick so coords send are the same used for drawing
			tool.newCoord = getMousePos(ev);

			// create new layer code if required
			// note this should be in mousemove, since we need to generate a new layer code
			// for idle previews, like with the text
			

			// keep high resolution map of line entries for processing at intervals
			if (tool.tool == "paint" && tool.state == "drawing") {
				tool.meta.lineEntries.push({"state": tool.state, "coord": tool.newCoord});
			}
			if (tool.state == "start") {
				tool.state = "drawing";
			}
			addToolSettings();

			// this is where processing occurs
			if (tool.newCoord == null && tool.tool != "eyedropper") { 
				stopTool(ev);
			} else {
				handleAction(tool, true);
			}
		});

		// stop the tool on mouseup
		doc.mouseup(stopTool);

		// if mouse leaves preview canvas or window, set newCoord to null and stop the tool
		previewCanvas.mouseleave(mouseOut);
		doc.mouseleave(mouseOut);

		// Listen for new drawing data from the server
		socket.on("update_drawing", receiveDrawing);
		socket.on("add_layer", receiveLayer);
		socket.on("receive_mouse_coords", receiveTool);

		initColourPicker();
		addToolSettings();
		getDrawing();
	}

	// Only generates the layer code if it's empty, i.e. after finalise has been called
	function regenLayerCode() {
		if (tool.layerCode == null) { 
			tool.layerCode = randomString(layerCodeLen);
		}
	}

	function mouseOut(ev) {
		tool.newCoord = null;
		stopTool(ev);
	}
	// Takes a tool and does stuff based on its data, representing what the user wants to do
	// This is used for both local and remote users when tool data is received
	function handleAction(tool, emit) {

		if (
			tool.tool == "flood" && 
			emit && tool.state == "start" && finaliseTimeout == null
		) { 
			// flood fill - only on mousedown
			// only when not working on existing processing
			// only for local user - remote user receives png rather than tool action
			flood(tool);
			finaliseEdit(tool, emit);

		} else if (
			tool.tool == "eyedropper" && // eyedropper, is local user only - not remote
			emit && (tool.state == "start" || tool.state == "drawing")
		) { 
			eyedropper(tool); 

			// still need to emit those mouse coords though - for the cursor update on the remote
			if (emit) emitTool(tool); 

		} else if (tool.tool == "paint") { // wobbly line
			handlePaint(tool, emit);

		} else if (tool.tool == "line") { // straight line
			handleLine(tool, emit);

		} else if (tool.tool == "text") { // text
			handleText(tool, emit);

		} else { // always emit those mouse coords
			if (emit) emitTool(tool);
		}
	}

	// drawing a straight line
	function handleLine(tool, emit) {
		if (tool.state == "idle") {
			if (emit) emitTool(tool);
			return; // nothing to do when idle
		}

		var thisCtx = getDrawCtx(tool, emit); 
		if (tool.state == "start" || tool.state == "drawing") {
			initBaseData(thisCtx); // only does it if there is no base data

			// This fix comes from the handlePaint method - stops the canvas from being
			// cleared between clicks
			if (emit) {
				clearFinalise();
				drawLine(tool, emit); // always draw - gives smooth local
				if ($.now() - lastEmit > lineEmitInterval) { // throttle the line preview
					lastEmit = $.now();
					emitTool(tool);
				}
			} else { // not emitting - remote user
				drawLine(tool, emit);
			}
			
			
		} else if (tool.state == "end") {
			drawLine(tool, emit);
			thisCtx.baseData = thisCtx.getImageData(0, 0, width, height);/**/
			finaliseEdit(tool, emit);
			tool.state = "idle"; // pretty important to avoid issues
		}
	}

	// free form drawing
	function handlePaint(tool, emit) {
		if (tool.state == "start" || tool.state == "drawing") { // drawing stroke in progress
			if (emit) { // local user
				// prevent line drawings getting cut off by finaliser
				clearFinalise();
				var toolOut = JSON.parse(JSON.stringify(tool));

				// must put drawPaint in the interval, since it's quite a slow operation
				if ($.now() - lastEmit > paintEmitInterval) { 
					// reached interval
					drawPaint(tool, emit); // draw onto canvas
					lastEmit = $.now();
					emitTool(toolOut); // version of tool with line coords array

				} else { 
					// not reached interval
					// remove line entries before sending to remote user
					toolOut.meta.lineEntries = null;
					emitTool(toolOut)
				}

			} else if (tool.meta.lineEntries != null) {
				// remote user - draw the line using the data
				drawPaint(tool, emit);
			} 

		} else if (tool.state == "end") { // mouseup or other line end event
			if (emit) emitTool(tool); // be sure to emit the end event
			drawPaint(tool, emit);
			finaliseEdit(tool, emit);
			tool.state = "idle"; // pretty important to avoid issues

		} else { // Tool state is idle - just send coords
			if (emit) emitTool(tool);
		}
	}

	// drawing text on the canvas
	function handleText(toolIn, emit) {
		var thisCtx = getDrawCtx(toolIn, emit); 

		// if start or moving, clear canvas and draw the text
		if (toolIn.state == "start") {
			if (emit) {
				clearFinalise();
				drawText(toolIn, emit, thisCtx); // draw text and save the snapshot
				emitTool(toolIn);
			} else {
				drawText(toolIn, emit, thisCtx);
			} 
			toolIn.state = "end";
			finaliseEdit(toolIn, emit);

		} else if (tool.state == "idle") {
			if (emit) emitTool(toolIn);
			var previewCtx = getDrawCtx(toolIn, emit, "_preview");
			previewCtx.clearRect(0, 0, width, height); // Clear the canvas
			if (toolIn.newCoord != null) {
				drawText(toolIn, emit, previewCtx);	
			}
		}
		if (toolIn.state == "end") {
			toolIn.state = "idle";
		}
	}

	// only does stuff for the local user
	// the actual processing step is on a rolling timeout
	function finaliseEdit(toolIn, emit) {
		if (emit) { // local user, not remote user
			var thisCtx = getDrawCtx(toolIn, emit); 
			toolIn.state = "end";
			var toolOut = JSON.parse(JSON.stringify(toolIn)); // don't use tool, use this!
			emitTool(toolOut);
			if (toolOut.tool == "paint" && toolOut.meta != null && toolOut.meta.lineEntries != null) {
				drawPaint(toolOut, true); // close the line last edit - resets line array	
			}
			if (finaliseTimeout != null) {
				clearTimeout(finaliseTimeout);
			}
			finaliseTimeout = setTimeout(function() {
				// Processing step
				// Convert canvas to png and send to the server
				processCanvas(canvas[0], croppingCanvas[0], toolOut, thisCtx);
				toolIn.layerCode = null;
			}, finaliseTimeoutMs);
		}
	}

	// can pass in either a preview or a drawing canvas context
	// Draw the text onto the canvas, only
	function drawText(tool, emit, thisCtx) {
		if (tool.newCoord == null) { // mouse outside boundaries
			thisCtx.clearRect(0, 0, width, height); // Clear the canvas
			return;
		}

		// This decides whether to use a local or a remote canvas
		// var thisCtx = getDrawCtx(tool, emit); 

		// Put cached image data back into canvas DOM element, overwriting earlier text preview
		thisCtx.globalAlpha = 0.4; // just for testing
		// thisCtx.putImageData(thisCtx.baseData, 0, 0);
		thisCtx.font = "30px Arial";
		thisCtx.fillText("#rekt", tool.newCoord.x, tool.newCoord.y)
		// thisCtx.globalAlpha = 1; // just for testing
		return thisCtx;
	}

	// Draw a straight line onto a canvas
	function drawLine(toolIn, emit) {

		// This decides whether to use a local or a remote canvas
		var thisCtx = getDrawCtx(toolIn, emit); 

		// Create a copy of the base data
		var previewData = thisCtx.createImageData(width, height);

		if (typeof(thisCtx.baseData) !== "undefined") {
			previewData.data.set(thisCtx.baseData.data.slice()); // slice() makes a copy of the array
		}

		// Draw a line over the cached data
		var start = toolIn.meta.startCoord
		if (start == null) {
			return;
		}
		var end = toolIn.newCoord;
		if (end == null) {
			return;
		}
		plotLine(previewData.data, toolIn, start.x, start.y, end.x, end.y);

		// Put the cached image data back into canvas DOM element
		thisCtx.putImageData(previewData, 0, 0);
	}

	/* TOOL METHODS */
	function drawPaint(toolIn, emit) {
		if (toolIn.meta == null) {
			console.log("Warning -> drawPaint called without data!");
			return;
		}
		var thisCtx = getDrawCtx(toolIn, emit);
		var destData = thisCtx.getImageData(0, 0, width, height);

		var entries = toolIn.meta.lineEntries;
		var firstCoord = entries[0].coord;

		// draw a dot to start off
		plotLine(destData.data, toolIn, firstCoord.x, firstCoord.y, firstCoord.x, firstCoord.y);

		// now draw the rest of the line
		for (var i = 1; i < entries.length; i++) {
			var prevCoord = entries[i - 1].coord;
			var thisCoord = entries[i].coord;
			plotLine(destData.data, toolIn, prevCoord.x, prevCoord.y, thisCoord.x, thisCoord.y);			
		}

		// Write data to canvas. Quite slow so should be done sparingly
		// also this copies the whole image! Could it be done faster using a slice?
		thisCtx.putImageData(destData, 0, 0);

		// Reset the coordinates cache
		var lastEntry = toolIn.meta.lineEntries[toolIn.meta.lineEntries.length - 1];
		toolIn.meta.lineEntries = [lastEntry]
	}

	function clearFinalise() {
		if (finaliseTimeout != null) { 
			// prevent stuff getting overwritten
			clearTimeout(finaliseTimeout);
			finaliseTimeout = null;
		}
	}

	function getDrawCtx(toolIn, emit, suffix) {
		if (typeof(suffix) == "undefined") {
			suffix = "";
		}
		var thisCtx;
		if (emit) {
			thisCtx = ctx; // the local user's drawing context
			if (suffix == "_preview") {
				thisCtx = previewCtx; // local user's preview context
			}
		} else { // if it came from remote user, draw on a different canvas
			var remoteCanvas = getRemoteCanvas(toolIn, suffix);
			thisCtx = remoteCanvas[0].getContext("2d");
		}
		return thisCtx;
	}

	// Return existing remote canvas. Also bumps the canvas's z-index
	function getRemoteCanvas(tool, suffix) {
		var canvasID = "canvas_layer_"+tool.layerCode+suffix;
		var existingCanvas = $("#"+canvasID);
		if (existingCanvas.length == 0) {
			createRemoteCanvas(canvasID);
			existingCanvas = $("#"+canvasID);	
		}
		bumpCanvas(existingCanvas); // also bumps preview canvas
		return existingCanvas;
	}

	function initBaseData(thisCtx) {
		if (typeof(thisCtx.baseData) == "undefined") {
			// Initialise the base data cache
			thisCtx.baseData = thisCtx.getImageData(0, 0, width, height);
		}
	}

	function setupControls() {
		$("#paint").on("mousedown", function() {
			toggleButtons($(this).attr("id"));
			tool.tool = "paint";
		});
		$("#flood").on("mousedown", function() {
			toggleButtons($(this).attr("id"));
			tool.tool = "flood";
		});
		$("#eyedropper").on("mousedown", function(f) {
			toggleButtons($(this).attr("id"));
			tool.tool = "eyedropper";
		});
		$("#line").on("mousedown", function() {
			toggleButtons($(this).attr("id"));
			tool.tool = "line";
		});
		$("#text").on("mousedown", function() {
			toggleButtons($(this).attr("id"));
			tool.tool = "text";
		});

		initBrushSizeMenu();
		toggleButtons("paint");

		$(window).on("resize", function() {
			// reposition things that need repositioning
			positionBrushSizeMenu();

			// gets fired before the spectrum has at it
			positionColourPicker();
		});
	}

	function initBrushSizeMenu() {
		var brushSize = $("#brush_size");
		brushSize.selectmenu({ // might need a window resize handler here

			// When the menu opens, reposition to the desired location to the left of the tool
			open: positionBrushSizeMenu,
			close: function(ev) {
				var button = $("#brush_size-button");
				button.removeClass("button_pressed");
				button.blur();
			},

			create: setBrushSizeLabel,
			select: setBrushSizeLabel
		});

		$("#brush_size-button").addClass("button_tool");
	}

	function positionBrushSizeMenu() {
		var menu = $("#brush_size-menu").parent();
		if (menu.css("display") == "none") {
			return; // menu not active, nothing to do
		}
		var button = $("#brush_size-button");

		menu.hide(); // hide to avoid scroll bar problem
		var offset = button.offset(); // the offset will now be consistent
		menu.show();

		// get the parent element and reposition it
		menu.css({
			"top": (offset.top - menu.height() + 45 + 2)+"px",
			"left": (offset.left - menu.width())+"px",
			"z-index": 100000000000012
		});
		$("#brush_size-button").addClass("button_pressed");
	}

	function closeSelectMenus() {
		$("#brush_size-button").removeClass("button_pressed");
		$("#brush_size").selectmenu("close");
	}

	function setBrushSizeLabel() {
		var brushSize = $("#brush_size");
		var widget = brushSize.selectmenu("widget");
		widget.html(
			"<span class=\"ui-selectmenu-text\">"+
				"<i class=\"fa fa-caret-left\" aria-hidden=\"true\"></i>&nbsp;"+$(this).val()+
			"</span>"
		);
	}

	function initColourPicker() {
		colourPicker.spectrum({
			showAlpha: false,
			cancelText: "Cancel",
	        chooseText: "OK",
			show: positionColourPicker
		});
	}

	function positionColourPicker() {
		var offset = $(".sp-light").first().offset();
		var panel = $(".sp-container").first(); 
		panel.css({
			"top": (offset.top)+"px",
			"left": (offset.left - panel.width())+"px",
			"z-index": 100000000000012
		});
	}

	function pickerVisible() {
		var panel = $(".sp-container").first(); 
		if (!panel.hasClass("sp-hidden")) {
			return true;
		}
		return false;
	}

	function pickerToToolColour() {
		tool.colourFg = colourPicker.spectrum("get").toRgbString();
	}

	// Start drawing using the local tool
	function startTool(coord) {
		tool.newCoord = coord;
		if (tool.newCoord == null) { // make sure mouse is within canvas
			return;
		}
		// only when outside the timeout
		tool.state = "start";
		// only create new layer code when outside rolling timeout, or when there is no layer code yet

		// do we need to set the tool data?
		if (tool.tool == "paint") { // paints have a list of entries
			// TODO put this in a "data" property
			tool.meta = {"lineEntries": [{"state": tool.state, "coord": tool.newCoord}]};
			lastEmit = $.now();
		} else if (tool.tool == "line") {
			initLine(tool);
		} else { // tool does not have a data attribute
			tool.meta = null;
		}

		addToolSettings();
		handleAction(tool, true);
	}

	function initLine(tool) {
		tool.meta = {startCoord: tool.newCoord}
	}

	// Stop drawing but only if already drawing
	function stopTool(ev) {
		if (tool.state == "drawing" || tool.state == "start") {
			tool.state = "end";
		}
		handleAction(tool, true);

		// reset after using the eye dropper tool
		// but only if CTRL is not pressed
		if (tool.dropperToggle) { 
			resetDropperToggle(ev);
		}
	}

	function activateDropperToggle() {
		tool.dropperToggle = true;
		tool.prevTool = tool.tool;
		tool.tool = "eyedropper";
		toggleButtons(tool.tool);
	}

	function resetDropperToggle() {
		tool.dropperToggle = false;
		tool.tool = tool.prevTool;
		if (tool.tool == "line") {
			initLine(tool)
		}
		toggleButtons(tool.tool);
	}

	function makeCircle(toolIn) {
		var radius = toolIn.brushSize;
		var circleData = [];
		for (x = 0; x < radius * 2 + 1; x++) {
			var yData = []
			for (y = 0; y < radius * 2 + 1; y++) {
				var isCircle = ((x - radius) * (x - radius) + (y - radius) * (y - radius)) <= radius * radius
				if (isCircle) {
					yData.push(true);
				} else {
					yData.push(false);
				}
			}
			circleData.push(yData)
		}
		return circleData;
	}

	// Plot a line using non-antialiased circle
	// TODO pass in coord obj instead of seperate xy
	function plotLine(data, toolIn, x0, y0, x1, y1) {
		var circleData = makeCircle(toolIn);
		var colour = parseColour(toolIn.colourFg);
		var dx =  Math.abs(x1-x0), sx = x0<x1 ? 1 : -1;
		var dy = -Math.abs(y1-y0), sy = y0<y1 ? 1 : -1;
		var err = dx+dy, e2;

		for (;;) {
			var offset = -toolIn.brushSize;
			for (var x = 0; x < circleData.length; x++) {
				for (var y = 0; y < circleData[x].length; y++) {
					if (circleData[x][y] == true) {
						var xCirc = x0 + offset + x;
						var yCirc = y0 + offset + y;
						if (
							xCirc >= 0 && xCirc < width && 
							yCirc >= 0 && yCirc < height
						) {
							setColour(data, xCirc, yCirc, colour);	
						}
						
					}
				}
			}

			if (x0 == x1 && y0 == y1) break;
			e2 = 2*err;
			if (e2 >= dy) { err += dy; x0 += sx; }
			if (e2 <= dx) { err += dx; y0 += sy; }
		}
	}

	function eyedropper(tool) {
		if (tool.newCoord == null) { // can happen outside of canvas area
			return;
		}
		// get the colour from the scratch canvas at the given coordinate
		var scratchCtx = drawScratchCanvas();
		var col = scratchCtx.getImageData(tool.newCoord.x, tool.newCoord.y, 1, 1).data;
		tool.colourFg = "rgba("+col[0]+", "+col[1]+", "+col[2]+", "+col[3]+")";
		colourPicker.spectrum("set", tool.colourFg);
	}

	function flood(tool) {
		// Create a flattened canvas to draw from
		var scratchCtx = drawScratchCanvas();

		// Get the colours from the background image and tool
		var oldColour = scratchCtx.getImageData(tool.newCoord.x, tool.newCoord.y, 1, 1).data;
		var newColour = parseColour(tool.colourFg);
		floodFill(scratchCtx, ctx, tool.newCoord.x, tool.newCoord.y, oldColour, newColour);
	}

	function drawScratchCanvas() {
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
		var scatchCanvas = scratchCanvas[0];
		scatchCanvas.setAttribute("width", width);
		scatchCanvas.setAttribute("height", height);
		var scratchCtx = scatchCanvas.getContext('2d'); // the user editable element
		scratchCtx.clearRect(0, 0, width, height); // Clear the canvas

		for (var i = 0; i < elements.length; i++) {
			var el = elements[i];
			var left = parseInt(el.css("left"));
			var top = parseInt(el.css("top"));
			scratchCtx.drawImage(el[0], left, top);	
		}

		return scratchCtx;
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
			var tolerance = 3;

	        if( // Found different colour in original image?
	        	!rgbaEqual(sourceColour, oldColour, tolerance) ||

	        	// Are we hitting an area that has already been filled?
	        	rgbaEqual(destColour, newColour, tolerance)
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
		return (Math.floor(y) * (width * 4)) + (Math.floor(x) * 4);
	}

	// Set colour into the image data
	function setColour(data, x, y, colour) {
		var base = getXYBase(x, y);
		data[base] = colour[0];
		data[base + 1] = colour[1];
		data[base + 2] = colour[2];
		data[base + 3] = colour[3];
	}

	function rgbaEqual(query, target, tolerance) {
		for (var i = 0; i < 4; i++) {

			// exact match
			// if (query[i] != target[i]) {
			// 	return false; // not identical
			// }

			// tiny differences allowed - hack to fix flood fill bug
			if (Math.abs(query[0] - target[0]) > tolerance ||
				Math.abs(query[1] - target[1]) > tolerance ||
				Math.abs(query[2] - target[2]) > tolerance ||
				Math.abs(query[3] - target[3]) > tolerance
			) {
				return false;
			}

		}
		return true; // identical
	}

	function addToolSettings() {
		pickerToToolColour();

		// calculate the radius from the value coming in
		tool.brushSize = (parseInt($("#brush_size").val()) - 1) / 2;
	}

	function toggleButtons(elementID) {
		var selectedElement = $("#"+elementID);
		$(".button_tool").each(function() {
			var element = $(this);
			if (element.attr("id") == selectedElement.attr("id")) {
				element.addClass("button_pressed")
			} else {
				element.removeClass("button_pressed")
			}
		});
		if (elementID == "text") {
			toggleTextInput();
		}
	}

	function toggleTextInput() {
		($("#text_input").css("display") == "none") ? openTextInput() : closeTextInput();
	}

	function openTextInput() {
		$("#text_input").show();
	}

	function closeTextInput() {
		$("#text_input").hide();
	}

	// emit a tool action
	function emitTool(toolIn) { 
		var nickname = $("#nickname").val();
		socket.emit('receive_tool', toolIn);
	}

	// receive a tool action from another user
	function receiveTool(tool) {
		var sockID = tool.socketID;
		var pointerElement = $("#drawing_pointer_"+sockID);

		if (tool.newCoord == null) {
			pointerElement.fadeOut(labelFadeOutMs, function() {
				pointerElement.remove();
			});
			handleAction(tool, false);
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
			// could this be deleting stuff?
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

		if (ev.clientX == undefined || ev.clientY == undefined) {
			return null;
		}

		/* round() is buggy? */
		var mousePos = {
			x: Math.round(ev.clientX - rect.left),
			y: Math.round(ev.clientY - rect.top)
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

		// // lets deliberately break it
		// mousePos.x += 0.01;
		// mousePos.y += 0.01;
		return mousePos;
	}

	function createRemoteCanvas(canvasID) {
		var buf = 
			"<canvas id=\""+canvasID+"\" "+
				"width=\""+width+"\" height=\""+height+"\" "+
				"style=\"z-index: 0;\" "+ // bumpCanvas will take care of the z-index
				"class=\"drawing_canvas\"> "+
			"</canvas>"+

			// this is the preview canvas
			// because it's situated above the drawing canvas, it will always be displayed
			// above it in the stacking order. So we don't need to worry about z-index being
			// the same as the preview element.
			// Good explanation can be found here
			// https://philipwalton.com/articles/what-no-one-told-you-about-z-index/
			"<canvas id=\""+canvasID+"_preview\" "+
				"width=\""+width+"\" height=\""+height+"\" "+
				"style=\"z-index: 0;\" "+ // bumpCanvas will take care of the z-index
				"class=\"drawing_canvas\"> "+
			"</canvas>";
		$("#drawing_layers").append(buf)
	}

	function bumpCanvas(canvasElement) {
		$(".drawing_canvas").each(function() { // shift everything else -1 on zindex
			var element = $(this);
			var zIndex = parseInt(element.css("z-index")) - 1;
			element.css("z-index", zIndex);
			// previewElement.css("z-index", zIndex);
		});

		// move the canvas of interest to the top position
		var previewElement = $("#"+canvasElement.attr("id")+"_preview");
		canvasElement.css("z-index", canvasCeiling);
		previewElement.css("z-index", canvasCeiling);
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
		context.previewDuplicate = getLayerByCode(context.layer.code+"_preview");
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

					// Delete component layers
					var layer = getLayerByCode(codes[i]);
					if (layer != null) {
						layer.remove();
					}
					var previewLayer = getLayerByCode(codes[i]);
					if (previewLayer != null) {
						previewLayer.remove();
					}
				}
			}
			if (context.duplicate != null) {
				// Delete duplicate layer
				context.duplicate.remove();
			}
			if (context.previewDuplicate != null) {
				context.previewDuplicate.remove();
			}
		});

		if (layerIDIn > highestLayerID) {
			highestLayerID = layerIDIn;
		}
	}

	// Turn a canvas into an image which is then sent to the server
	// Image is smart cropped before sending to save server some image processing
	function processCanvas(sourceCanvas, croppingCanvas, toolIn) {

		var layerCode = toolIn.layerCode; // must keep copy since it gets reset to null

		// gotta swap the data around to get the correct crop when it's the text tool
		var cropCoords = cropCanvas(sourceCanvas, croppingCanvas, toolIn);

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
				ctx.clearRect(0, 0, width, height)

				// Clear the baseData
				if (toolIn.tool == "line") {
					delete ctx.baseData;
				}

				// Now convert to base64 - this will be send back to the server
				var fr = new window.FileReader();
				fr.readAsDataURL(blob); 
				fr.onloadend = function() {
					var base64 = fr.result;
					socket.emit("add_layer", layer);
					finaliseTimeout = null; 
				}
			}
			fr.readAsDataURL(blob);

		}, "image/png");
	}

	setup();
}

// Crop a sourceCanvas by alpha=0. Results are written to destCanvas.
// Adapted from https://stackoverflow.com/questions/12175991/crop-image-white-space-automatically-using-jquery
function cropCanvas(sourceCanvas, destCanvas, toolIn) {
    var context = sourceCanvas.getContext("2d");

    var imgWidth = sourceCanvas.width, 
    	imgHeight = sourceCanvas.height;

	var imageData = context.getImageData(0, 0, imgWidth, imgHeight);
	
    var data = imageData.data,
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
// function sleep(ms) {
// 	return new Promise(resolve => setTimeout(resolve, ms));
// }

function randomString(length) {
    var text = "";
    var charset = "abcdefghijklmnopqrstuvwxyz0123456789";
    for (var i = 0; i < length; i++) { 
        text += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    return text;
}
