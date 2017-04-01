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
const settings = require("./settings") // Our settings
const validation = require("./validation") // Validation tools

// const database = require("./database") // Our database wrapper

// Associative array containing [alphanumeric code] => [drawing object]
var drawings;
var db = null; // filled later

// Set up the app
function main() {
	setupDebug();
	loadDrawingsInitial();
	nunjucks.configure("templates", {express: app});
	configureRoutes(app);
	// db = new database.DB(settings.DB_CONNECT_PARAMS);
	server.listen(settings.PORT);
	console.log("Running on http://localhost:" + settings.PORT);
}

// This is a bit of a dirty solution
// will be replaced with a proper DB based storage soon.
function loadDrawingsInitial() {
	drawings = new AssocArray();
	var dir = settings.IMAGES_DIR;
	var files = fs.readdirSync(dir);
	files.sort(function(a, b) {
		return fs.statSync(dir+"/"+b).mtime.getTime() - fs.statSync(dir+"/"+a).mtime.getTime();
	});	
	var max = files.length <= settings.MIN_DRAWINGS_MEMORY 
		? files.length : settings.MIN_DRAWINGS_MEMORY;
	for (var i = 0; i < max; i++) {
		console.log("["+files[i].split(".")[0]+"]");
		getDrawing(files[i].split(".")[0], function(drawing) {
			drawing.emptyImage = false;
	 		// checking the modified date is asynchronous
	 		var filepath = dir+"/"+drawing.id+".png"
	 		fs.stat(filepath, function(err, stats) {
	 			drawing.lastEdited = stats["mtime"]
	 		})
		});
	}
}

// Set up all the basic http endpoints
function configureRoutes(app) {

	// Tell node to serve static files from the "public" subdirectory
	app.use(express.static("public"));

	// Create a new drawing in memory, and return its unique ID to the client
	app.get("/create_drawing", createDrawing);

	// Render a drawing's page or its image
	app.get("/d/:id", function(req, res) {
		req.params.id.includes(".png") ? 
			sendDrawingImage(req, res) : 
			renderDrawingPage(req, res);
	});

	// The index page
	app.get("/", function(req, res) { res.render("index.html", { 
		settings: settings,
		gallery: getGallery()
	}); });

	// Default action if nothing else matched - 404
	app.use(function(req, res, next) { send404(res); })
}

function getGallery() {

	// build some gallery objects
	var out = []
	var ids = drawings.getKeys();
	for (var i = 0; i < ids.length; i++) {
		var drawing = getDrawing(ids[i]); // note that this only grabs from memory
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
	});

	return out.slice(0, settings.MIN_DRAWINGS_MEMORY);
}

function receiveTool(data, socket) {
	getDrawing(socket.drawID, function(drawing) {
		if (drawing != null) {
			drawing.broadcastTool(data, socket);
		}
	});
}

// Send drawing data to client
function sendDrawing(data, socket) {
	var drawID = data.drawID;
	getDrawing(drawID, function(drawing) {
		var output = drawing.getJson();
		socket.drawID = drawID; // link socket to drawing - useful for disconnects and stuff
		socket.emit("update_drawing", drawing.getJson());
	}); 
}

// Adds a layer from raw data coming from the socket
function receiveLayer(data, socket) {
	var layer = data;
	var drawID = layer.drawID;
	if (
		!validation.checkDrawID(drawID) ||
		!validation.checkLayerCode(layer.code)
	) { // invalid draw ID or layer code supplied
		return; // nothing to do, there is no client side confirmation -yet
	} else {
		getDrawing(drawID, function(drawing) {
			if (drawing == null) {
				console.log("WARNING: "+drawID+" does not exist!");
			} else {
				var layerID = drawing.addLayer(layer);
				drawing.broadcastLayer(layerID, layer, socket);
				drawing.handleFlatten();
			}	
		});
	}
}

function send404(res) {
	res.status(404).render("404.html")
}

function renderDrawingPage(req, res) {
	var drawID = req.params.id
	if (!validation.checkDrawID(drawID)) { // check code is valid
		send404(res);
	} else {
		getDrawing(drawID, function(drawing) {
			if (drawing != null) {
				res.render("drawing.html", { 
					settings: settings,
					drawID: drawID,
					width: settings.DRAWING_PARAMS.width,
					height: settings.DRAWING_PARAMS.height
				});	
			} else {
				send404(res);
			}
		});
	}
}

