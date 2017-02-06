// node.js server for DrawCloud
// (c) Matthew Norris 2017

"use strict";

const fs = require("fs");
const util = require("util");
const express = require("express"); // Express is a node.js framework
const nunjucks = require("nunjucks"); // Template system
const sharp = require("sharp"); // Image processing library
const nano = require('nanoseconds'); // For measuring performance
const app = express();

const PORT = 8080; // Which port to expose to the outside world
const ID_LEN = 16 // The length of the ID string for drawings
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
	app.listen(PORT);
	console.log("Running on http://localhost:" + PORT);
}

// Set up all the endpoints
function configureRoutes(app) {
	// Tell node to serve static files from the "public" subdirectory
	app.use(express.static("public"))

	// Create a new drawing in memory, and return its unique ID to the client
	app.get("/create_drawing", createDrawing);

	// Go to a drawing's page
	app.get("/drawings/:id", renderDrawingPage);

	// Fetch a drawing image and output to the buffer
	app.get("/drawing_images/:id", getDrawingImage);

	// Index page, rendered as a template
	app.get("/", function(req, res) { res.render("index.html"); });

	// Default action if nothing else matched - 404
	app.use(function(req, res, next) { send404(res); })
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

// Get the drawing image data as buffer
function getDrawingImage(req, res) {
	var drawID = req.params.id;
	var drawing = drawings.get(drawID)

	if (drawing == null) { // drawing missing
		send404(res)
	} else { // drawing is present
		res.send(drawing.buffer);
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
	png.toBuffer(function(err, buffer, info) {
		drawings.set(drawID, {
			id: drawID,
			buffer: buffer
		});
		res.send(drawID);
		console.log("["+drawings.getLength()+"] total drawings.")
	})
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
    for(var i = 0; i < length; i++)
        text += charset.charAt(Math.floor(Math.random() * charset.length));
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
