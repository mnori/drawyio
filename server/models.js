const utils = require("./utils") // Misc utilities
const validation = require("./validation") // Validation tools

// Data objects and their methods go here.
function init() {
	module.exports = {
		Session: Session,
		User: User,
		Room: Room,
		Snapshot: Snapshot
	};
}

function Session(req, app) {
	var self = this;

	this.init = function(req, app) {
		// Sometimes there is no request, which leads to empty IP address
		// TODO fix this so it doesn't overwrite when IP is missing
		this.ipAddress = (req) ? req.connection.remoteAddress : "0.0.0.0";
		this.lastActive = new Date();
		this.prefsID = null;
		this.app = app;
		this.user = null;
		this.prefs = null;
	}

	// For returning session data to the client.
	// Obvs this should not include password or other sensitive fields
	this.getClientData = function() {
		console.log("self.prefs.hideGalleryWarning");
		console.log(self.prefs.hideGalleryWarning);
		var out = {
			"id": self.id,
			"name": (self.user) ? self.user.name : self.name,
			"type": (self.user) ? self.user.type : "guest",
			"prefs": {
				"hideGalleryWarning": self.prefs.hideGalleryWarning
			}
		}
		return out;
	}

	this.getClientDataJson = function() {
		return JSON.stringify(this.getClientData());
	}

	this.fetchPrefs = function(callback) {
		// it's up the register flow to transfer the prefs ID from the session to the user.
		if (self.prefs) {
			callback(self.prefs);
		} else {
			self.prefs = new Prefs(self.app);
			var prefsID = (self.user) ? self.user.prefsID : self.prefsID;
			if (prefsID == null) { // must create new prefs
				self.prefs.save(function() {
					self.prefsID = self.prefs.id; // new prefs are attached to session
					self.save(function() {
						callback(true);
					});
				});
			} else { // prefs ID already exists, so load the prefs.
				self.prefs.id = prefsID;
				self.prefs.load(function() {
					callback(true);
				});
			}	
		}
	}

	this.isMod = function() {
		if (!this.user || !this.user.isMod()) {
			return false;
		}
		return true;
	}

	this.addUser = function(row) {
		if (row["user_id"] == null) { // no user
			return;
		}
		var user = new self.app.models.User(app);
		user.populate(row);
		self.user = user;
	}

	this.load = function(callback) {
		var db = self.app.db;
		var sql = [
			"SELECT ",
			"	session.id 				as session_id,",
			"	session.name 			as session_name,",
			"	session.user_id 		as session_user_id,",
			"	session.prefs_id 		as session_prefs_id,",
			"	session.ip_address 		as session_ip_address,",
			"	session.last_active 	as session_last_active,",

			"	user.id 				as user_id,",
			"	user.name 				as user_name,",
			"	user.prefs_id			as user_prefs_id,",
			"	user.password 			as user_password,",
			"	user.type 				as user_type,",
			"	user.joined	 			as user_joined",

			"FROM session",
			"LEFT JOIN user ON",
			"	session.user_id = user.id",
			"WHERE",
			"	session.id = "+db.esc(self.id)
		].join("\n");

		db.query(
			sql, 
			function(results, fields, error) {
				if (!results || results.length == 0) { // not in database
					callback(false);
				} else {
					// session is in DB
					var row = results[0];

					self.id = row["session_id"];
					self.name = row["session_name"];
					self.prefsID = row["session_prefs_id"];
					self.addUser(row);

					// save to update the last_active and ip address
					console.log("before save()")
					self.save(function() {
						console.log("after save()")

						// could make this more efficient using a join
						self.fetchPrefs(callback);
					});
				}
			}
		);
	}

	this.save = function(callback) {
		var db = self.app.db;
		var nameStr = self.name ? db.esc(self.name) : "'Anonymous'";
		db.query([
			"INSERT INTO session (id, name, prefs_id, ip_address, last_active)",
			"VALUES (",
			"	"+db.esc(self.id)+",",
			"	"+nameStr+",",
			"	"+db.esc(self.prefsID)+",",
			"	"+db.esc(self.ipAddress)+",",
			"	FROM_UNIXTIME("+getUnixtime(self.lastActive)+")",
			") ON DUPLICATE KEY UPDATE",
			"	name = "+db.esc(self.name)+",",
			"	ip_address = "+db.esc(self.ipAddress)+",",
			"	prefs_id = "+db.esc(self.prefsID)+",",
			"	last_active = FROM_UNIXTIME("+getUnixtime(self.lastActive)+")"
		].join("\n"), function(results, fields, error) {
			callback();
		});
	}

	this.init(req, app);
}

