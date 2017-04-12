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
const database = require("./database") // Our db wrapper

// Associative array containing [alphanumeric code] => [drawing object]
var drawings;
var db = null; // filled later

// Set up the app
function main() {
	setupDebug();
	db = new database.DB(settings.DB_CONNECT_PARAMS);
	db.query("USE "+settings.DB_NAME+";");
	drawings = new AssocArray();
	nunjucks.configure("templates", {express: app});
	configureRoutes(app);
	cleanup(settings);
	server.listen(settings.PORT);
	console.log("Running on http://localhost:" + settings.PORT);
}

// Set up all the basic http endpoints
function configureRoutes(app) {

	// Tell node to serve static files from the "public" subdirectory
	app.use(express.static("public"));

	// Create a new drawing in memory, and return its unique ID to the client
	app.get("/create_room", createRoom);

	// Create a new drawing in memory, and return its unique ID to the client
	app.get("/create_snapshot", createSnapshot);

	// Render a drawing's page or its image
	app.get("/r/:id", function(req, res) {
		req.params.id.includes(".png") ? 
			sendRoomImage(req, res) : 
			renderRoomPage(req, res);
	});

	// Render snapshot page or image
	app.get("/s/:id", function(req, res) {
		req.params.id.includes(".png") ? 
			sendSnapshotImage(req, res) : 
			renderSnapshotPage(req, res);
	});

	// The index page (will be replaced with something else soon)
	app.get("/", function(req, res) { 
		getGallery({"type": "room"}, function(entries) {
			res.render("index.html", { 
				settings: settings,
				entries: entries
			});
		});
	}); 

	// Galleries page
	app.get("/gallery/:type", function(req, res) {
		console
		var galType = (req.params.type == "rooms") ? "room" : "snapshot";
		var titleTxt = (galType == "room") ? "Rooms" : "Snapshots";
		getGallery({"type": galType}, function(entries) {
			res.render("galleries.html", { 
				settings: settings,
				entries: entries,
				type: galType,
				titleTxt: titleTxt
			});
		});
	});

	// Galleries AJAX - can switch between rooms or snapshots
	app.get("/ajax/gallery/:type", function(req, res) { 
		var galType = (req.params.type == "rooms") ? "room" : "snapshot";
		req.query.type = galType;
		getGallery(req.query, function(entries) {
			res.render("gallery_"+req.query.type+"s.html", { 
				settings: settings,
				entries: entries
			});
		});
	});

	// Default action if nothing else matched - 404
	app.use(function(req, res, next) { send404(res); })
}

function getGallery(params, callback) {
	console.log(params);
	if (params["type"] == "room") {
		getGalleryRooms(params, callback);
	} else if (params["type"] == "snapshot") {
		getGallerySnapshots(params, callback);
	} else {
		console.log("Invalid type ["+params["type"]+"]")
	}
}

function getGallerySnapshots(params, callback) {
	var out = []
	var timestamp = parseInt(params.oldestTime);
	var dateFilter = (typeof(params.oldestTime) == "undefined") ? "" :
		"AND created < FROM_UNIXTIME("+timestamp+")";

	db.query([
		"SELECT * FROM snapshot",
		"WHERE is_private = '0'",
		dateFilter,
		"ORDER BY created DESC",
		"LIMIT 0, "+settings.MIN_DRAWINGS_MEMORY
	].join("\n"), function(results, fields, error) {

		// Arrange into template format
		results.forEach(row => {
			// Generate the row of data for the template
			var agoStr = getAgo(row["created"])
			out.push({ 
				row: row, 
				unixtime: new Date(row.created).getTime() / 1000,
				ago: agoStr
			});	
		});

		// Respond with the filled out template
		callback(out);
	});
}

function getGalleryRooms(params, callback) {
	var out = []
	var timestamp = parseInt(params.oldestTime);
	var dateFilter = (typeof(params.oldestTime) == "undefined") ? "" :
		"AND created < FROM_UNIXTIME("+timestamp+")";

	db.query([
		"SELECT * FROM room",
		"WHERE is_private = '0'",
		dateFilter,
		"ORDER BY modified DESC",
		"LIMIT 0, "+settings.MIN_DRAWINGS_MEMORY
	].join("\n"), function(results, fields, error) {

		// Arrange into template format
		results.forEach(row => {

			// Generate the row of data for the template
			var nUsers = 0;
			var roomMemory = drawings.get(row.id);
			if (roomMemory != null) {
				nUsers = roomMemory.getNSockets();
			}
			var agoStr = getAgo(row["modified"])
			out.push({ 
				row: row, 
				nUsers: nUsers,
				ago: agoStr,
				unixtime: new Date(row.created).getTime() / 1000
			});	
		});

		// Respond with the filled out template
		callback(out);
	});
}

