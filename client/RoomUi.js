// This handles the room page, where the drawing happens.
// Contains lots of code that will be made redundant once the new pixi.js renderer 
// is fully working

function RoomUi() {

	this.init = function() { 

		// Define a bunch of variables and objects
		this.drawID = opts["roomID"];
		this.width = opts["width"];
		this.height = opts["height"];
		this.emitInterval = 16; // ~= 30FPS
		this.paintEmitInterval = this.emitInterval;
		this.lineEmitInterval = this.emitInterval;
		this.mouseEmitInterval = 16; // throttle all misc mouse output

		this.croppingCanvas = $("#crop_canvas");

		this.doc = $(document);
		this.socket = io.connect("/drawing_socket_"+self.drawID);
		this.layerCodeLen = 32;
		this.modDialog = new ModDialog("room", self.drawID);

		// Delete a remote canvas after a certain amount of time
		this.remoteCanvasDeleteCutoff = 4000;
		this.labelFadeOutMs = 120;	
		this.canvasCeiling = 999999999;
		this.colourPicker = $("#colour_picker");
		this.finaliseTimeout = null;

		// finaliseTimeoutMs is a rolling timeout parameter for processing the canvas
		// High value = less server load but inferior user experience
		this.finaliseTimeoutMs = 1000; 

		// This timeout handles the pointer fading when inactive
		this.pointerTimeoutMs = 4000;
		this.textMargin = 10; // pixels to offset the text box preview
		this.defaultText = "Enter text";
		this.brushSizeMenu = null; // initialised later
		this.fontSizeMenu = null; // initialised later
		this.fontFaceMenu = null
		this.toolInCanvas = false;

		// Metadata about the action being performed
		this.toolManager = new ToolManager();
		this.drawUi = new DrawUi(this);
		this.tester = new DrawUiTester(this);
		this.lastEmit = $.now(); // part of general purpose intervalling system

		this.renderCanvas = $("#renderer");

		// Final setup steps
		self.newLocal();
		self.initUi();
		self.getDrawing();
	}

	this.initUi = function() {
		var body = $("body");

		// Handle cursor down
		self.renderCanvas.on("pointerdown", $.proxy(function(ev) { 
			self.pickerToToolColour();
			if (ev.which == 3) { // right click
				if (menusOpen()) {
					return;
				}
				self.activateDropperToggle();
			}
			var tool = self.toolManager.getLocalTool();
			self.startTool(self.getMousePos(ev), tool);
			return false;
		}, this));

		// Handle cursor entering canvas 
		self.renderCanvas.on("pointerenter", function(ev) {
			self.toolInCanvas = true;
			if (self.pickerVisible()) { // no mouse enter when colour picker is visible
				return;
			}
			if (event.which == 1) { // left mouse button is pressed
				var tool = self.toolManager.getLocalTool();
				self.startTool(self.getMousePos(ev), tool);
			}
		});

		// Handle cursor movement
		// This function gets called about 60 frames per second. Each event parameter contains
		// a list of coalesced events that happened over about 1/60th of a second. By processing
		// the subevents we can draw a smooth line at max time resolution
		self.renderCanvas.on("pointermove", function(ev) {

			var tool = self.toolManager.getLocalTool();

			// Change tool state to drawing if we're at the beginning of a tool action
			if (tool.state == "start") {
				tool.state = "drawing";
			}
					
			// Loop through events in the frame 
			// This call won't work in shitty browsers like IE or Safari. So we probably want
			// a message somewhere telling those users to sort their shit out.
			var events = ev.originalEvent.getCoalescedEvents();
			for (var i = 0; i < events.length; i++) {
				var coalescedEvent = events[i];

				// This is where processing occurs
				tool.newCoord = self.getMousePos(coalescedEvent);
				if (tool.tool == "paint" && tool.state == "drawing") {
					tool.meta.lineEntries.push({"state": tool.state, "coord": tool.newCoord});
				}
			}
			if (tool.newCoord == null && tool.tool != "eyedropper") { 
				self.stopTool(tool);
			} else {
				self.handleAction(tool, true);
			}
			return false;
		});

		// Right click activates the eye dropper - not the contex menu
		self.renderCanvas.contextmenu(function(ev) { return false; });

		// key bindings
		body.keydown($.proxy(function(ev) {
			var tool = self.toolManager.getLocalTool();
			if (ev.which == 16) { // shift - select the colour picker
				if (menusOpen()) {
					return;
				}
				self.closeMenus();
				self.activateDropperToggle();
				self.startTool(tool.newCoord, tool); // use the old coord, since there is no mouse data

			} else if ( // Text box enter key handler
				ev.which == 13 && 
				tool.tool == "text" &&
				!$("#text_input").is(":visible")
			) {
				self.openTextInput();
			} else if (ev.which == 27 && tool.tool == "text") {
				self.closeTextInput()
			}


		}, this));
		body.keyup($.proxy(function(ev) {
			if (ev.which == 16) { // shift
				if (self.menusOpen()) {
					return;
				}
				self.resetDropperToggle(ev); 
				var tool = self.toolManager.getLocalTool();
				self.stopTool(tool);
			}
		}, this));

		// stop the tool on mouseup
		self.doc.on("pointerup", function() {
			var tool = self.toolManager.getLocalTool();
			self.stopTool(tool);
		});

		// if mouse leaves preview canvas or window, set newCoord to null and stop the tool
		self.renderCanvas.on("pointerleave", self.mouseOut);
		self.doc.on("pointerleave", self.mouseOut);

		// Listen for new drawing data from the server
		self.socket.on("update_drawing", self.receiveDrawing);
		self.socket.on("add_layer", self.receiveLayer);
		self.socket.on("receive_mouse_coords", self.receiveTool);
		self.socket.on("disconnect", self.onDisconnect);

		// disable mouse select on drawing page
		$("body").attr("style", 
			"<style> "+
			"	-webkit-touch-callout: none;"+
			"	-webkit-user-select: none;"+
			"	-khtml-user-select: none;"+
			"	-moz-user-select: none;"+
			"	-ms-user-select: none;"+
			"	user-select: none;"+
			"</style>"
		);
		
		self.initColourPicker();
		self.setupControls();
	}

	this.onDisconnect = function() {
		$("#disconnected_indicator").show();
	}

	// Only generates the layer code if it's empty, i.e. after finalise has been called
	this.newLocal = function() {
		var tool = self.toolManager.getLocalTool();
		tool.layerCode = self.randomString(self.layerCodeLen);
		var oldCanvas = self.drawUi.newLocal(tool.layerCode);
		return oldCanvas;
	}

	this.randomString = function(length) {
		var text = "";
		var charset = "abcdefghijklmnopqrstuvwxyz0123456789";
		for (var i = 0; i < length; i++) { 
			text += charset.charAt(Math.floor(Math.random() * charset.length));
		}
		return text;
	}

	this.mouseOut = function(ev) {
		var tool = self.toolManager.getLocalTool();
		tool.newCoord = null;
		self.toolInCanvas = false;
		self.stopTool(tool);
	}
	// Takes a tool and does stuff based on its data, representing what the user wants to do
	// This is used for both local and remote users when tool data is received
	this.handleAction = function(tool, emit) {

		if (emit) self.pickerToToolColour(); // everything except eyedropper has a tool colour
		if (
			tool.tool == "eyedropper" && // eyedropper, is local user only - not remote
			emit && (tool.state == "start" || tool.state == "drawing")
		) { 
			self.eyedropper(tool); 

			// still need to emit those mouse coords though - for the cursor update on the remote
			if (emit) self.emitToolInterval(tool); 

		} else if (tool.tool == "paint" || tool.tool == "test") { // free drawn line
			self.handlePaint(tool, emit);

		} else if (tool.tool == "line") { // straight line
			self.handleLine(tool, emit);

		} else if (tool.tool == "text") { // text
			self.handleText(tool, emit);

		} else { // always emit those mouse coords
			if (emit) self.emitToolInterval(tool);
		}
	}

	// drawing a straight line between two points
	this.handleLine = function(tool, emit) {
		if (tool.state == "idle") {
			if (emit) self.emitToolInterval(tool);
			return; // nothing to do when idle
		}

		var thisCtx = self.getDrawCtx(tool, emit); 
		if (tool.state == "start" || tool.state == "drawing") {
			if (tool.state == "start") {
				// for lines, base data is the data without the line preview data
				// it means we can drag a line around on the screen and refresh it
				// with the stuff behind it
				self.initBaseData(thisCtx); 
			}

			if (emit) {
				self.readBrushSize(tool);
				self.clearFinalise();
				self.drawLine(tool, emit); // always draw - gives smooth local
				if ($.now() - self.lastEmit > self.lineEmitInterval) { // throttle the line preview
					self.lastEmit = $.now();
					self.emitTool(tool);
				}
			} else { // not emitting - remote user
				self.drawLine(tool, emit);
			}
			
			
		} else if (tool.state == "end") {
			// draw line data onto canvas
			// remember, drawLine is not async. so we can't settimeout it
			self.drawLine(tool, emit);

			// get the line data from the canvas, set into baseData.
			// this is the final line drawing
			thisCtx.baseData = thisCtx.getImageData(0, 0, self.width, self.height);
			self.finaliseEdit(tool, emit);
			tool.state = "idle"; // pretty important to avoid issues
		}
	}

	// free form drawing
	this.handlePaint = function(toolIn, emit) {

		var renderID = toolIn.layerCode;
		if (toolIn.state == "start" || toolIn.state == "drawing") { // drawing stroke in progress
			if (emit) { // local user
				self.readBrushSize(toolIn);
				self.clearFinalise(); // prevent line drawings getting cut off by finaliser
				var toolOut = JSON.parse(JSON.stringify(toolIn));

				// ensures that starting creates a dot on mousedown
				if (toolIn.state == "start") {
					self.drawUi.startStroke(renderID, toolIn); // initialise the stroke
					self.drawPaint(toolIn, emit);
					self.emitTool(toolOut);
				}

				// must put drawPaint in the interval, since it's quite a slow operation
				if ($.now() - self.lastEmit > self.paintEmitInterval) { 
					// reached interval
					self.drawPaint(toolIn, emit); // draw onto canvas
					self.lastEmit = $.now();
					self.emitTool(toolOut); // version of tool with line coords array

				}
			} else if (toolIn.meta.lineEntries != null) {
				// remote user - draw the line using the data
				if (toolIn.state == "start") {
					self.drawUi.startStroke(renderID, toolIn);
				}
				self.drawPaint(toolIn, emit);
			} 

		} else if (toolIn.state == "end") { // mouseup or other line end event
			if (emit) self.emitTool(toolIn); // be sure to emit the end event
			toolIn.state = "idle"; // pretty important to avoid issues
			self.drawPaint(toolIn, emit);
			self.drawUi.endStroke(renderID, toolIn);
			self.finaliseEdit(toolIn, emit);

		} else { // Tool state is idle - just send coords
			if (emit) self.emitToolInterval(toolIn);
		}
		// tl.dump();
	}

	// drawing text on the canvas
	this.handleText = function(toolIn, emit) {
		var thisCtx = self.getDrawCtx(toolIn, emit); // won't work - @deprecated

		// intialise the text tool meta if required
		// undefined check should probably actually be about checking the tool name
		if (emit && (toolIn.meta == null || typeof(toolIn.meta.text) === "undefined")) {
			self.initTextMeta(toolIn);
		}
		if (emit) {
			self.readFontSize(toolIn);
			self.readFontFace(toolIn);
		}

		// if start or moving, clear canvas and draw the text
		if (toolIn.state == "start") {
			if (emit) { // Local text click and place
				if (!self.checkTextBox(tool)) {
					return;
				}
				self.clearFinalise();
				self.drawText(toolIn, emit, thisCtx); // draw text and save the snapshot
				$("#text_input_box").val(self.defaultText);
				$("#text_input").hide();
				self.emitTool(toolIn);
				self.initTextMeta(toolIn);

			} else { // Remote text click and place
				self.drawText(toolIn, emit, thisCtx);
			} 
			toolIn.state = "end";
			self.finaliseEdit(toolIn, emit);

		} else if (toolIn.state == "idle") {
			self.textIdle(toolIn, emit);
		}
		if (toolIn.state == "end") {
			toolIn.state = "idle";
		}
	}

	// Create an empty array of booleans which will store information about 
	// the current stroke
	this.makeStrokeData = function() {
		var out = new Array(self.width);
		for (var x = 0; x < self.width; x++) {
			out[x] = new Array(self.height);
			for (var y = 0; y < self.height; y++) {
				out[x][y] = false;
			}
		}
		return out;
	}

	this.checkTextBox = function(toolIn) {
		// no text has been entered, open the text input to hint that it is required
		if (toolIn.tool == "text" && toolIn.meta.text == "") { 
			self.openTextInput(); // make sure text input box is open
			// $("#text_input_box").select(); // doesn't seem to work :(
			toolIn.state = "end";
			return false;
		}
		return true;
	}

	this.initTextMeta = function(toolIn) {
		toolIn.meta = {
			"text": "",
			"fontFace": "ubuntuRegular",
			"fontSize": null
		}
	}

	this.textIdle = function(toolIn, emit) {
		if (emit) self.emitToolInterval(toolIn);
		var previewCtx = self.getDrawCtx(toolIn, emit, "_preview");
		previewCtx.clearRect(0, 0, self.width, self.height); // Clear the canvas
		if (!emit || self.toolInCanvas) {
			self.drawText(toolIn, emit, previewCtx);	
		}
	}

	// only does stuff for the local user
	// the actual processing step is on a rolling timeout
	this.finaliseEdit = function(toolIn, emit) {
		if (!emit) { 
			return // is remote user
		}

		// this bit is local user only
		// Copy the tool so we can modify it before sending to client
		var toolOut = JSON.parse(JSON.stringify(toolIn));
		toolOut.state = "end";
		if (self.finaliseTimeout != null) {
			// ah but what if finaliseTimeout is already running?
			// you'll get two timeouts overlapping each other
			clearTimeout(self.finaliseTimeout);
		}
		self.finaliseTimeout = setTimeout(function() {
			// Processing step
			// Convert canvas to png and send to the server
			self.processCanvas(toolOut);

		}, self.finaliseTimeoutMs);
	}

	// can pass in either a preview or a drawing canvas context
	// Draw the text onto the canvas, only
	this.drawText = function(toolIn, emit, thisCtx) {
		if (toolIn.newCoord == null) { // mouse outside boundaries
			thisCtx.clearRect(0, 0, self.width, self.height); // Clear the canvas
			return;
		}
		// Put cached image data back into canvas DOM element, overwriting earlier text preview
		// thisCtx.globalAlpha = 1; // just for testing
		thisCtx.font = toolIn.meta.fontSize+"px "+toolIn.meta.fontFace;
		thisCtx.fillStyle = toolIn.colour;
		thisCtx.textAlign = "right";

		// Position the text next to the cursor
		var coords = {
			x: toolIn.newCoord.x - self.textMargin,
			y: toolIn.newCoord.y + (Math.ceil(toolIn.meta.fontSize / 2))
		}
		thisCtx.fillText(toolIn.meta.text, coords.x, coords.y)
		return thisCtx;
	}

	// Draw a straight line onto a canvas
	this.drawLine = function(toolIn, emit) {

		// This decides whether to use a local or a remote canvas
		var thisCtx = getDrawCtx(toolIn, emit); 
		thisCtx.strokeData = self.makeStrokeData();

		// Create a copy of the base data
		// must create empty data first
		var previewData = thisCtx.createImageData(self.width, self.height);
		if (typeof(thisCtx.baseData) !== "undefined") {
			// fill out the empty preview data with base data
			previewData.data.set(thisCtx.baseData.data.slice()); 
		}

		// Check both coords are present
		// This is expected when the mouse is outside the canvas
		// (TODO: this probably isn't working right with new system)
		if (toolIn.meta == null) {
			return;
		}
		var start = toolIn.meta.startCoord
		if (start == null) {
			return;
		}
		var end = toolIn.newCoord;
		if (end == null) {
			return;
		}

		// Draw a line over the copied data
		// TODO - currently not working with new system
		self.plotLine(thisCtx, previewData.data, toolIn, start.x, start.y, end.x, end.y);

		// Put the modified image data back into canvas DOM element
		thisCtx.putImageData(previewData, 0, 0);
	}

	this.drawPaint = function(toolIn, emit) {
		// drawPaintOld(toolIn, emit);
		self.drawPaintPixi(toolIn, emit);

		// Reset the coordinates cache
		var lastEntry = toolIn.meta.lineEntries[toolIn.meta.lineEntries.length - 1];
		toolIn.meta.lineEntries = [lastEntry]
	}

	// Draw free form line onto canvas
	this.drawPaintPixi = function(toolIn, emit) {
		if (toolIn.meta == null) {
			console.warn("DrawPaint called without data!");
			return;
		}

		var renderID = toolIn.layerCode;
		var entries = toolIn.meta.lineEntries;
		var firstCoord = entries[0].coord;

		if (firstCoord != null) {
			self.drawUi.plotLine(renderID, firstCoord.x, firstCoord.y, firstCoord.x, firstCoord.y);
		}

		// now draw the rest of the line
		for (var i = 1; i < entries.length; i++) {
			var prevCoord = entries[i - 1].coord;
			var thisCoord = entries[i].coord;
			if (prevCoord == null || thisCoord == null) {
				// might happen if mouse is outside the boundaries
				continue;
			}
			self.drawUi.plotLine(renderID, prevCoord.x, prevCoord.y, thisCoord.x, thisCoord.y);			
		}

		self.drawUi.render(renderID);
	}

	this.clearFinalise = function() {
		if (self.finaliseTimeout != null) { 
			// prevent stuff getting overwritten
			clearTimeout(self.finaliseTimeout);
			self.finaliseTimeout = null;
		}
	}

	// @deprecated - does not work with pixi
	this.getDrawCtx = function(toolIn, emit, suffix) {
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
			var remoteCanvas = self.getRemoteCanvas(toolIn, suffix);
			thisCtx = remoteCanvas[0].getContext("2d");
		}
		return thisCtx;
	}

	// Return existing remote canvas. Also bumps the canvas's z-index 
	// if it's the first time
	this.getRemoteCanvas = function(tool, suffix) {
		var canvasID = "canvas_layer_"+tool.layerCode+suffix;
		var existingCanvas = $("#"+canvasID);
		if (existingCanvas.length == 0) {
			self.createRemoteCanvas(canvasID);
			existingCanvas = $("#"+canvasID);

			// putting bumpCanvas here will eliminate the flicker bug
			self.bumpCanvas(existingCanvas);
		}
		var element = existingCanvas[0];
		if (typeof(element.deleteTimeout) !== "undefined") {
			clearTimeout(element.deleteTimeout);
		}
		// note this might be buggy in some edge cases - if the layer hangs around
		// waiting for processing, it will disappear and then reappear
		element.deleteTimeout = setTimeout(function() {
			existingCanvas.remove();
		}, self.remoteCanvasDeleteCutoff);
		return existingCanvas;
	}

	// @deprecated
	this.initBaseData = function(thisCtx) {
		thisCtx.baseData = thisCtx.getImageData(0, 0, self.width, self.height);
	}

	this.setupControls = function() {
		SnapshotDialog(self.drawID);

		self.bindToolButton("eyedropper");
		self.bindToolButton("paint");
		self.bindToolButton("line");
		self.bindToolButton("flood");
		self.bindToolButton("text");
		self.bindToolButton("test");

		// Special case prevent text button from stealing the focus
		$("#text").on("mouseup", function() { 
			$("#text_input_box").focus();
		});
		self.brushSizeMenu = new ToolOptionMenu(self, "brush_size", null, null);
		self.fontSizeMenu = new ToolOptionMenu(self, "font_size", null, null);
		self.fontFaceMenu = new ToolOptionMenu(self, "font_face", function(id) { // onOpen
			var menu = $("#"+id+"-menu").parent();
			var options = menu.find(".ui-menu-item-wrapper")
			options.each(function() {
				var element = $(this);
				element.css("font-family", self.getFontValue(element.html()));
			});
		}, function(htmlIn) { // getButtonHtml
			return "<span style=\"font-family: "+self.getFontValue(htmlIn)+";\">Font</span>"
		});

		$("#mod_button").click(function() {
			self.modDialog.show();
		});

		self.toggleButtons("paint");

		$(window).on("resize", function() {
			// reposition things that need repositioning
			self.brushSizeMenu.position();
			self.fontSizeMenu.position();
			self.fontFaceMenu.position();

			// gets fired before the spectrum has at it
			self.positionColourPicker();
			self.positionTextInput();
		});
	}

	this.getFontValue = function(htmlIn) {
		var bits = htmlIn.split(" ");
		var id = "ubuntu"
		for (var i = 1; i < bits.length; i++) {
			var word = bits[i];
			id += word.substring(0, 1).toUpperCase()+word.substring(1)
		}
		return id;
	}

	this.bindToolButton = function(toolId) {
		$("#"+toolId).on("mousedown", function() {
			self.toggleButtons(toolId);
			self.setTool(toolId);
		});
	}

	// Set tool via the UI, this will always be the local tool, not remote tool
	// I.e. the tool being changed will be the emitter
	this.setTool = function(toolId) {
		var tool = self.toolManager.getLocalTool();
		// Do we need to start / stop the tester?
		if (toolId == "test" && tool.tool != "test") {
			self.tester.start();
		} else if (tool.tool == "test" && toolId != "test") { 
			self.tester.stop();
		}

		// Set tool identifier into the tool
		tool.tool = toolId;
	}

	this.readBrushSize = function(tool) {
		// better version
		tool.meta.brushSize = parseInt($("#brush_size").val());
	}

	this.readFontSize = function(tool) {
		var tool = self.toolManager.getLocalTool();
		tool.meta.fontSize = parseInt($("#font_size").val());
	}

	this.readFontFace = function(tool) {
		var tool = self.toolManager.getLocalTool();
		tool.meta.fontFace = getFontFromMenu();
	}

	this.getFontFromMenu = function() {
		return self.getFontValue($("#font_face").val())
	}

	this.initColourPicker = function() {
		self.colourPicker.spectrum({
			showAlpha: true,
			cancelText: "Cancel",
			chooseText: "OK",
			show: self.openColourPicker
		});
	}

	this.openColourPicker = function() {
		self.closeMenus();
		self.positionColourPicker();
	}

	this.pickerVisible = function() {
		var panel = $(".sp-container").first(); 
		if (!panel.hasClass("sp-hidden")) {
			return true;
		}
		return false;
	}

	this.pickerToToolColour = function() {
		var tool = self.toolManager.getLocalTool();
		tool.colour = self.colourPicker.spectrum("get").toRgbString();
	}

	// Start drawing using the local tool
	this.startTool = function(coord, tool) {

		tool.newCoord = coord;
		if (tool.newCoord == null) { // make sure mouse is within canvas
			return;
		}
		// only when outside the timeout
		tool.state = "start";
		// only create new layer code when outside rolling timeout, or when there is no layer code yet

		// do we need to set the tool data?
		if (tool.tool == "paint") { // paints have a list of entries
			self.startPaint(tool);

		} else if (tool.tool == "line") {
			startLine(tool);

		} else if (tool.tool != "text") { // tool does not have a data attribute
			tool.meta = null;
		}
		self.handleAction(tool, true);
	}

	this.startPaint = function(tool) {
		var metaBit = {"lineEntries": [{"state": tool.state, "coord": tool.newCoord}]};
		tool.meta = metaBit;
		self.lastEmit = $.now();
	}

	this.startLine = function(tool) {
		tool.meta = {startCoord: tool.newCoord}
	}

	// Stop drawing but only if already drawing
	this.stopTool = function(tool) {
		if (tool.tool == "test") {
			// Ignore attempts to stop tool from test mode, this is done through a seperate method
			return;
		}
		if (tool.state == "drawing" || tool.state == "start") {
			tool.state = "end";
		}
		self.handleAction(tool, true);

		// reset after using the eye dropper tool
		// but only if CTRL is not pressed
		if (tool.dropperToggle) { 
			self.resetDropperToggle();
		}
	}

	// Stop test, a bit like stopTool but for automated local test
	// Fake remote tests handled separately
	this.stopLocalTest = function(interrupt) {
		var tool = self.toolManager.getLocalTool();
		if (tool.state == "drawing" || tool.state == "start") {
			tool.state = "end";
		}
		self.handleAction(tool, true);
	}

	this.activateDropperToggle = function() {
		var tool = self.toolManager.getLocalTool();
		tool.dropperToggle = true;
		tool.prevTool = tool.tool;
		tool.tool = "eyedropper";
		self.toggleButtons(tool.tool);
	}

	this.resetDropperToggle = function() {
		var tool = self.toolManager.getLocalTool();
		tool.dropperToggle = false;
		tool.tool = tool.prevTool;
		if (tool.tool == "line") {
			startLine(tool)
		}
		self.toggleButtons(tool.tool);
	}

	this.makeCircle = function(toolIn) {
		var radius = toolIn.meta.brushSize;
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
	// @deprecated
	this.plotLine = function(ctx, data, toolIn, x0, y0, x1, y1) {
		self.plotLineOld(ctx, data, toolIn, x0, y0, x1, y1);
	}

	this.eyedropper = function(tool) {
		if (tool.newCoord == null) { // can happen outside of canvas area
			return;
		}
		// get the colour from the scratch canvas at the given coordinate
		var scratchCtx = self.drawScratchCanvas();
		var col = scratchCtx.getImageData(tool.newCoord.x, tool.newCoord.y, 1, 1).data;
		tool.colour = "rgba("+col[0]+", "+col[1]+", "+col[2]+", "+col[3]+")";
		self.colourPicker.spectrum("set", tool.colour);
	}
	
	this.drawScratchCanvas = function() {
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
		scatchCanvas.setAttribute("width", self.width);
		scatchCanvas.setAttribute("height", self.height);
		var scratchCtx = scatchCanvas.getContext('2d'); // the user editable element
		scratchCtx.clearRect(0, 0, self.width, self.height); // Clear the canvas

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
	this.floodFill = function(sourceCtx, destCtx, x, y, oldColour, newColour) {
		var sourceData = sourceCtx.getImageData(0, 0, self.width, self.height);
		var destData = destCtx.getImageData(0, 0, self.width, self.height);
		var queue = []

		queue.push([x, y]);
		while(queue.length > 0) {

			// Retrieve the next x and y position of cursor
			var coords = queue.pop();

			var x = coords[0];
			var y = coords[1];
			
			var sourceColour = self.getColour(sourceData.data, x, y);
			var destColour = self.getColour(destData.data, x, y);
			var tolerance = 3;

			if( // Found different colour in original image?
				!self.rgbaEqual(sourceColour, oldColour, tolerance) ||

				// Are we hitting an area that has already been filled?
				self.rgbaEqual(destColour, newColour, tolerance)
			) { 
				continue;
			}

			// At this point, we are writing data to storage
			// Data is written to canvas in later step
			self.setColour(sourceData.data, x, y, newColour);
			self.setColour(destData.data, x, y, newColour);

			// Determine another cursor movement
			if (x > 0) {
				queue.push([x - 1, y]);
			}
		 
			if (y > 0) {
				queue.push([x, y - 1]);
			}
		 
			if (x < self.width - 1) {
				queue.push([x + 1, y]);
			}
		 
			if (y < self.height - 1) {
				queue.push([x, y + 1]);
			}
		}

		// Write the new flood filled data to the canvas
		destCtx.putImageData(destData, 0, 0);
	}

	// parse CSS colour details
	this.parseColour = function(strIn) {
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
	this.getColour = function(data, x, y) {
		var base = getXYBase(x, y);
		return [data[base], data[base+1], data[base+2], data[base+3]];
	}

	// from https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Pixel_manipulation_with_canvas
	this.getXYBase = function(x, y) {
		return (Math.floor(y) * (width * 4)) + (Math.floor(x) * 4);
	}

	// Set colour into the image data
	// This involves RGBA blending
	this.setColour = function(data, x, y, newColour) {
		var base = getXYBase(x, y);

		// Get the existing colour
		var existingColour = data.slice(base, base + 4);

		// Convert colours from 0-255 to 0-1
		var red1 = existingColour[0] / 255;
		var green1 = existingColour[1] / 255;
		var blue1 = existingColour[2] / 255;
		var alpha1 = existingColour[3] / 255;

		var red2 = newColour[0] / 255;
		var green2 = newColour[1] / 255;
		var blue2 = newColour[2] / 255;
		var alpha2 = newColour[3] / 255;

		// Blend colours using the alpha
		var alphaResult = alpha1 + alpha2 * ( 1 - alpha1 );
		var redResult   = red1 * alpha1 + red2 * alpha2 * ( 1 - alpha1 ) / alphaResult;
		var greenResult = green1 * alpha1 + green2 * alpha2 * ( 1 - alpha1 ) / alphaResult;
		var blueResult  = blue1 * alpha1 + blue2 * alpha2 * ( 1 - alpha1 ) / alphaResult;

		// Set new pixel value into the data
		data[base] = Math.round(redResult * 255);
		data[base + 1] = Math.round(greenResult * 255);
		data[base + 2] = Math.round(blueResult * 255);
		data[base + 3] = Math.round(alphaResult * 255);
	}

	this.rgbaEqual = function(query, target, tolerance) {
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

	this.toggleButtons = function(toolId) {
		var selectedElement = $("#"+toolId);
		$(".button_tool").each(function() {
			var element = $(this);
			if (element.attr("id") == selectedElement.attr("id")) {
				element.addClass("button_pressed")
			} else {
				element.removeClass("button_pressed")
			}
		});
		if (toolId == "text") {
			self.toggleTextInput();
		} else {
			self.closeTextInput();
		}

		// toggle option menus
		$(".controls_selectmenu").each(function() {
			var option = $(this).attr("id")
			var el = $("#"+option+"_container");
			if (
				option == "room_menu" || 
				(toolId == "text" && (option == "font_face" || option == "font_size")) ||
				((toolId == "paint" || toolId == "line") && option == "brush_size")
			) {
				el.show();
			} else {
				el.hide()
			}
		});
	}

	// Close menus, optionally exclude a particular menu from closing
	this.closeMenus = function(except) {
		self.closeTextInput();
		if (typeof(except) !== "undefined" && except != "brush_size") {
			self.brushSizeMenu.close();
		}
		if (typeof(except) !== "undefined" && except != "font_size") {
			self.fontSizeMenu.close();
		}
		if (typeof(except) !== "undefined" && except != "font_face") {
			self.fontFaceMenu.close();
		}
	}

	// Position colour picker
	this.positionColourPicker = function() {
		var offset = $(".sp-light").first().offset();
		var panel = $(".sp-container").first(); 
		panel.css({
			"top": (offset.top)+"px",
			"left": (offset.left - panel.width())+"px",
			"z-index": 1000000012
		});
	}

	// Check whether any of the menus are open
	this.menusOpen = function() {
		// check text input
		// text is a special case, we the tool is selected, not just if the menu is open
		if ($("#text").hasClass("button_pressed")) {
			return true;
		}
		// check the brush size menu 
		if (self.brushSizeMenu.isOpen()) {
			return true;
		}
		// check colour picker
		if (self.pickerVisible()) {
			return true;
		}
		if (self.nickVisible()) {
			return true;
		}
		if (self.dialogsVisible()) {
			return true;
		}

		return false;
	}

	this.dialogsVisible = function() {
		var visible = false;
		$(".ui-dialog").each(function(element) {
			if ($(this).is(":visible")) {
				visible = true;
			}
		});
		return visible;
	}

	this.nickVisible = function() {
		if ($(".ui-dialog").css("display") == "none") {
			return false;
		}
		return true;
	}

	this.toggleTextInput = function() {
		($("#text_input").css("display") == "none") ? self.openTextInput() : self.closeTextInput();
	}

	this.openTextInput = function() {
		self.closeMenus();
		$("#text_input").show();
		self.positionTextInput();

		var inputBox = $("#text_input_box");
		inputBox.focus();
		inputBox.css("font-family", getFontFromMenu());
		inputBox.focus(function() { $(this).select(); } );
		inputBox.keyup(function() {
			if ($(this).val() == self.defaultText) { // no text entered
				return;
			}
			tool.meta.text = $(this).val();
			textIdle(tool, true);
		});
		inputBox.keydown(function(ev) {
			if (ev.keyCode == 13) {
				self.closeTextInput();
			}
		});
	}

	this.closeTextInput = function() {
		$("#text_input").hide();
	}

	this.positionTextInput = function() {
		var menu = $("#text_input")
		if (menu.css("display") == "none") {
			return; // menu not active, nothing to do
		}
		// determine top right corner
		var reference = $("#drawing_form");
		var offset = reference.offset(); // the offset will now be consistent
		var left = offset.left
		menu.css({ // get the parent element and reposition it
			"top": offset.top+"px",
			"left": left+"px",
			"z-index": 1000000012
		});
	}

	// emit a tool action
	this.emitTool = function(toolIn) { 
		var nickname = base.conf["sessionData"]["name"];
		if (!nickname) {
			nickname = "Anonymous"
		}
		toolIn.nickname = nickname;
		self.socket.emit('receive_tool', toolIn);
	}

	this.emitToolInterval = function(toolIn, beforeEmit) {
		// emitTool(toolIn); // version of tool with line coords array
		if ($.now() - self.lastEmit > self.mouseEmitInterval) { 
			if (
				toolIn.tool == "paint" && 
				toolIn.meta != null && 
				toolIn.meta.lineEntries != null
			) {
				toolIn.meta.lineEntries = null;
			}
			// reached interval
			self.emitTool(toolIn); // version of tool with line coords array
			self.lastEmit = $.now();
			return true;
		}
		return false;
	}

	// receive a tool action from another user
	// this basically just sets the pointer marker and then performs the tool action
	this.receiveTool = function(tool) {
		var sockID = tool.socketID;
		var pointerElement = $("#drawing_pointer_"+sockID);

		if (tool.newCoord == null) {
			pointerElement.fadeOut(self.labelFadeOutMs, function() {
				pointerElement.remove();
			});
			self.handleAction(tool, false);
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
		}
		// position the pointer element
		pointerElement.css({
			left: tool.newCoord.x+"px",
			top: tool.newCoord.y+"px"
		});
		var nick = !tool.nickname ? "Anonymous" : tool.nickname;
		$("#drawing_pointer_label_"+sockID).text(nick);

		// Pointer has a rolling fade timeout
		// We're being lazy by attaching it to the DOM element
		if (pointerElement[0].timeout) {
			clearTimeout(pointerElement[0].timeout)
		}
		pointerElement[0].timeout = setTimeout(function() {
			pointerElement.fadeOut(self.labelFadeOutMs, function() {
				pointerElement.remove();
			});
		}, self.pointerTimeoutMs)

		self.handleAction(tool, false);
	}

	// Ask the server for drawing data
	this.getDrawing = function() {
		self.socket.emit("get_drawing", {
			"drawID": self.drawID,
			"sessionID": getCookie("sessionID")
		});
	}

	// Update drawing with new draw data from the server
	// This resets the layers
	this.receiveDrawing = function(data) {
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
			self.addLayer(value);
		});
		self.drawUi.render();
	}

	this.receiveLayer = function(data) {
		data = $.parseJSON(data);
		self.addLayer(data.layer);
		self.drawUi.render();
	}	

	// get the mouse position inside the canvas
	// returns null if the mouse is outside the canvas
	this.getMousePos = function(ev) {
		var rect = self.renderCanvas[0].getBoundingClientRect(); // [0] gets DOM object from jquery obj

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

	this.createRemoteCanvas = function(canvasID) {
		var buf = 
			"<canvas id=\""+canvasID+"\" "+
				"width=\""+self.width+"\" height=\""+self.height+"\" "+
				"style=\"z-index: 0;\" "+ // bumpCanvas will take care of the z-index
				"class=\"drawing_canvas\"> "+
			"</canvas>"+

			/* 
			This is the preview canvas.

			Because it's situated below the drawing canvas in the html 
			it will always be displayed above it in the stacking order. So we don't 
			need to worry about z-index being the same as the preview element.
			
			Good explanation can be found here
			https://philipwalton.com/articles/what-no-one-told-you-about-z-index/ 
			*/
			"<canvas id=\""+canvasID+"_preview\" "+
				"width=\""+self.width+"\" height=\""+self.height+"\" "+
				"style=\"z-index: 0;\" "+ // bumpCanvas will take care of the z-index
				"class=\"drawing_canvas\"> "+
			"</canvas>";
		$("#drawing_layers").append(buf)
	}

	this.bumpCanvas = function(canvasElement) {
		$(".drawing_canvas").each(function() { // shift everything else -1 on zindex
			var element = $(this);
			var zIndex = parseInt(element.css("z-index")) - 1;
			element.css("z-index", zIndex);
			// previewElement.css("z-index", zIndex);
		});

		// move the canvas of interest to the top position
		var previewElement = $("#"+canvasElement.attr("id")+"_preview");
		canvasElement.css("z-index", self.canvasCeiling);
		previewElement.css("z-index", self.canvasCeiling);
	}

	this.getLayerByCode = function(code) {
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
	
	// Add layer data to the dom
	// Layer data comes from the server
	this.addLayer = function(layerIn) {
		// If "components" is set, it means it's a flattened image
		// Delete component layers, if there are any
		if (layerIn["components"]) {
			var codes = layerIn["components"]
			for (var i = 0; i < codes.length; i++) {
				self.drawUi.destroyLayer(codes[i]);
			}
		}

		// Delete the layer with the ID
		self.drawUi.destroyLayer(layerIn.code);
		self.drawUi.addImageLayer(layerIn);
	}

	// Happens when the user times out from not being active for n milliseconds
	// Turn a canvas into an image which is then sent to the server
	// Image is smart cropped before sending to save server some image processing
	this.processCanvas = function(toolIn) {
		var sourceCanvas = self.newLocal();

		// $("#drawing_form").append(sourceCanvas);			

		var layerCode = toolIn.layerCode; // must keep copy since it gets reset to null

		// Crop the canvas to save resources (this is pretty slow, around 20ms)
		var cropCoords = self.cropCanvas(sourceCanvas, self.croppingCanvas[0], toolIn);

		// First generate a png blob (async)
		var blob = self.croppingCanvas[0].toBlob(function(blob) {

			// Generate data URL, to be displayed on the front end, from the blob
			var fr = new FileReader();
			fr.onload = function(e) {
				
				var layer = {
					drawID: self.drawID,
					base64: e.target.result, 
					offsets: cropCoords,
					code: layerCode
				}

				// Render the layer image - this replaces the canvas
				addLayer(layer);
				self.drawUi.render();


				// // Remove the canvas copy
				// canvasCopy.remove();

				// Now convert to base64 - this will be send back to the server
				var fr = new window.FileReader();
				fr.readAsDataURL(blob); 
				fr.onloadend = function() {
					var base64 = fr.result;
					self.socket.emit("add_layer", layer);
				}
			}
			fr.readAsDataURL(blob);

		}, "image/png");
	}

	this.duplicateDrawingCanvas = function(layerCode) {
		var duplicateID = "drawing_canvas_cpy_"+layerCode;
		var html = "<canvas id=\""+duplicateID+"\" class=\"drawing_canvas_cpy\" "+
			"width=\""+self.width+"\" height=\""+self.height+"\"></canvas>"
		var newElement = $(html);
		var drawData = ctx.getImageData(0, 0, self.width, self.height);
		newElement[0].getContext("2d").putImageData(drawData, 0, 0);
		newElement.insertBefore(drawingCanvas);

		// var drawingCanvasCopy = drawingCanvas.clone();
		// drawingCanvasCopy.attr("id", );
		// drawingCanvasCopy.insertBefore(drawingCanvas);
		// return drawingCanvasCopy;
		return newElement;
	}

	// Crop a sourceCanvas by alpha=0. Results are written to destCanvas.
	// Adapted from https://stackoverflow.com/questions/12175991/crop-image-white-space-automatically-using-jquery
	this.cropCanvas = function(sourceCanvas, destCanvas, toolIn) {
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

	this.setToolColour = function(colour) {
		self.colourPicker.spectrum("set", colour);
	}

	// Public stuff
	var self = this;
	self.init();
}
