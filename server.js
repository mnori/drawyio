"use strict";

const express = require("express");

// Which port to expose to the outside world
const PORT = 8080;

// The length of the ID string for drawings
const ID_LEN = 16

// Override console.log so it gets output to a nice file, easier to check
var fs = require('fs');
var util = require('util');
var log_file = fs.createWriteStream(__dirname + '/debug.log', {flags : 'w'});
var log_stdout = process.stdout;
console.log = function(d) { //
	log_file.write(util.format(d) + '\n');
	log_stdout.write(util.format(d) + '\n');
};

// App
const app = express();

var drawings = {}

// Tell node to serve files from the "public" subdirectory
app.use(express.static("public"))

// Non-static example
app.get("/test", function (req, res) {
  res.send("This is not static.\n");
});

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
	drawings[drawID] = {
		test: "value"
	}

	// 3. Send the unique drawing ID to the client
	res.send(drawID);
});

app.listen(PORT);
console.log("Running on http://localhost:" + PORT);

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
	} while(typeof(drawings[drawID]) !== 'undefined');
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