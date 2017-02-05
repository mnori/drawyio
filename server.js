"use strict";

var fs = require("fs");
var util = require("util");

const express = require("express");
const nunjucks = require("nunjucks")
const nano = require('nanoseconds');
const sharp = require("sharp")
const app = express();

// Which port to expose to the outside world
const PORT = 8080;

// The length of the ID string for drawings
const ID_LEN = 16

// Associative array containing [alphanumeric code] => [drawing object]
var drawings;

// Set up the app
function main() {
	setupDebug();	
	drawings = new AssocArray();
	nunjucks.configure("templates", {express: app});
	configureEndpoints(app);
	app.listen(PORT);
	d("Running on http://localhost:" + PORT);
}

// Set up all the endpoints
// Probably shouldn"t put too much code in here
function configureEndpoints(app) {
	// Tell node to serve static files from the "public" subdirectory
	app.use(express.static("public"))

	// Create a new drawing in memory, and return its unique ID to the client
	app.get("/create_drawing", function (req, res) {

		// 1. Find a unique drawing ID
		var drawID = makeDrawID();
		if (drawID == null) { // exceeded max tries
			d("WARNING: Max tries exceeded")
			res.send("error");
			return;
		}

		// 2. Set up the drawing
		// Consider using a background queue to generate the empty image here
		var width = 800;
		var height = 600;
		var channels = 4;
		var rgbaPixel = 0x00000000;
		var tl = new Timeline();

		tl.log("a");
		var canvas = Buffer.alloc(width * height * channels, rgbaPixel);
		drawings.set(drawID, {
			image: canvas
		});
		tl.log("b");
		tl.dump();

		// 3. Send the unique drawing ID to the client
		res.send(drawID);

		d("["+drawings.getLength()+"] total drawings.")
	});

	// Go to a drawing"s page
	app.get("/drawings/:id", function (req, res) {
		var drawID = req.params.id

		if (drawings.get(drawID)) {
			res.render("drawing.html", { drawID: drawID });
		} else {
			send404(res);
		}
	});

	// Tell it that index page should be rendered as a template
	app.get("/", function(req, res) {
		res.render("index.html");
	});

	// Default action - nothing to do so must send 404
	app.use(function (req, res, next) {
		send404(res);
	})

	app.get("*",function(req,res){
		res.send("default");
	});
}

function send404(res) {
	res.status(404).render("404.html")
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

// Override d so it gets output to a nice file, easier to check
// The log files get emptied every restart
function setupDebug() {
	var debugFilepath = __dirname+"/debug.log"
	var log_file = fs.createWriteStream(debugFilepath, {flags : "w"});
	var log_stdout = process.stdout;
	d = function(d) { //
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
		d("Timeline.dump() invoked")
		var currEntry;
		var prevEntry = null;
		for (var i = 0; i < this.entries.length; i++) {
			var currEntry = this.entries[i];
			if (prevEntry != null) {
				// convert nanoseconds to milliseconds
				var diffNs = (currEntry.ts - prevEntry.ts) / 1000000;
				d("["+prevEntry.name+"] => ["+currEntry.name+"] "+diffNs+" ms")
			}
			prevEntry = currEntry;
		}
	}
}

function d(str) {
	console.log(str)
}

// get the party started
main();