// Return png image as buffer
function sendDrawingImage(req, res) {
	var drawID = req.params.id.replace(".png", "");
	if (!validation.checkDrawID(drawID)) { // check code is valid
		send404(res);
	} else {
		getDrawing(drawID, function(drawing) {
			if (drawing == null) {
				send404(res)	
			} else {
				var layer = drawing.getUnmergedLayer(0);
				var buf = base64ToBuffer(layer.base64);
				res.writeHead(200, {
					'Content-Type': 'image/png',
					'Content-Length': buf.length
				});
				res.end(buf);	
			}
		});
	}
}

// Create a blank canvas image to draw on
function createDrawing(req, res) {
	// 1. Find a unique drawing ID
	makeDrawID(function(drawID) {
		if (drawID == null) { // exceeded max tries
			console.log("WARNING: Max tries exceeded")
			res.send("error");
			return;
		}

		// 2. Set up the drawing
		// Create empty image
		var params = settings.DRAWING_PARAMS;
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
			var layer = bufferToLayer(drawID, buffer);
			var drawing = new Drawing(drawID, layer);
			res.send(drawID);
			// console.log("Drawing "+drawID+" created.");
		});
	});
}

function bufferToLayer(drawID, bufferIn) {
	var base64 = "data:image/png;base64,"+(bufferIn.toString('base64'));
	var layer = {
		drawID: drawID,
		base64: base64, 
		offsets: {top: 0, right: 0, bottom: 0, left: 0},
		code: randomString(settings.LAYER_CODE_LEN)
	};
	return layer;
}

