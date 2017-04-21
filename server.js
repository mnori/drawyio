// node.js server for drawy.io
// (C) 2017 drawy.io

"use strict";

function App() {

	// IMPORTS
	const fs = require("fs");
	const util = require("util");
	const express = require("express"); // A node.js framework
	const nunjucks = require("nunjucks"); // Template system
	var sharp = this.sharp = require("sharp"); // Image processing library
	const nano = require('nanoseconds'); // For measuring performance
	const expressApp = express();
	const ta = require('time-ago')(); // set up time-ago human readable dates library
	const server = require("http").Server(expressApp) // set up socket.io
	this.io = require("socket.io")(server)

	var cookieParser = require('cookie-parser')
	this.recaptcha = require('express-recaptcha');

	var settings = this.settings = require("./settings") // Our settings
	this.validation = require("./validation") // Validation tools
	const database = require("./database") // Our db wrexpressApper
	var models = this.models = require("./models") // Data classes
	const register = require("./register") // Registration flow
	const utils = require("./utils") // Misc utilities
	const login = require("./login")
	const logout = require("./logout")
	const moderate = require("./moderate")

	// Associative array containing [alphanumeric code] => [drawing object]
	this.rooms = null;
	var db = null;
	var self = this;

	// Set up everything
	this.start = function() {
		setupDebug();
		process.on('unhandledRejection', function(err, promise) {
			console.error('Unhandled rejection (promise: ', promise, ', reason: ', err, ').');
		});
		this.recaptcha.init(settings.RECAPTCHA_SITE_KEY, settings.RECAPTCHA_SECRET_KEY);
		self.db = db = new database.DB(settings.DB_CONNECT_PARAMS);
		db.query("USE "+settings.DB_NAME+";");
		this.rooms = new utils.AssocArray();
		expressApp.use(cookieParser());
		nunjucks.configure("templates", {express: expressApp});
		configureRoutes(expressApp);
		cleanup(settings);
		server.listen(settings.PORT);
		console.log("Running on http://localhost:" + settings.PORT);
	}

	// Set up all URL endpoints
	function configureRoutes(expressApp) {

		// Tell node to serve static files from the "public" subdirectory
		expressApp.use(express.static("public"));

		// Create a new drawing in memory, and return its unique ID to the client
		expressApp.get("/ajax/create_room", createRoom);

		// Create a new drawing in memory, and return its unique ID to the client
		expressApp.get("/ajax/create_snapshot", createSnapshot);

		expressApp.get("/ajax/register", function(req, res) {
			register.register(req, res, app);
		});

		expressApp.get("/ajax/login", function(req, res) {
			login.login(req, res, app);
		});

		expressApp.get("/ajax/logout", function(req, res) {
			logout.logout(req, res, app);
		});

		expressApp.get("/ajax/set_session_name", setSessionName);

		// Moderation AJAX
		expressApp.get("/ajax/moderate", function(req, res) {
			moderate.handleRequest(req, res, app);
		});

		// Render a drawing's page or its image
		expressApp.get("/r/:id", function(req, res) {
			req.params.id.includes(".png") ? 
				sendRoomImage(req, res) : 
				renderRoomPage(req, res);	
		});

		// Render snapshot page or image
		expressApp.get("/s/:id", function(req, res) {
			req.params.id.includes(".png") ? 
				sendSnapshotImage(req, res) : 
				renderSnapshotPage(req, res);
		});

		// The index page (will be replaced with something else soon)
		expressApp.get("/", function(req, res) { 
			self.getSession(req, res, function(session) {
				getGallery({"type": "room"}, function(entries, reachedEnd) {
					res.render("index.html", { 
						entries: entries,
						settings: settings,
						sessionData: session.getClientDataJson(),
						reachedEnd: reachedEnd
					});
				});
			});
		}); 

		// Galleries page
		expressApp.get("/gallery/:type", function(req, res) {
			var galType = (req.params.type == "rooms") ? "room" : "snapshot";
			var titleTxt = (galType == "room") ? "Rooms" : "Snapshots";
			self.getSession(req, res, function(session) {
				getGallery({"type": galType}, function(entries, reachedEnd) {
					res.render("galleries.html", { 
						entries: entries,
						type: galType,
						titleTxt: titleTxt,
						settings: settings,
						sessionData: session.getClientDataJson(),
						reachedEnd: reachedEnd
					});
				});
			});
		});

		// Galleries AJAX - can switch between rooms or snapshots
		expressApp.get("/ajax/gallery/:type", function(req, res) { 
			var galType = (req.params.type == "rooms") ? "room" : "snapshot";
			req.query.type = galType;
			getGallery(req.query, function(entries, reachedEnd) {
				res.render("gallery_"+req.query.type+"s.html", { 
					settings: settings,
					entries: entries,
					reachedEnd: reachedEnd
				});
			});
		});

		// Default action if nothing else matched - 404
		expressApp.use(function(req, res, next) { send404(res); })
	}

	// Adds session cookie to request
	// Response must be passed in to set the cookie
	this.getSession = function(req, res, callback) {
		// check if client sent cookie
		var cookie = req.cookies.sessionID;
		if (cookie === undefined || !self.validation.checkSessionID(cookie)) { 
			// no/invalid cookie so create one
			// {} means there is no user object
			createSession({}, req, res, callback);

		} else { 
			// check for session in database. no session? create new cookie
			// create new session as well
			loadSession(req, res, cookie, callback);
		}
	}

	// Perhaps this method should be attached to the Session object?
	function loadSession(req, res, sessionID, callback) {
		var sql = [
			"SELECT ",
			"	session.id 				as session_id,",
			"	session.name 			as session_name,",
			"	session.ip_address 		as session_ip_address,",
			"	session.last_active 	as session_last_active,",

			"	user.id 				as user_id,",
			"	user.name 				as user_name,",
			"	user.session_id 		as user_session_id,",
			"	user.password 			as user_password,",
			"	user.type 				as user_type,",
			"	user.joined	 			as user_joined",

			"FROM session",
			"LEFT JOIN user ON",
			"	session.id = user.session_id",
			"WHERE",
			"	session.id = "+db.esc(sessionID)
		].join("\n");

		db.query(
			sql, 
			function(results, fields, error) {
				if (!results || results.length == 0) { // not in database
					createSession(null, req, res, callback); // create new session
					return;
				} else {
					// session is in DB
					var row = results[0];
					var session = new models.Session(req, app);
					session.id = row["session_id"];
					session.name = row["session_name"];
					addUserToSession(row, session);

					// save to update the last_active and ip address
					session.save(callback);
				}
			}
		);
	}

	function addUserToSession(row, session) {
		if (row["user_id"] == null) { // no user
			return;
		}
		var user = new models.User(app);
		user.populate(row);
		session.user = user;
	}

	// Create a session cookie in the database
	function createSession(row, req, res, callback) {

		// generate new session ID
		var sessionID = utils.randomString(settings.SESSION_ID_LEN);

		// add cookie to response
		res.cookie('sessionID', sessionID, { httpOnly: true });

		// insert session data into the DB
		var session = new models.Session(req, app);
		session.id = sessionID;
		session.name = "Anonymous";

		if (row) {
			addUserToSession(row, session);
		}
		session.save(callback);
	}

	function setSessionName(req, res, callback) {
		var nick = req.query.name;
		if (!nick) {
			res.send({"error": "Nickname cannot be empty."})
			return;
		}

		// is there a User with the same name?
		var user = new models.User(app);
		user.name = nick;
		user.load(function(nameTaken) {
			if (nameTaken && user.name != "Anonymous") {
				res.send({"error": "Sorry, that name is taken."})
			} else {
				self.getSession(req, res, function(session) {
					session.name = nick;
					session.save(function(session, error) {
						if (error) {
							res.send({"error": "Could not save name to DB."})
						} else {
							res.send(session.getClientData());	
						}
					});
				});
			}
		});
	}

	function getGallery(params, callback) {
		if (params["type"] == "room") {
			getGalleryRooms(params, callback);
		} else if (params["type"] == "snapshot") {
			getGallerySnapshots(params, callback);
		} else {
			console.log("Invalid type ["+params["type"]+"]")
		}
	}

	// we should probably merge this and the next function somewhat, lots of
	// duplicated logic, especially for paging
	function getGallerySnapshots(params, callback) {
		var out = []
		var timestamp = parseInt(params.oldestTime);
		var dateFilter = (!params.oldestTime) ? "" :
			"AND created < FROM_UNIXTIME("+timestamp+")";
		var pageSize = settings.MIN_DRAWINGS_MEMORY;

		db.query([
			"SELECT * FROM snapshot",
			"WHERE is_private = '0'",
			dateFilter,
			"ORDER BY created DESC",
			"LIMIT 0, "+(pageSize + 1)
		].join("\n"), function(results, fields, error) {
			if (!results) {
				callback(out);
				return;
			}

			// Arrange into template format
			var max = (results.length < pageSize) ? results.length : pageSize;
			for (var i = 0; i < max; i++) {
				var row = results[i];

				// Generate the row of data for the template
				var agoStr = getAgo(row["created"])
				out.push({ 
					row: row, 
					unixtime: new Date(row.created).getTime() / 1000,
					ago: agoStr
				});	
			};

			// check if reached end
			var reachedEnd = results.length < (pageSize + 1);

			// Respond with the filled out template
			callback(out, reachedEnd);
		});
	}

	function getGalleryRooms(params, callback) {
		var out = []
		var timestamp = parseInt(params.oldestTime);
		var dateFilter = (!params.oldestTime) ? "" :
			"AND created < FROM_UNIXTIME("+timestamp+")";
		var pageSize = settings.MIN_DRAWINGS_MEMORY;

		db.query([
			"SELECT * FROM room",
			"WHERE is_private = '0'",
			dateFilter,
			"ORDER BY modified DESC",
			"LIMIT 0, "+(pageSize + 1)
		].join("\n"), function(results, fields, error) {

			if (!results) {
				callback(out);
				return;
			}

			// Arrange into template format
			var max = (results.length < pageSize) ? results.length : pageSize;
			for (var i = 0; i < max; i++) {
				var row = results[i];

				// Generate the row of data for the template
				var nUsers = 0;
				var roomMemory = self.rooms.get(row.id);
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
			};

			// check if reached end
			var reachedEnd = results.length < (pageSize + 1);

			// Respond with the filled out template
			callback(out, reachedEnd);
		});
	}

	this.receiveTool = function(data, socket) {
		if (
			typeof(socket.drawID) == undefined || 
			!self.validation.checkRoomID(socket.drawID)
		) {
			return;
		}
		self.getRoom(socket.drawID, function(drawing) {
			if (drawing != null) {
				drawing.broadcastTool(data, socket);
			}
		});
	}

	// Send drawing data to client
	this.sendRoom = function(data, socket) {
		var drawID = data.drawID;
		self.getRoom(drawID, function(drawing) {
			var output = drawing.getJson();
			socket.drawID = drawID; // link socket to drawing - useful for disconnects and stuff
			socket.emit("update_drawing", drawing.getJson());
		}); 
	}

	// Adds a layer from raw data coming from the socket
	this.receiveLayer = function(data, socket) {
		var layer = data;
		var drawID = layer.drawID;
		if (
			!self.validation.checkRoomID(drawID) ||
			!self.validation.checkLayerCode(layer.code)
		) { // invalid draw ID or layer code supplied
			return; // nothing to do, there is no client side confirmation -yet
		}
		self.getRoom(drawID, function(drawing) {
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
		if (!self.validation.checkRoomID(roomID)) { // check code is valid
			send404(res);
		} else {
			self.getSession(req, res, function(session) {
				self.getRoom(roomID, function(room) {
					if (room != null) {
						var snapshotName = (room.name != settings.DEFAULT_ROOM_NAME) ? 
							room.name : settings.DEFAULT_SNAPSHOT_NAME;
						res.render("room.html", { 
							room: room,
							snapshotName: snapshotName,
							width: settings.DRAWING_PARAMS.width,
							height: settings.DRAWING_PARAMS.height,
							settings: settings,
							sessionData: session.getClientDataJson()
						});	
					} else {
						send404(res);
					}
				});
			});
		}
	}

	// Return png image as buffer
	function sendRoomImage(req, res) {
		var roomID = req.params.id.replace(".png", "");
		if (!self.validation.checkRoomID(roomID)) { // check code is valid
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
		var snapID = req.params.id.replace(".png", "");
		if (!self.validation.checkSnapshotID(snapID)) { // check code is valid
			send404(res);
		} else {
			self.getSession(req, res, function(session) {
				self.getSnapshot(snapID, function(snapshot) {
					if (snapshot != null) {
						res.render("snapshot.html", { 
							snapshot: snapshot, 
							settings: settings,
							sessionData: session.getClientDataJson()
						});	
					} else {
						send404(res);
					}
				});
			});
		}
	}

	function sendSnapshotImage(req, res) {
		var snapID = req.params.id.replace(".png", "");
		if (!self.validation.checkSnapshotID(snapID)) { // check code is valid
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

		if (snapshotID && !self.validation.checkSnapshotID(snapshotID)) {
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
				var nowMysql = utils.getNowMysql();
				var fields = {
					"name": name,
					"is_private": isPrivate,
					"created": nowMysql,
					"modified": nowMysql
				}

				if (snapshotID) { // an optional field - originating snapshot
					fields["snapshot_id"] = snapshotID;
				}

				// create room in memory
				var drawing = new models.Room(drawID, layer, fields, false, app);

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
		var roomID = req.query.roomID;
		if (!self.validation.checkRoomID(roomID)) { 
			console.log("Validation failed");
			req.send("error");
			return;
		}

		var name = req.query.name.substr(0, settings.SNAPSHOT_NAME_LEN);
		var isPrivate = req.query.isPrivate === "true" ? "1" : "0";

		var errorStr = "Cannot create snapshot because the image has not yet been edited.";

		// get the room
		self.getRoom(roomID, function(room) {
			if (room == null) {
				res.json({"error": errorStr});
				return;
			}

			// create snapshot ID
			makeSnapshotID(function(snapID) {
				// copy the image into the right folder
				var sourceFilepath = settings.ROOMS_DIR+"/"+room.id+".png"
				var destFilepath = settings.SNAPSHOTS_DIR+"/"+snapID+".png"

				// copy file into a snapshot file
				copyFile(sourceFilepath, destFilepath, function() {
					// now insert the entry into the database
					var snapshot = new models.Snapshot();

					snapshot.id = snapID;
					snapshot.roomID = roomID;
					snapshot.name = name;
					snapshot.isPrivate = isPrivate;

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
			code: utils.randomString(settings.LAYER_CODE_LEN)
		};
		return layer;
	}

	// Make a unique drawing ID by attempting to random generate one up to n times
	function makeDrawID(callback) {
		makeRandomID(self.getRoom, callback, settings.ID_LEN);
	}

	// Make a unique drawing ID by attempting to random generate one up to n times
	function makeSnapshotID(callback) {
		makeRandomID(self.getSnapshot, callback, settings.SNAPSHOT_ID_LEN);
	}

	function makeRandomID(getter, callback, length) {
		var maxTries = 10;
		var nTries = 0;
		var newID;

		function recurse() {
			newID = utils.randomString(length);
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

	this.getRoom = function(drawID, loadCallback) {
		var drawing = self.rooms.get(drawID);	
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
			var drawing = new models.Room(drawID, layer, fields, true, app);
			callback(drawing);				
		}).catch(function(err) {
			console.log("Warning - createRoomFromImage failed with "+drawID+"!")
			callback(null);
		});
	}

	// Save a drawing to disk
	this.saveImage = function(drawID, data, callback) {
		var outFilepath = settings.ROOMS_DIR+"/"+drawID+".png"
		fs.writeFile(outFilepath, data, callback);
	}

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

	// Checks rooms in memory and deletes old stuff that has reached an expire time
	function cleanup() {
		setTimeout(function() {
			var entries = self.rooms.getValues();
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

	this.getSnapshot = function(snapID, callback) {
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
			var snapshot = new models.Snapshot();

			// TODO move this into Snapshot class
			snapshot.id = fields["id"]
			snapshot.roomID = fields["room_id"];
			snapshot.name = fields["name"];
			snapshot.isPrivate = fields["is_private"] == 0 ? false : true;
			snapshot.isDeleted = fields["is_deleted"] == 0 ? false : true;
			snapshot.isStaffPick = fields["is_staff_pick"] == 0 ? false : true;
			snapshot.created = new Date(fields["created"]);
			
			callback(snapshot);
		}).catch(function(err) {
			console.log("Warning - loadSnapshotImage failed with ["+inFilepath+"]")
			console.log(err);
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

	function getAgo(timestamp) {
		var diff = new Date() - timestamp;
		if (diff < 1000) { // less than 1 second = a moment ago
			return "A moment ago";
		}
		// otherwise use the string from the library
		return ta.ago(timestamp);
	}
}

// Get the party started
var app = new App();
app.start();

