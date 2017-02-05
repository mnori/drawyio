"use strict";

var fs = require('fs');
var util = require('util');

const express = require("express");
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
	configureEndpoints(app);
	app.listen(PORT);
	console.log("Running on http://localhost:" + PORT);
}

// Set up all the endpoints
// Probably shouldn't put too much code in here
function configureEndpoints(app) {
	// Tell node to serve static files from the "public" subdirectory
	app.use(express.static("public"))

	// Create a new drawing in memory, and return its unique ID to the client
	app.get("/create_drawing", function (req, res) {

		// 1. Find a unique drawing ID
		var drawID = makeDrawID();
		if (drawID == null) { // exceeded max tries
			console.log("WARNING: Max tries exceeded")
			res.send("error");
			return;
		}

		// 2. Set up the drawing
		// Consider using a background queue to generate the empty image here
		drawings.set(drawID, {
			test: "value"
		});

		// 3. Send the unique drawing ID to the client
		res.send(drawID);

		console.log("["+drawings.getLength()+"] total drawings.")
	});

	// Go to a drawing's page
	app.get("/drawings/:id", function (req, res) {
		var drawID = req.params.id

		if (drawings.get(drawID)) {
			res.send("You've reached ["+drawID+"].");
		} else {
			send404(res);
		}
	});
}

function send404(res) {
	res.status(404).sendFile(__dirname+"/public/404.html");
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

// Define a nice java-like associative array wrapper with cleaner methods than plain JS.
function AssocArray() {
	this.values = {};
	this.get = function(key) {

		// this ugly check is the main thing we're interested in wrapping here.
		if (typeof(this.values[key]) !== 'undefined') {
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

// Override console.log so it gets output to a nice file, easier to check
// The log files get emptied every restart
function setupDebug() {
	var debugFilepath = __dirname+'/debug.log'
	var log_file = fs.createWriteStream(debugFilepath, {flags : 'w'});
	var log_stdout = process.stdout;
	console.log = function(d) { //
		log_file.write(util.format(d) + '\n');
		log_stdout.write(util.format(d) + '\n');
	};
}

// get the party started
main();