// TODO make all of the model classes follow this pattern
// Pay attention to easy loading method
function User(app, id) {
	this.id = id ? id : null;
	this.name = null;
	this.sessionID = null;
	this.prefsID = null;
	this.password = null;
	this.joined = null;
	this.type = null;
	this.app = app;

	var self = this;

	this.init = function() {}

	this.load = function(callback) {
		var db = self.app.db;
		if (this.id) {
			whereStr = "id = "+db.esc(this.id);
		} else if (this.name) {
			whereStr = "name = "+db.esc(this.name);
		} else {
			console.log("Load with nothing!!!"); // should not happen
		}
		db.query("SELECT * FROM user WHERE "+whereStr, 
			function(results, fields, error) {
				if (!results || results.length == 0) {
					callback(false);
				} else {
					var row = results[0];
					self.populate(row);
					callback(true);
				}
			}
		);
	}

	this.isMod = function() {
		return this.type == "mod"; // or potentially admin in the future
	}

	this.populate = function(row) {
		row = self.stripPrefix(row);
		self.id = row["id"];
		self.name = row["name"];
		self.prefsID = row["prefs_id"];
		self.password = row["password"];
		self.type = row["type"];
		self.joined = new Date(row["joined"]);
	}

	// helper for when a join was used
	this.stripPrefix = function(row) {
		out = {}
		for (var property in row) {
    		out[property.replace("user_", "")] = row[property];
		}
		return out;
	}

	this.save = function(callback) {
		var db = self.app.db;

		console.log("prefsID: "+self.prefsID);

		// if the ID exists, the row is already in the DB, so update
		// Otherwise, we're creating a brand new user
		if (self.id) {
			updateSql = [
				"ON DUPLICATE KEY UPDATE ",
				"	password = "+db.esc(self.password),
			].join("\n");

		} else {
			updateSql = "";
		}

		db.query([
			"INSERT INTO user (id, name, prefs_id, password, type, joined)",
			"VALUES (",
			"	"+db.esc(self.id)+",",
			"	"+db.esc(self.name)+",",
			"	"+db.esc(self.prefsID)+",",
			"	"+db.esc(self.password)+",",
			"	"+db.esc(self.type)+",",
			"	FROM_UNIXTIME("+getUnixtime(self.joined)+")",
			")",
			updateSql
		].join("\n"), function(results, fields, error) {
			if (error) {
				callback(error)
			} else {
				if (results.insertId) {
					self.id = results.insertId;
				}
				callback()
			}
		});
	}
	this.init();
}

function Prefs(app) {
	var self = this;

	this.init = function(app) {
		self.app = app;
		self.id = null;
		self.hideGalleryWarning = false;
	}

	this.load = function(callback) {
		self.app.db.query(
			"SELECT * FROM prefs WHERE id="+self.id, 
			function(results, fields, error) {
				if (!results || results.length == 0) {
					callback(false);
				} else {
					var row = results[0];
					self.populate(row);
					callback(true);
				}
			}
		);
	}

	this.populate = function(row) {
		self.hideGalleryWarning = row["hide_gallery_warning"] == '1' ? true : false;
	}

	this.save = function(callback) {
		var db = self.app.db;

		// app.settings.SQL_DEBUG = true;

		if (!self.id) { // new preferences object
			// this inserts a row with default parameters and gets us an auto incremented id
			db.query([
				"INSERT INTO prefs ()",
				"VALUES ()"
			].join("\n"), function(results, fields, error) {
				self.id = results["insertId"];
				callback()
			});
		} else { // existing preferences object
			db.query([
				"UPDATE prefs SET",
				"	hide_gallery_warning = "+(self.hideGalleryWarning ? "'1'" : "'0'"),
				"WHERE id = "+db.esc(self.id)
			].join("\n"), function(results, fields, error) {
				callback()
			});
		}
	}

	this.init(app);
}