// Make a unique drawing ID by attempting to random generate one up to n times
function makeDrawID(callback) {
	var maxTries = 10;
	var nTries = 0;
	var newDrawID;

	function recurse() {
		newDrawID = randomString(settings.ID_LEN);
		getDrawing(newDrawID, function(drawing) {
			if (drawing == null) {
				callback(newDrawID)
			} else {
				nTries += 1
				if (nTries >= maxTries) {
					callback(null);
				} else {
					recurse();
				}
			}
		});
	}
	recurse();
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

function getDrawing(drawID, loadCallback) {
	var drawing = drawings.get(drawID);	
	if (typeof(loadCallback) === "undefined") { // return the value - can be null or not null
		drawing.setSaveTimeout(); // pip the timout
		return drawing;
	} else if (typeof(loadCallback) !== "undefined") { // callback the value
		if (drawing != null) {
			drawing.setSaveTimeout(); // pip the timout
			loadCallback(drawing);
		} else {
			loadImage(drawID, loadCallback);
		}
	}
}

// Save a drawing to disk
function saveImage(drawID, data, callback) {
	var outFilepath = settings.IMAGES_DIR+"/"+drawID+".png"
	fs.writeFile(outFilepath, data, callback);
}

// Try to load a drawing from disk
function loadImage(drawID, callback) {
	// must sanitise the drawID
	var inFilepath = settings.IMAGES_DIR+"/"+drawID+".png"
	sharp(inFilepath).png().toBuffer().then(function(buffer) {
		var layer = bufferToLayer(drawID, buffer);
		var drawing = new Drawing(drawID, layer);
		callback(drawing);				
	}).catch(function(err) {
		callback(null);
	});
}
// Stores the data for a drawing
function Drawing(idIn, startLayer) {
	this.id = idIn;
	this.layers = new AssocArray();
	this.socketNS = null; // contains all the sockets attached to this drawing
	this.isFlattening = false;
	this.flattenTimeout = null;
	this.emptyImage = true; // whether the PNG is empty
	this.isModified = false; // whether the image has been modified since loading from disk
	this.saveTimeout = null;
	this.lastEdited = null;
	// used to generate unique sequential layer IDs
	// Keeps going up, even after baking the image into a new single layer
	this.nLayers = 0;

	this.init = function(startLayer) {
		this.addLayer(startLayer);
		this.isModified = false; // intial image is not modified
		this.setSaveTimeout();
		drawings.set(this.id, this);
		this.configureDrawingNS();
		console.log("["+drawings.getLength()+"] total, drawing created");
	}

	this.destroy = function() {
		// remove the drawing from the array storage
		drawings.remove(this.id)

		// we must properly delete our socket namespace, otherwise we end up
		// with a disastrous memory leak problem

		// fetch the identifiers of the sockets
		var socketsConnected = Object.keys(this.socketNS.connected);

		// disconnect all sockets
		for (var i = 0; i < socketsConnected.length; i++) {
			var socketID = socketsConnected[i];
			this.socketNS.connected[socketID].disconnect();
		}

		// remove socket event listeners
		this.socketNS.removeAllListeners();

		// finally, remove the socket namespace
		delete io.nsps["/drawing_socket_"+this.id];

		// debug
		console.log("["+drawings.getLength()+"] total, drawing destroyed");
	}

	// Broadcast all drawing data to all sockets
	this.broadcast = function() {
		var self = this;
		this.socketNS.emit("update_drawing", self.getJson());
	}

	// Set up drawing-specific event handlers for the socket namespace endpoints
	this.configureDrawingNS = function() {

		// set up the drawing's socket namespace
		var drawingNS = io.of("/drawing_socket_"+this.id);
		this.addSocketNS(drawingNS);

		// set up the event handlers for each endpoint
		drawingNS.on('connection', function(socket) {

			// Returns the drawing data to the client. The callback method is placed here
			// so that we can pass the socket in as well
			socket.on("get_drawing", function(data) { 
				// validate
				if (
					typeof(data.drawID) == undefined ||
					!validation.checkDrawID(data.drawID)
				) {
					socket.emit("update_drawing", "error");
				} else {
					sendDrawing(data, socket);	
				}
			});

			// Update drawing with mouse cursor info (might break)
			socket.on("receive_tool", function(data) { receiveTool(data, socket); });

			// Receive new png draw data as base64 encoded string and add to the Drawing
			socket.on("add_layer", function(data) { receiveLayer(data, socket); });

			// disconnect a socket
			socket.on("disconnect", function() {
				// console.log("Disconnect from "+this.id);
				// nothing to do
			});
		});
	}

	// Set rolling timeout for saving drawing data to disk
	// For deletion, it would be better to run a scan at intervals and delete where needed
	this.setSaveTimeout = function() {
		if (this.saveTimeout) {
			clearTimeout(this.saveTimeout);
			this.saveTimeout = null;
		}
		var self = this;
		this.saveTimeout = setTimeout(function() {
			if (self.emptyImage) { // don't save empty images, just delete them
				self.destroy();
				return;
			}
			var baseBuf = base64ToBuffer(self.getUnmergedLayer(0).base64); // base image
			sharp(baseBuf).png().toBuffer().then(function(buffer) {

				// only remove from memory if it falls outside the window
				if (self.isModified) { // save modified image
					saveImage(self.id, buffer, function(err) {
						self.deleteIfOldEnough();	
						// console.log("Saved image and destroyed");
					});	
				} else { // not modified - just cleanup, don't save
					self.deleteIfOldEnough();
				}
			});
		}, settings.MEMORY_TIMEOUT);
	}

	// Decide whether this drawing is old enough to be deleted, delete if it is.
	// Old enough means it falls outside the window
	this.deleteIfOldEnough = function() {
		var entries = drawings.getValues();
		var self = this;
		// Sort with newest at the top
		entries.sort(function(a, b) {
			var diff = b.lastEdited.getTime() - a.lastEdited.getTime();
			return diff;
		});

		// Slice the entries
		var entries = entries.slice(0, settings.MIN_DRAWINGS_MEMORY);

		// Is this drawing inside the top most recent drawings?
		var inWindow = false;
		entries.forEach(function(entry) {
			if (entry.id == self.id) {
				inWindow = true;
			}
		});
		if (!inWindow) {
			this.destroy();
		}
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
		// console.log("["+this.nLayers+", "+layerObj.code+"] layer added");
		this.layers.set(this.nLayers, layerObj);
		this.updateEdited();
		this.isModified = true;
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

	// Handles timeout logic for flattening. Called from outside and also inside
	// after flatten completetion for new layers
	this.handleFlatten = function() {
		if (this.flattenTimeout) {
			// Timout already exists
			clearTimeout(this.flattenTimeout)
			this.flattenTimeout = null;
		}
		if (this.getNStoredLayers() > settings.MAX_LAYERS) {
			// Max layers reached - always flatten at this point
			this.flatten();
		} else {
			// Not reached max layers,  so set a rolling timout
			var self = this;
			this.flattenTimeout = setTimeout(function() {
				// console.log("Flatten timeout triggered");
				self.flatten();
			}, settings.FLATTEN_TIMEOUT);
		}
	}

	// Merges the layers into a single image. This is a pretty expensive operation.
	// Not called from outside
	this.flatten = function() {
		if (this.isFlattening) {
			// console.log("Already being flattened!");
			return;
		}
		this.isFlattening = true;
		// must increment at the beginning to avoid new layers getting overwritten

		// make room for the flattened image
		this.nLayers++;
		var flattenedLayerID = this.nLayers;
		// console.log("["+flattenedLayerID+"] Started flattening");

		// String codes of the component layers of the flatten
		var componentCodes = []

		function flattenRecursive(self, baseBuf, ind) {
			var overlay = self.getUnmergedLayer(ind + 1); // overlay base 64 

			// NOTE - sometimes an extra layer gets added during the end step.
			// And that layer is not part of the component codes.
			// It looks broken but still works since the extra layer is resting in memory
			// When the client requests the drawing, the extra layer will be sent

			// We could mop this up with some extra calls, but it works so not a priority

			if (overlay != null) { // we must merge a layer

			// no limit to the amount of stuff flattened
			// if (ind < settings.MAX_LAYERS && overlay != null) { // we must merge a layer

				// not reached the end yet - so overlay the image
				componentCodes.push(overlay.code);
				var overlayBuf = base64ToBuffer(overlay.base64);
				var overlayParams = {top: overlay.offsets.top,  left: overlay.offsets.left};
				sharp(baseBuf).overlayWith(overlayBuf, overlayParams).toBuffer().then(
					function(buffer) {
						flattenRecursive(self, buffer, ++ind);
					}
				);

			} else { // reached the end - no more layers to merge
				// now we must convert the image to base 64 encoded string again
				sharp(baseBuf).png().toBuffer().then(function(buffer) {

					// save the image to disk
					saveImage(self.id, buffer, function(err) {

						// set flattened image into the drawing and broadcast the results
						var base64 = "data:image/png;base64,"+(buffer.toString('base64'));

						// Remove old layers but not new ones					
						var keys = self.layers.getKeys();
						for (var i = 0; i < keys.length; i++) {
							var key = keys[i];
							if (parseInt(key) < flattenedLayerID) {
								self.layers.remove(key);
							}
						}

						// Add the new flattened layer
						self.layers.set(flattenedLayerID, {
							id: flattenedLayerID,
							base64: base64, 
							offsets: {top: 0, right: 0, bottom: 0, left: 0},
							code: randomString(settings.LAYER_CODE_LEN),
							components: componentCodes
						});
						// console.log("["+flattenedLayerID+"] Drawing has been flattened, "+ind+" layers total");
						// console.log("Here are the components:");
						// console.log(componentCodes);

						// now we must update each client
						self.broadcast();
						self.isFlattening = false;
						self.emptyImage = false;
						self.setSaveTimeout();
					});
				});
			}
		}

		// make sure there is stuff to do
		var nLayers = this.getNStoredLayers();
		if (nLayers <= 1) {
			// This shouldn't happen, so log a warning
			// console.log("[WARNING] flatten() called with only "+nLayers+" stored layers");
			return;
		}

		var baseLayer = this.getUnmergedLayer(0);
		var baseBuf = base64ToBuffer(baseLayer.base64); // base image
		componentCodes.push(baseLayer.code);
		var self = this;
		flattenRecursive(self, baseBuf, 0);
	}

	this.init(startLayer);
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
		// if (this.get(key)) {
		// 	console.log("Replacing existing layer!");
		// }
		this.values[key] = value;
	}
	this.getLength = function() {
		return this.getKeys().length;
	}
	this.getKeys = function() {
		return Object.keys(this.values);
	}
	this.getValues = function() {
		return Object.values(this.values);
	}		

	this.getJson = function() {
		return JSON.stringify(this.values);	
	}
	this.empty = function() {
		this.values = {}
	}
	this.remove = function(key) {
		delete this.values[key]
	}
};

// For performance measurements
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
