// node.js server for drawy.io
// (C) 2017 drawy.io

"use strict";

// IMPORTS
const fs = require("fs");
const util = require("util");
const express = require("express"); // A node.js framework
const nunjucks = require("nunjucks"); // Template system
const sharp = require("sharp"); // Image processing library
const nano = require('nanoseconds'); // For measuring performance
const app = express();
const ta = require('time-ago')(); // set up time-ago human readable dates library
const server = require("http").Server(app) // set up socket.io
const io = require("socket.io")(server)    //

// Define global constants
const PORT = 8080; // Which port to expose to the outside world
const ID_LEN = 16; // The length of the ID string for drawings
const LAYER_CODE_LEN = 32; // Length of layer codes
const MAX_LAYERS = 5; // Max number of layers to store before flattening the image
const FLATTEN_TIMEOUT = 1000; // after n ms since last edit, flatten the image
const DRAWING_PARAMS = { // Parameters for creating blank drawings
	width: 640,
	height: 480,
	channels: 4,
	rgbaPixel: 0xFFFFFFFF
}

// Associative array containing [alphanumeric code] => [drawing object]
var drawings;

// Set up the app
function main() {
	setupDebug()
	drawings = new AssocArray();
	nunjucks.configure("templates", {express: app});
	configureRoutes(app);
	server.listen(PORT);
	console.log("Running on http://localhost:" + PORT);
}

// Set up all the endpoints
function configureRoutes(app) {

	// Tell node to serve static files from the "public" subdirectory
	app.use(express.static("public"));

	// Create a new drawing in memory, and return its unique ID to the client
	app.get("/create_drawing", createDrawing);

	// Render a drawing's page or its image
	app.get("/d/:id", function(req, res) {
		req.params.id.includes(".png") ? 
			getDrawingImage(req, res) : 
			renderDrawingPage(req, res);
	});

	// The splash page
	app.get("/", function(req, res) { res.render("index.html", { gallery: getGallery() }); });

	// Default action if nothing else matched - 404
	app.use(function(req, res, next) { send404(res); })
}

// Set up drawing-specific event handlers
function configureDrawingSocket(drawing) {

	// set up the drawing's socket namespace
	var drawingNS = io.of("/drawing_socket_"+drawing.id);
	drawing.addSocketNS(drawingNS);

	// set up the event handlers
	drawingNS.on('connection', function(socket) {

		// Returns the drawing data to the client. The callback method is placed here
		// so that we can pass the socket in as well
		socket.on("get_drawing", function(data) { sendDrawing(data, socket); });

		// Update drawing with mouse cursor info
		socket.on("mousemove", function(data) { receiveTool(data, socket); });

		// Receive new png draw data as base64 encoded string and add to the Drawing
		socket.on("add_layer", function(data) { receiveLayer(data, socket); });

		// disconnect a socket
		socket.on("disconnect", function() {
			console.log("Disconnect from "+drawing.id);
			// nothing to do
		});
	});
}

function getGallery() {

	// build some gallery objects
	var out = []
	var ids = drawings.getKeys();
	for (var i = 0; i < ids.length; i++) {
		var drawing = drawings.get(ids[i]);
		if (!drawing.emptyImage) { // skip blank images
			out.push({ drawing: drawing, ago: drawing.getLastEditedStr()});
		}
	}

	// sort by most recent first
	out.sort(function(a, b) {
		if (a.drawing.lastEdited > b.drawing.lastEdited) {
			return -1;
		} else if (a.drawing.lastEdited < b.drawing.lastEdited) {
			return 1;
		}
		return 0;
	})
	return out;
}

function receiveTool(data, socket) {
	var drawing = drawings.get(socket.drawID);
	drawing.broadcastTool(data, socket);
}

// we'll also want a broadcastDrawing() method for when the image is flattened
function sendDrawing(data, socket) {
	var drawID = data.drawID;
	var drawing = drawings.get(drawID); 
	var output = drawing.getJson();
	socket.drawID = drawID; // link socket to drawing - useful for disconnects and stuff
	socket.emit("update_drawing", drawings.get(drawID).getJson());
}

// Adds a layer from raw data coming from the socket
function receiveLayer(data, socket) {
	var drawID = data.drawID;
	var drawing = drawings.get(drawID);
	if (drawing == null) {
		console.log("WARNING: "+drawID+" does not exist!");
	} else {
		var layer = data;
		var layerID = drawing.addLayer(layer);
		drawing.broadcastLayer(layerID, layer, socket);
		if (drawing.timeout) {
			clearTimeout(drawing.timeout)
			drawing.timeout = null;
		}
		if (drawing.getNStoredLayers() > MAX_LAYERS) {
			drawing.flatten();
		} else {
			drawing.timeout = setTimeout(function() {
				console.log("Timeout triggered");
				drawing.flatten();
			}, FLATTEN_TIMEOUT);
		}
	}
}

function send404(res) {
	res.status(404).render("404.html")
}

