const utils = require("./utils") // Misc utilities
const validation = require("./validation") // Validation tools

// Data objects go here.

function init() {
	module.exports = {
		Snapshot: Snapshot,
		Room: Room
	};
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

// Stores the data for a drawing
function Room(idIn, startLayer, fields, isModified, app) {
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

		// add the first layer, bypass the addLayer since it updates modified flags
		this.nLayers++;
		this.layers.set(this.nLayers, startLayer);

		this.isModified = false; // intial image is not modified
		this.app.rooms.set(this.id, this);
		this.configureRoomNS();
		console.log("["+rooms.getLength()+"] total, drawing created");
	}

	this.destroy = function() {
		// remove the drawing from the array storage
		this.app.rooms.remove(this.id)

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
		delete this.app.io.nsps["/drawing_socket_"+this.id];

		// debug
		console.log("["+this.app.rooms.getLength()+"] total, drawing destroyed");
	}

	// Broadcast all drawing data to all sockets
	this.broadcast = function() {
		var self = this;
		this.socketNS.emit("update_drawing", self.getJson());
	}

	// Set up drawing-specific event handlers for the socket namespace endpoints
	this.configureRoomNS = function() {

		// set up the drawing's socket namespace
		var drawingNS = this.app.io.of("/drawing_socket_"+this.id);
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
	this.init(idIn, startLayer, fields, isModified, app);
}

init();