// Stores the data for a room
function Room(idIn, startLayer, fields, isModified, app) {
	var self = this;
	this.init = function(idIn, startLayer, fields, isModified, app) {
		var isModified = (isModified) ? true : false;
		this.id = idIn;
		this.name = fields.name;
		this.layers = new utils.AssocArray();
		this.socketNS = null; // contains all the sockets attached to this drawing
		this.isFlattening = false;
		this.flattenTimeout = null;
		this.app = app;

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
		this.isDeleted = (fields.is_deleted == "1") ? true : false;

		// add the first layer, bypass the addLayer since it updates modified flags
		this.nLayers++;
		this.layers.set(this.nLayers, startLayer);

		this.isModified = false; // intial image is not modified
		self.app.rooms.set(this.id, this);
		this.configureRoomNS();
		console.log("["+self.app.rooms.getLength()+"] total, drawing created");
	}

	this.destroy = function() {
		// remove the drawing from the array storage
		self.app.rooms.remove(this.id)

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
		delete self.app.io.nsps["/drawing_socket_"+this.id];

		// debug
		console.log("["+self.app.rooms.getLength()+"] total, drawing destroyed");
	}

	// Broadcast all drawing data to all sockets
	this.broadcast = function() {
		this.socketNS.emit("update_drawing", self.getJson());
	}

	// Set up drawing-specific event handlers for the socket namespace endpoints
	this.configureRoomNS = function() {

		// set up the drawing's socket namespace
		var drawingNS = self.app.io.of("/drawing_socket_"+this.id);
		this.addSocketNS(drawingNS);

		// set up the event handlers for each endpoint
		drawingNS.on('connection', function(socket) {

			// Returns the drawing data to the client. The callback method is placed here
			// so that we can pass the socket in as well
			socket.on("get_drawing", function(data) { 
				if (
					!data.drawID || !validation.checkRoomID(data.drawID) || 
					!data.sessionID || !validation.checkSessionID(data.sessionID)
				) {
					socket.emit("update_drawing", "error");
				} else {
					self.app.sendRoom(data, socket);
				}
			});

			// Update drawing with mouse cursor info
			// The server doesn't touch the tool - it just gets relayed to clients
			socket.on("receive_tool", function(data) { self.app.receiveTool(data, socket); });

			// Receive new png draw data as base64 encoded string and add to the Room
			socket.on("add_layer", function(data) { self.app.receiveLayer(data, socket); });

			// disconnect a socket
			socket.on("disconnect", function() {
				// console.log("Disconnect from "+this.id);
				// nothing to do
			});
		});
	}

	this.save = function() {
		var baseBuf = utils.base64ToBuffer(self.getUnmergedLayer(0).base64); // base image
		if (self.isModified) { // save modified images
			self.app.sharp(baseBuf).png().toBuffer().then(function(buffer) {
				self.app.saveImage(self.id, buffer, function(err) { // save image file to disk
					self.saveDB();			
				});	
			});
		} 
	}

	// just saves to the database. doesn't attempt to process the image
	this.saveDB = function(callback) {
		var db = self.app.db;
		var snapSql = (self.snapshotID == null)
			? "NULL" : db.esc(self.snapshotID);
		var isPrivate = self.isPrivate ? "'1'" : "'0'";
		var isDeleted = self.isDeleted ? "'1'" : "'0'";

		db.query([
			"INSERT INTO room (",
			"	id, snapshot_id, name, is_private, is_deleted, created, modified",
			")",
			"VALUES (",
			"	"+db.esc(self.id)+",", // id
			"	"+snapSql+",", // snapshot_id
			"	"+db.esc(self.name)+",", // name
			"	"+isPrivate+",",
			"	"+isDeleted+",", 
			"	FROM_UNIXTIME("+self.getCreatedS()+"),", // created
			"	FROM_UNIXTIME("+self.getModifiedS()+")", // modified
			")",
			"ON DUPLICATE KEY UPDATE",
			"	modified = FROM_UNIXTIME("+self.getModifiedS()+"),",
			"	is_private = "+isPrivate+",",
			"	is_deleted = "+isDeleted,
		].join("\n"), callback);
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
		return getUnixtime(val);
	}

	// Handles timeout logic for flattening. Called from outside and also inside
	// after flatten completetion for new layers
	this.handleFlatten = function() {
		if (this.flattenTimeout) {
			// Timout already exists
			clearTimeout(this.flattenTimeout)
			this.flattenTimeout = null;
		}
		if (this.getNStoredLayers() > self.app.settings.MAX_LAYERS) {
			// Max layers reached - always flatten at this point
			this.flatten();
		} else {
			// Not reached max layers,  so set a rolling timout
			this.flattenTimeout = setTimeout(function() {
				// console.log("Flatten timeout triggered");
				self.flatten();
			}, self.app.settings.FLATTEN_TIMEOUT);
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

		function flattenRecursive(baseBuf, ind) {
			var overlay = self.getUnmergedLayer(ind + 1); // overlay base 64 

			// NOTE - sometimes an extra layer gets added during the end step.
			// And that layer is not part of the component codes.
			// It looks broken but still works since the extra layer is resting in memory
			// When the client requests the drawing, the extra layer will be sent
			// We could mop this up with some extra calls, but it works so not a priority

			if (overlay != null) { // we must merge a layer

				// not reached the end yet - so overlay the image
				componentCodes.push(overlay.code);
				var overlayBuf = utils.base64ToBuffer(overlay.base64);
				var overlayParams = {top: overlay.offsets.top,  left: overlay.offsets.left};
				self.app.sharp(baseBuf).overlayWith(overlayBuf, overlayParams).toBuffer().then(
					function(buffer) {
						flattenRecursive(buffer, ++ind);
					}
				);

			} else { // reached the end - no more layers to merge
				// now we must convert the image to base 64 encoded string again
				self.app.sharp(baseBuf).png().toBuffer().then(function(buffer) {

					// save the image to disk
					self.app.saveImage(self.id, buffer, function(err) {

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
							code: utils.randomString(self.app.settings.LAYER_CODE_LEN),
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
		var baseBuf = utils.base64ToBuffer(baseLayer.base64); // base image
		componentCodes.push(baseLayer.code);
		flattenRecursive(baseBuf, 0);
	}
	this.init(idIn, startLayer, fields, isModified, app);
}

// Stores a permanent snapshot of a drawing image
function Snapshot() {
	var self = this;
	this.init = function() {
		this.id = null;
		this.buf = null;
		this.roomID = null;
		this.name = null;
		this.isPrivate = false;
		this.isDeleted = false;
		this.isStaffPick = false;
		this.created = null;
	}

	this.save = function(app, callback) {
		var db = app.db;

		console.log(self.isPrivate);

		var isPrivate = self.isPrivate ? "'1'" : "'0'";
		var isDeleted = self.isDeleted ? "'1'" : "'0'";
		var isStaffPick = self.isStaffPick ? "'1'" : "'0'";

		db.query([
			"INSERT INTO snapshot (",
			"	id, room_id, name, is_private, is_deleted, is_staff_pick, created",
			")",
			"VALUES (",
			"	"+db.esc(this.id)+",",
			"	"+db.esc(this.roomID)+",",
			"	"+db.esc(this.name)+",",
			"	"+isPrivate+",",
			"	"+isDeleted+",",
			"	"+isStaffPick+",",
			"	NOW()",
			") ON DUPLICATE KEY UPDATE",
			"	is_private = "+isPrivate+",",
			"	is_deleted = "+isDeleted+",",
			"	is_staff_pick = "+isStaffPick
		].join("\n"), callback);
	}
	this.init();
}

function getUnixtime(val) {
	return parseInt(val.getTime() / 1000)
}

init();