function renderDrawingPage(req, res) {
	var drawID = req.params.id
	if (drawings.get(drawID)) { // drawing present
		res.render("drawing.html", { 
			drawID: drawID,
			width: DRAWING_PARAMS.width,
			height: DRAWING_PARAMS.height
		});
	} else { // drawing is missing
		send404(res);
	}
}

// Return png image as buffer
function getDrawingImage(req, res) {
	var drawID = req.params.id.replace(".png", "");
	var drawing = drawings.get(drawID)
	if (drawing == null) { // drawing missing
		send404(res)
	} else { // drawing is present
		var layer = drawing.getUnmergedLayer(0);
		var buf = base64ToBuffer(layer.base64);
		res.writeHead(200, {
			'Content-Type': 'image/png',
			'Content-Length': buf.length
		});
		res.end(buf);
	}
}

function createDrawing(req, res) {
	// 1. Find a unique drawing ID
	var drawID = makeDrawID();
	if (drawID == null) { // exceeded max tries
		console.log("WARNING: Max tries exceeded")
		res.send("error");
		return;
	}

	// 2. Set up the drawing
	// Create empty image
	var params = DRAWING_PARAMS;
	var canvas = Buffer.alloc(
		params.width * params.height * params.channels, 
		params.rgbaPixel
	);

	// Specify that it's a PNG
	var png = sharp(canvas, {raw: {
		width: params.width, 
		height: params.height, 
		channels: params.channels
	}}).png();

	// Convert to buffer, store the buffer, send unique drawing ID to client
	// Sends a base64 encoded string
	png.toBuffer().then(function(buffer) {
		var base64 = "data:image/png;base64,"+(buffer.toString('base64'));
		var layer = {
			drawID: drawID,
			base64: base64, 
			offsets: {top: 0, right: 0, bottom: 0, left: 0},
			code: randomString(LAYER_CODE_LEN)
		};
		var drawing = new Drawing(drawID, layer);
		drawings.set(drawID, drawing);
		configureDrawingSocket(drawing);
		res.send(drawID);
		console.log("Drawing "+drawID+" created.");
	});
}

// Make a unique drawing ID by attempting to random generate one up to n times
function makeDrawID() {
	var drawID;
	var maxTries = 10;
	var nTries = 0;
	do {
		drawID = randomString(ID_LEN);
		nTries++;
		if (nTries >= maxTries) {
			return null;
		}
	} while(drawings.get(drawID) !== null);
	return drawID;
}

