// node.js server for drawy.io
// (c) Matthew Norris 2017

"use strict";

const fs = require("fs");
const util = require("util");
const express = require("express"); // A node.js framework
const nunjucks = require("nunjucks"); // Template system
const sharp = require("sharp"); // Image processing library
const nano = require('nanoseconds'); // For measuring performance
const app = express();

// for socket.io
const server = require("http").Server(app)
const io = require("socket.io")(server)

const PORT = 8080; // Which port to expose to the outside world
const ID_LEN = 16; // The length of the ID string for drawings
const MAX_LAYERS = 10; // Max number of layers to store before flattening the image
const DRAWING_PARAMS = { // Parameters for creating blank drawings
	width: 400,
	height: 400,
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
	configureSocket()
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

// Set up all the socket actions
function configureSocket() {
	// Listen for incoming connections from clients
	io.sockets.on('connection', function (socket) {
		// This is where we should send drawing init data

		// Returns the drawing data to the client. The callback method is placed here
		// so that we can pass the socket in as well
		socket.on("get_drawing", function(data) { sendDrawing(data, socket); });

		// Receive new png draw data as base64 encoded string and add to the stack
		socket.on('add_layer', addLayer);
	});
}

// we'll also want a broadcastDrawing() method for when the image is flattened
function sendDrawing(data, socket) {
	var drawID = data.drawID;
	socket.emit("update_drawing", drawings.get(drawID).getJson());
}

function addLayer(data) {
	var drawID = data.drawID;
	var drawing = drawings.get(drawID);
	if (drawing == null) {
		console.log("WARNING: "+drawID+" does not exist!");
	} else {
		// console.log("Found ["+drawID+"]")
		// just store the raw base64 encoded string here since we'll have to transmit 
		// multiple pics using JSON...
		drawing.addLayer(data.base64)

		if (drawing.getNStoredLayers() >= MAX_LAYERS) {
			console.log("Max layers exceeded");
		}

		// KEEP THIS - it converts base64 to a proper PNG image
		// This line sends the event (broadcasts it)
		// to everyone except the originating client.
		// socket.broadcast.emit('moving', data);
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
		drawings.set(drawID, new Drawing(drawID, base64));
		res.send(drawID);
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
	var debugFilepath = __dirname+"/debug.log"
	var log_file = fs.createWriteStream(debugFilepath, {flags : "w"});
	var log_stdout = process.stdout;
	console.log = function(d) { //
		log_file.write(util.format(d) + "\n");
		log_stdout.write(util.format(d) + "\n");
	};
}

function Drawing(idIn, startImage) {
	this.id = idIn;
	this.layers = new AssocArray();

	// used to generate unique sequential layer IDs
	// Keeps going up, even after baking the image into a new single layer
	this.nLayers = 0; 

	this.addLayer = function(layer) {
		this.nLayers++;
		this.layers.set(this.nLayers, layer);
	}
	this.getLayer = function(layerID) { // is this even needed?
		return this.layers.get(layerID)
	}
	this.getNStoredLayers = function() { return this.layers.getLength(); }
	this.getJson = function() { return this.layers.getJson(); }
	this.addLayer(startImage)
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
		return Object.keys(this.values).length;
	}
	this.getJson = function() {
		return JSON.stringify(this.values);	
	}
};

// For performance measurement
function Timeline() {
	this.entries = [];
	this.log = function(name) {
		var ts = nano(process.hrtime())
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
				console.log("["+prevEntry.name+"] => ["+currEntry.name+"] "+diffNs+" ms")
			}
			prevEntry = currEntry;
		}
	}
}

// Get the party started
main();