function receiveTool(data, socket) {
	if (
		typeof(socket.drawID) == undefined || 
		!validation.checkRoomID(socket.drawID)
	) {
		return;
	}
	getRoom(socket.drawID, function(drawing) {
		if (drawing != null) {
			drawing.broadcastTool(data, socket);
		}
	});
}

// Send drawing data to client
function sendRoom(data, socket) {
	var drawID = data.drawID;
	getRoom(drawID, function(drawing) {
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
		!validation.checkRoomID(drawID) ||
		!validation.checkLayerCode(layer.code)
	) { // invalid draw ID or layer code supplied
		return; // nothing to do, there is no client side confirmation -yet
	}
	getRoom(drawID, function(drawing) {
		if (drawing == null) {
			console.log("WARNING: "+drawID+" does not exist!");
		} else {
			var layerID = drawing.addLayer(layer);
			drawing.broadcastLayer(layerID, layer, socket);
			drawing.handleFlatten();
		}	
	});
}

function send404(res) {
	res.status(404).render("404.html", {settings: settings})
}

function renderRoomPage(req, res) {
	var roomID = req.params.id
	if (!validation.checkRoomID(roomID)) { // check code is valid
		send404(res);
	} else {
		getRoom(roomID, function(room) {
			if (room != null) {
				console.log(room.name)
				console.log(settings.DEFAULT_ROOM_NAME)
				var snapshotName = (room.name != settings.DEFAULT_ROOM_NAME) ? 
					room.name : settings.DEFAULT_SNAPSHOT_NAME;
				res.render("room.html", { 
					settings: settings,
					room: room,
					snapshotName: snapshotName,
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
function sendRoomImage(req, res) {
	var roomID = req.params.id.replace(".png", "");
	if (!validation.checkRoomID(roomID)) { // check code is valid
		send404(res);
	} else {
		loadImage(settings.ROOMS_DIR+"/"+roomID+".png", function(buffer) {
			if (buffer == null) { // not found
				send404(res);
				return;
			}
			res.writeHead(200, {
				'Content-Type': 'image/png',
				'Content-Length': buffer.length
			});
			res.end(buffer);
		});
	}
}

function renderSnapshotPage(req, res) {
	console.log("renderSnapshotPage() invoked");
	var snapID = req.params.id.replace(".png", "");
	if (!validation.checkSnapshotID(snapID)) { // check code is valid
		send404(res);
	} else {
		getSnapshot(snapID, function(snapshot) {
			if (snapshot != null) {
				res.render("snapshot.html", { snapshot: snapshot, settings: settings });	
			} else {
				send404(res);
			}
		});
	}
}

function sendSnapshotImage(req, res) {
	var snapID = req.params.id.replace(".png", "");
	if (!validation.checkSnapshotID(snapID)) { // check code is valid
		console.
		send404(res);
	} else {
		loadImage(settings.SNAPSHOTS_DIR+"/"+snapID+".png", function(buffer) {
			if (buffer == null) { // not found
				send404(res);
				return;
			}
			res.writeHead(200, {
				'Content-Type': 'image/png',
				'Content-Length': buffer.length
			});
			res.end(buffer);
		});
	}
}

// Create a blank canvas image to draw on
// Alternatively, create a room from a snapshot
function createRoom(req, res) {

	var name = req.query.name.substr(0, settings.SNAPSHOT_NAME_LEN);
	var isPrivate = req.query.isPrivate === "true" ? "1" : "0";

	// validate the snapshot ID
	var snapshotID = (typeof(req.query.snapshotID) == "undefined") ? null :
		req.query.snapshotID;

	if (snapshotID && !validation.checkSnapshotID(snapshotID)) {
		res.send("error");
		return;
	}

	// 1. Find a unique drawing ID
	makeDrawID(function(drawID) {
		if (drawID == null) { // exceeded max tries
			console.log("WARNING: Max tries exceeded")
			res.send("error");
			return;
		}

		var bufferToRoom = function(buffer) {
			if (buffer == null) {
				console.log("Failed to create drawing from snapshot");
				return;
			}
			var layer = bufferToLayer(drawID, buffer);

			// create a dummy mysql row to initialise the object
			var nowMysql = getNowMysql();
			var fields = {
				"name": name,
				"is_private": isPrivate,
				"created": nowMysql,
				"modified": nowMysql
			}

			if (snapshotID) { // an optional field - originating snapshot
				fields["snapshot_id"] = snapshotID;
			}

			console.log("FIELDS");
			console.log(fields);

			// create room in memory
			var drawing = new Room(drawID, layer, fields);

			// respond with drawing ID
			res.send(drawID);
		}

		if (!snapshotID) {
			getEmptyBuffer(bufferToRoom);
		} else {
			getBufferFromSnapshot(snapshotID, bufferToRoom);
		}
	});
}

function getEmptyBuffer(callback) {
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
	png.toBuffer().then(callback);
}

// Try to load a drawing from disk
function getBufferFromSnapshot(snapshotID, callback) {
	// must sanitise the drawID
	var inFilepath = settings.SNAPSHOTS_DIR+"/"+snapshotID+".png"
	sharp(inFilepath).png().toBuffer().then(callback).catch(function(err) {
		console.log("Warning - getBufferFromSnapshot failed with "+drawID+"!")
		callback(null);
	});
}

function createSnapshot(req, res) {
	console.log("createSnapshot() invoked");
	var roomID = req.query.roomID;
	if (!validation.checkRoomID(roomID)) { 
		console.log("Validation failed");
		req.send("error");
		return;
	}

	var name = req.query.name.substr(0, settings.SNAPSHOT_NAME_LEN);
	var isPrivate = req.query.isPrivate === "true" ? "1" : "0";

	var errorStr = "Cannot create snapshot because the image has not yet been edited.";

	// get the room
	getRoom(roomID, function(room) {
		if (room == null) {
			res.json({"error": errorStr});
			return;
		}

		// create snapshot ID
		makeSnapshotID(function(snapID) {
			// copy the image into the right folder
			var sourceFilepath = settings.ROOMS_DIR+"/"+room.id+".png"
			var destFilepath = settings.SNAPSHOTS_DIR+"/"+snapID+".png"

			// copy file into a new snapshot file
			copyFile(sourceFilepath, destFilepath, function() {
				// now insert the entry into the database
				try {
					db.query([
						"INSERT INTO snapshot (id, room_id, name, is_private, created)",
						"VALUES (",
						"	'"+snapID+"',",
						"	'"+roomID+"',",
						"	"+db.esc(name)+",",
						"	'"+isPrivate+"',",
						"	NOW()",
						")",
					].join("\n"), function(results, fields, error) {
						// send response to client
						if (error) {
							// Error occured
							// Due to missing room ID
							// Drawing probably hasn't been saved yet
							res.json({"error": errorStr});

						} else {
							res.send(snapID);
						}
					})
				} catch (ex) {
					console.log("CAUGHT IT!");
					console.log(ex);
				}
			});
		});
	})
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
	makeRandomID(getRoom, callback, settings.ID_LEN);
}

// Make a unique drawing ID by attempting to random generate one up to n times
function makeSnapshotID(callback) {
	makeRandomID(getSnapshot, callback, settings.SNAPSHOT_ID_LEN);
}

function makeRandomID(getter, callback, length) {
	var maxTries = 10;
	var nTries = 0;
	var newID;

	function recurse() {
		newID = randomString(length);
		getter(newID, function(entity) {
			if (entity === null) {
				callback(newID)
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

function getRoom(drawID, loadCallback) {
	var drawing = drawings.get(drawID);	
	if (typeof(loadCallback) === "undefined") { // return the value - can be null or not null
		return drawing;
	} else if (typeof(loadCallback) !== "undefined") {
		if (drawing != null) { // already in memory
			loadCallback(drawing);
		} else { // drawing is not in memory. try to load it
			fetchRoom(drawID, loadCallback);
		}
	}
}

// checks mysql database, then disk
function fetchRoom(drawID, loadCallback) {
	console.log("fetchRoom() invoked");
	db.query("SELECT * FROM room WHERE id="+db.esc(drawID), function(results, fields) {
		if (results.length == 0) {
			loadCallback(null);
		} else {
			createRoomFromImage(drawID, loadCallback, results[0]);
		}
	});
}

// Try to load a drawing from disk
function createRoomFromImage(drawID, callback, fields) {
	// must sanitise the drawID
	var inFilepath = settings.ROOMS_DIR+"/"+drawID+".png"
	sharp(inFilepath).png().toBuffer().then(function(buffer) {
		var layer = bufferToLayer(drawID, buffer);
		var drawing = new Room(drawID, layer, fields, true);
		callback(drawing);				
	}).catch(function(err) {
		console.log("Warning - createRoomFromImage failed with "+drawID+"!")
		callback(null);
	});
}

// Save a drawing to disk
function saveImage(drawID, data, callback) {
	var outFilepath = settings.ROOMS_DIR+"/"+drawID+".png"
	fs.writeFile(outFilepath, data, callback);
}

// Stores the data for a drawing
function Room(idIn, startLayer, fields, isModified) {
	this.init = function(idIn, startLayer, fields, isModified) {
		var isModified = (isModified) ? true : false;
		this.id = idIn;
		this.name = fields.name;
		this.layers = new AssocArray();
		this.socketNS = null; // contains all the sockets attached to this drawing
		this.isFlattening = false;
		this.flattenTimeout = null;

		// whether the image has been modified since loading from disk
		this.isModified = false; 

		// rolling timeout for saving to disk
		this.saveTimeout = null;

		// used to generate unique sequential layer IDs
		// Keeps going up, even after baking the image into a new single layer
		this.nLayers = 0;

		if (isModified) {
			this.emptyImage = false;
			this.created = new Date(fields.created);
			this.modified = new Date(fields.modified);

		} else { // creating a new room from nothing
			this.emptyImage = true; // whether the PNG is empty

			// created and modified are right now
			this.created = new Date(); 
			this.modified = new Date();
		}
		this.snapshotID = (fields.snapshot_id == null) ? null : fields.snapshot_id;
		this.isPrivate = (fields.is_private == "1") ? true : false;

		// add the first layer, bypass the addLayer since it updates modified flags
		this.nLayers++;
		this.layers.set(this.nLayers, startLayer);

		this.isModified = false; // intial image is not modified
		drawings.set(this.id, this);
		this.configureRoomNS();
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
	this.configureRoomNS = function() {

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
					!validation.checkRoomID(data.drawID)
				) {
					socket.emit("update_drawing", "error");
				} else {
					sendRoom(data, socket);	
				}
			});

			// Update drawing with mouse cursor info
			// The server doesn't touch the tool - it just gets relayed to clients
			socket.on("receive_tool", function(data) { receiveTool(data, socket); });

			// Receive new png draw data as base64 encoded string and add to the Room
			socket.on("add_layer", function(data) { receiveLayer(data, socket); });

			// disconnect a socket
			socket.on("disconnect", function() {
				// console.log("Disconnect from "+this.id);
				// nothing to do
			});
		});
	}

	this.save = function() {
		var self = this;
		var baseBuf = base64ToBuffer(self.getUnmergedLayer(0).base64); // base image
		sharp(baseBuf).png().toBuffer().then(function(buffer) {
			if (self.isModified) { // save modified images
				saveImage(self.id, buffer, function(err) { // save image file to disk
					// insert or update the room in the database
					var snapSql = (self.snapshotID == null)
						? "NULL" : db.esc(self.snapshotID)
					db.query([
						"INSERT INTO room (id, snapshot_id, name, is_private, created, modified)",
						"VALUES (",
						"	"+db.esc(self.id)+",", // id
						"	"+snapSql+",", // snapshot_id
						"	"+db.esc(self.name)+",", // name
						"	"+(self.isPrivate ? "1" : "0")+",", // is_private
						"	FROM_UNIXTIME("+self.getCreatedS()+"),", // created
						"	FROM_UNIXTIME("+self.getModifiedS()+")", // modified
						")",
						"ON DUPLICATE KEY UPDATE",
						"	modified=FROM_UNIXTIME("+self.getModifiedS()+")"
					].join("\n"));
				});	
			} 
		});
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
		this.updateModified();
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
	this.updateModified = function() {
		this.modified = new Date();
	}

	this.getModifiedStr = function() {
		return getAgo(this.modified);
	}

	this.getCreatedS = function() {
		return this.getUnixtime(this.created);	
	};

	this.getModifiedS = function() {
		return this.getUnixtime(this.modified);
	};

	this.getUnixtime = function(val) {
		return parseInt(val.getTime() / 1000)
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

						// now we must update each client
						self.broadcast();
						self.isFlattening = false;
						self.emptyImage = false;
						self.save();
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
	this.init(idIn, startLayer, fields, isModified);
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

// Checks drawings in memory and deletes old stuff that has reached an expire time
function cleanup() {
	setTimeout(function() {
		var entries = drawings.getValues();
		// Sort with newest at the top
		entries.sort(function(a, b) {
			var diff = b.modified.getTime() - a.modified.getTime();
			return diff;
		});

		var nVisible = 0;
		entries.forEach(function(drawing) {
			var diff = new Date().getTime() - drawing.modified;
			var expired = diff >= settings.DELETE_TIME;
			// If drawing is empty and expired, delete it
			if (expired && (drawing.emptyImage || drawing.isPrivate)) {
				drawing.destroy();

			} else if (expired && !drawing.emptyImage) {
				nVisible += 1;

				// only delete if there is enough stuff for the front page
				if (nVisible > settings.MIN_DRAWINGS_MEMORY) {
					drawing.destroy();
				}
			}
		});

		cleanup();

	}, settings.CLEANUP_INTERVAL);
}

function getSnapshot(snapID, callback) {
	console.log("getSnapshot()");
	db.query("SELECT * FROM snapshot WHERE id="+db.esc(snapID), function(results, fields) {
		if (results.length == 0) {
			callback(null);
		} else {
			loadSnapshotImage(snapID, callback, results[0]);
		}
	});
}

// Try to load a drawing from disk
function loadSnapshotImage(snapID, callback, fields) {
	var inFilepath = settings.SNAPSHOTS_DIR+"/"+snapID+".png"
	sharp(inFilepath).png().toBuffer().then(function(buffer) {
		var snapshot = new Snapshot(snapID, buffer, fields);
		callback(snapshot);
	}).catch(function(err) {
		console.log("Warning - loadSnapshotImage failed with "+snapID+"!")
		callback(null);
	});
}

// Try to load a drawing from disk
function loadSnapshotImageSimple(snapID, callback, fields) {
	var inFilepath = settings.SNAPSHOTS_DIR+"/"+snapID+".png"
	sharp(inFilepath).png().toBuffer().then(function(buffer) {
		callback(buffer);
	}).catch(function(err) {
		console.log("Warning - loadSnapshotImageSimple failed with "+snapID+"!")
		callback(null);
	});
}

function loadImage(filepath, callback) {
	sharp(filepath).png().toBuffer().then(function(buffer) {
		callback(buffer);
	}, function(reason) {
		callback(null);
	});
}

// Stores a permanent snapshot of a drawing image
function Snapshot(snapID, buffer, fields) {
	this.init = function(snapID, buffer, fields) {
		this.id = snapID;
		this.buf = buffer;
		this.roomID = fields["room_id"]
		this.name = fields["name"]
		this.isPrivate = fields["is_private"] == 0 ? false : true;
		this.created = new Date(fields["created"]);
	}
	this.init(snapID, buffer, fields);
}

function copyFile(source, target, cb) {
	var cbCalled = false;

	var rd = fs.createReadStream(source);
	rd.on("error", done);

	var wr = fs.createWriteStream(target);
	wr.on("error", done);
	wr.on("close", function(ex) {
		done();
	});
	rd.pipe(wr);

	function done(err) {
		if (!cbCalled) {
			cb(err);
			cbCalled = true;
		}
	}
}

function getNowMysql() {
	return (new Date ((new Date((new Date(new Date())).toISOString() )).getTime() - ((new Date()).getTimezoneOffset()*60000))).toISOString().slice(0, 19).replace('T', ' ');
}

function getAgo(timestamp) {
	var diff = new Date() - timestamp;
	if (diff < 1000) { // less than 1 second = a moment ago
		return "A moment ago";
	}
	// otherwise use the string from the library
	return ta.ago(timestamp);
}

// Get the party started
main();