// Create a random string, to be used as an ID code
function randomString(length) {
    var text = "";
    var charset = "abcdefghijklmnopqrstuvwxyz0123456789";
    for (var i = 0; i < length; i++) { 
        text += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    return text;
}

// Override console.log so it gets output to a nice file, easier to check
// The log files get emptied every restart
function setupDebug() {
	var debugFilepath = __dirname+"/debug.log";
	var log_file = fs.createWriteStream(debugFilepath, {flags : "w"});
	var log_stdout = process.stdout;
	console.log = function(d) { //
		log_file.write(util.format(d) + "\n");
		log_stdout.write(util.format(d) + "\n");
	};
}

// Convert a base64 encoded PNG string into a Buffer object
function base64ToBuffer(base64) {
	var str = base64.replace("data:image/png;base64,", "");
	return Buffer.from(str, 'base64')
}

// Stores the data for a drawing
function Drawing(idIn, startLayer) {
	this.id = idIn;
	this.layers = new AssocArray();
	this.socketNS = null; // contains all the sockets attached to this drawing
	this.isFlattening = false;
	this.timeout = null;
	this.emptyImage = true; // whether the PNG is empty

	// used to generate unique sequential layer IDs
	// Keeps going up, even after baking the image into a new single layer
	this.nLayers = 0;

	// Broadcast all drawing data to all sockets
	this.broadcast = function() {
		var self = this;
		this.socketNS.emit("update_drawing", self.getJson());
	}

	// Broadcast a single layer to all sockets except originator
	this.broadcastLayer = function(layerID, layer, socket) {
		var obj = {id: layerID, layer: layer};
		var json = JSON.stringify(obj);
		// socket.broadcast sends to everything in namespace except originating socket
		socket.broadcast.emit("add_layer", json);
	}

	// Broadcast mousecoords to all sockets except the originator
	this.broadcastTool = function(data, socket) {
		var socketID = socket.id.split("#").pop();
		data.socketID = socketID; // we need the socket id to keep track of things
		socket.broadcast.emit("receive_mouse_coords", data);
	}

	// Returns the number of connected sockets
	this.getNSockets = function() {
		return Object.keys(this.socketNS.connected).length;
	}

	// A socket namespace contains a collection of sockets, which will be broadcast to
	this.addSocketNS = function(socketNS) {
		this.socketNS = socketNS;
	}

	// layer is a base64 encoded PNG string from the client
	this.addLayer = function(layerObj) {
		this.nLayers++;
		console.log("["+this.nLayers+"] layer added");
		this.layers.set(this.nLayers, layerObj);
		this.updateEdited();
		return this.nLayers;
	}
	// returns a base64 encoded PNG string. Not actually in used (@deprecated)
	this.getLayer = function(layerID) {
		return this.layers.get(layerID);
	}
	// instead of a layerID, return by position in the stored png stack
	// Position 0 is the base image
	this.getUnmergedLayer = function(position) {
		var keys = this.layers.getKeys();
		var offset = parseInt(keys[0]);
		return this.layers.get(offset + position);
	}
	this.getNStoredLayers = function() { return this.layers.getLength(); }
	this.getJson = function() { return this.layers.getJson(); }

	// store timestamp of the most recent edit
	this.updateEdited = function() {
		console.log("updateEdited() invoked");
		this.lastEdited = new Date();
	}

	this.getLastEditedStr = function() {
		var diff = new Date() - this.lastEdited;
		if (diff < 1000) { // less than 1 second = a moment ago
			return "A moment ago";
		}
		// otherwise use the string from the library
		return ta.ago(this.lastEdited);
	}

	// Merges the layers into a single image. This is a pretty expensive operation.
	this.flatten = function() {
		if (this.isFlattening) {
			console.log("Already being flattened!");
			return;
		}
		console.log("Started flattening");
		this.isFlattening = true;
		// must increment at the beginning to avoid new layers getting overwritten

		// make room for the flattened image
		this.nLayers++; 
		var flattenedLayerID = this.nLayers;

		// String codes of the component layers of the flatten
		var componentCodes = []

		var tl = new Timeline();
		tl.log("a");

		function flattenRecursive(self, baseBuf, ind) {
			var overlay = self.getUnmergedLayer(ind + 1); // overlay base 64 

			if (ind < MAX_LAYERS && overlay != null) {

				// not reached the end yet - so overlay the image
				componentCodes.push(overlay.code);
				var overlayBuf = base64ToBuffer(overlay.base64);
				var overlayParams = {top: overlay.offsets.top, left: overlay.offsets.left};
				sharp(baseBuf).overlayWith(overlayBuf, overlayParams).toBuffer().then(
					function(buffer) {
						flattenRecursive(self, buffer, ++ind);
					}
				);

			} else {
				// reached the end
				// now we must convert the image to base 64 encoded string again
				sharp(baseBuf).png().toBuffer().then(function(buffer) {
					var base64 = "data:image/png;base64,"+(buffer.toString('base64'));

					// Remove old layers but not new ones					
					var keys = self.layers.getKeys();
					for (var i = 0; i < keys.length; i++) {
						var key = keys[i];
						if (parseInt(key) < flattenedLayerID) {
							self.layers.delete(key);
						}
					}

					// Add the new flattened layer
					self.layers.set(flattenedLayerID, {
						id: flattenedLayerID,
						base64: base64, 
						offsets: {top: 0, right: 0, bottom: 0, left: 0},
						code: randomString(LAYER_CODE_LEN),
						components: componentCodes
					});

					console.log("["+self.nLayers+"] Drawing has been flattened, "+ind+" layers total");
					tl.log("b");

					// now we must update each client
					self.broadcast();
					self.isFlattening = false;
					self.emptyImage = false;
					tl.log("c");
					// tl.dump();
				});
			}
		}

		// make sure there is stuff to do
		var nLayers = this.getNStoredLayers();
		if (nLayers <= 1) {
			// This shouldn't happen, so log a warning
			console.log("[WARNING] flatten() called with only "+nLayers+" stored layers");
			return;
		}

		var baseLayer = this.getUnmergedLayer(0);
		var baseBuf = base64ToBuffer(baseLayer.base64); // base image
		componentCodes.push(baseLayer.code);
		flattenRecursive(this, baseBuf, 0);
	}
	this.addLayer(startLayer);
}

// Define a nice java-like associative array wrapper with cleaner access than plain JS.
function AssocArray() {
	this.values = {};
	this.get = function(key) {
		if (typeof(this.values[key]) !== "undefined") {
			return this.values[key];
		}
		return null;
	}
	this.set = function(key, value) {
		if (this.get(key)) {
			console.log("Replacing existing layer!");
		}
		this.values[key] = value;
	}
	this.getLength = function() {
		return this.getKeys().length;
	}
	this.getKeys = function() {
		return Object.keys(this.values);
	}
	this.getJson = function() {
		return JSON.stringify(this.values);	
	}
	this.empty = function() {
		this.values = {}
	}
	this.delete = function(key) {
		delete this.values[""+key]
	}
};

// For performance measurement
function Timeline() {
	this.entries = [];
	this.log = function(name) {
		var ts = nano(process.hrtime());
		this.entries.push({
			name: name,
			ts: ts
		});
	};
	this.dump = function() {
		console.log("Timeline.dump() invoked")
		var currEntry;
		var prevEntry = null;
		for (var i = 0; i < this.entries.length; i++) {
			var currEntry = this.entries[i];
			if (prevEntry != null) {
				// convert nanoseconds to milliseconds
				var diffNs = (currEntry.ts - prevEntry.ts) / 1000000;
				console.log("["+prevEntry.name+"] => ["+currEntry.name+"] "+diffNs+" ms");
			}
			prevEntry = currEntry;
		}
	}
}

// Get the party started
main();
