// Moderation tools

function handleRequest(req, res, app) {
	// get session and do permission check on it
	app.getSession(req, res, function(session) {
		if (!session || !session.isMod()) {
			res.send({"error": "You don't have permission to do that."});		
		} else {
			process(req, res, app);
		}
	});
}

function process(req, res, app) {
	if (req.query["type"] == "room") {
		editRoom(req, res, app);
	} else { // ... snapshot
		res.send({"error": "Snapshot mod tools not yet implemented."});		
	}
}

function editRoom(req, res, app) {
	if (!app.validation.checkRoomID(req.query["id"])) {
		res.send({"error": "Room ID is invalid."});
		return;
	}
	app.getRoom(req.query["id"], function(room) {
		if (room == null) {
			res.send({"error": "Drawing not found."});
			return;
		}

		room.isPrivate = req.query["isPrivate"];
		room.isDeleted = req.query["isDeleted"];
		room.saveDB(function() {
			res.send("ok");	
		});
	});
}

module.exports = {
	handleRequest: handleRequest
};