// node.js server for drawy.io
// (C) drawy.io

"use strict";

// IMPORTS
const fs = require("fs");
const util = require("util");
const express = require("express"); // A node.js framework
const nunjucks = require("nunjucks"); // Template system
const sharp = require("sharp"); // Image processing library
const nano = require('nanoseconds'); // For measuring performance
const app = express();


const server = require("http").Server(app) // set up socket.io
const io = require("socket.io")(server)    //

// Define global constants
const PORT = 8080; // Which port to expose to the outside world
const ID_LEN = 16; // The length of the ID string for drawings
const MAX_LAYERS = 5; // Max number of layers to store before flattening the image
const DRAWING_PARAMS = { // Parameters for creating blank drawings
	width: 640,
	height: 480,
	channels: 4,
	rgbaPixel: 0x00000000
}

// Associative array containing [alphanumeric code] => [drawing object]
var drawings;

// Set up the app
function main() {
	setupDebug();
	drawings = new AssocArray();
	nunjucks.configure("templates", {express: app});
	configureRoutes(app);
	// configureSocket();
	server.listen(PORT);
	console.log("Running on http://localhost:" + PORT);
}

// Set up all the endpoints
function configureRoutes(app) {

	// // Link socket.io to the routes
	// Not needed, apparently
	// app.use(function(req, res, next) { res.io = io; next(); });

	// Tell node to serve static files from the "public" subdirectory
	app.use(express.static("public"))

	// Create a new drawing in memory, and return its unique ID to the client
	app.get("/create_drawing", createDrawing);

	// Go to a drawing's page
	app.get("/drawings/:id", renderDrawingPage);

	// Fetch a drawing image and output the buffer
	app.get("/drawing_images/:id", getDrawingImage);

	// Index page, rendered as a template
	app.get("/", function(req, res) { res.render("index.html"); });

	// Default action if nothing else matched - 404
	app.use(function(req, res, next) { send404(res); })
}

// Set up drawing-specific event handlers
function configureDrawingSocket(drawing) {

	// add the socket namespace to the drawing
	var drawingNS = io.of("/drawing_socket_"+drawing.id);
	drawing.addSocketNS(drawingNS);

	// set up the event handlers
	drawingNS.on('connection', function(socket) {

		// Returns the drawing data to the client. The callback method is placed here
		// so that we can pass the socket in as well
		socket.on("get_drawing", function(data) { sendDrawing(data, socket); });

		// Receive new png draw data as base64 encoded string and add to the Drawing
		socket.on("add_layer", addLayer);

		// disconnect a socket
		socket.on("disconnect", function() {
			console.log("disconnect from "+drawing.id);
			// nothing to do
		});
	});
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
function addLayer(data) {
	var drawID = data.drawID;
	var drawing = drawings.get(drawID);
	if (drawing == null) {
		console.log("WARNING: "+drawID+" does not exist!");
	} else {
		var layer = {base64: data.base64, offsets: data.offsets}
		var layerID = drawing.addLayer(layer);
		drawing.broadcastLayer(layerID, layer);
		if (drawing.getNStoredLayers() > MAX_LAYERS) {
			drawing.flatten();
		}
	}
}

function send404(res) {
	res.status(404).render("404.html")
}

function renderDrawingPage(req, res) {
	var drawID = req.params.id
	if (drawings.get(drawID)) {
		res.render("drawing.html", { 
			drawID: drawID,
			width: DRAWING_PARAMS.width,
			height: DRAWING_PARAMS.height
		});
	} else {
		send404(res);
	}
}

// Get the drawing image data as layered encoded JSON buffer
function getDrawingImage(req, res) {
	var drawID = req.params.id;
	var drawing = drawings.get(drawID)

	if (drawing == null) { // drawing missing
		send404(res)
	} else { // drawing is present
		res.send(drawing.getJson());
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

	// Convert to a base64 encoded string

	// Convert to buffer, store the buffer, send unique drawing ID to client
	// PNG conversion is slow
	// Note - this needs to be a base64 encoded string
	png.toBuffer().then(function(buffer) {
		var base64 = "data:image/png;base64,"+(buffer.toString('base64'));
		var drawing = new Drawing(drawID, base64);
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

function Drawing(idIn, startImage) {
	this.id = idIn;
	this.layers = new AssocArray();
	this.socketNS = null; // contains all the sockets attached to this drawing
	this.isFlattening = false;

	// used to generate unique sequential layer IDs
	// Keeps going up, even after baking the image into a new single layer
	this.nLayers = 0; 

	// Broadcast all drawing data to all sockets
	this.broadcast = function() {
		var self = this;
		this.socketNS.emit("update_drawing", self.getJson());
		console.log("Broadcast drawing "+this.id+" to "+this.getNSockets()+" sockets");
	}

	// Broadcast a single layer to all sockets
	this.broadcastLayer = function(layerID, layer) {
		var obj = {id: layerID, layer: layer};
		var json = JSON.stringify(obj);
		this.socketNS.emit("add_layer", json);
		console.log("Broadcast layer for "+this.id+", "+layerID+" to "+this.getNSockets()+" sockets");
	}

	// Returns the number of connected sockets
	this.getNSockets = function() {
		return Object.keys(this.socketNS.connected).length;
	}

	// A socket namespace contains a collection of sockets, which will be broadcast to
	this.addSocketNS = function(socketNS) {
		this.socketNS = socketNS;
	}

	// layer is a base64 encoded PNG string
	this.addLayer = function(layerObj) {
		this.layers.set(++this.nLayers, layerObj);
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

	// Merges the layers into a single image. This is a pretty expensive operation.
	this.flatten = function() {
		if (this.isFlattening) {
			console.log("Already being flattened!");
			return;
		}
		this.isFlattening = true;

		var tl = new Timeline();
		tl.log("a");

		function flattenRecursive(self, baseBuf, ind) {
			console.log("flattenRecursive() invoked with ind: "+ind);
			// get base image
			var overlay = self.getUnmergedLayer(ind + 1); // overlay base 64 

			if (overlay != null) { 
				// not reached the end yet - so overlay the image
				// This is where we need to use the coordinate data
				var overlayBuf = base64ToBuffer(overlay.base64);
				var overlayParams = {top: overlay.offsets.top, left: overlay.offsets.left};
				sharp(baseBuf).overlayWith(overlayBuf, overlayParams).toBuffer().then(
					function(buffer) {
						flattenRecursive(self, buffer, ++ind);
					}
				);

			} else { // reached the end
				// now we must convert the image to base 64 encoded string again
				sharp(baseBuf).png().toBuffer().then(function(buffer) {
					var base64 = "data:image/png;base64,"+(buffer.toString('base64'));

					// reset the drawing using the new merged data
					self.layers.empty(); 
					self.layers.set(self.nLayers, {base64: base64, 
						offsets: {top: 0, right: 0, bottom: 0, left: 0}});
					self.isFlattening = false;

					// now we must update each client
					console.log("Drawing has been flattened");
					tl.log("b");
					tl.dump();

					self.broadcast();
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

		var baseBuf = base64ToBuffer(this.getUnmergedLayer(0).base64); // base image
		flattenRecursive(this, baseBuf, 0);
	}

	this.addLayer({base64: startImage, offsets: {top: 0, right: 0, bottom: 0, left: 0}});
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
