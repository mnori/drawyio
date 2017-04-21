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
	} else {
		editSnapshot(req, res, app);
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

		room.isPrivate = req.query["isPrivate"] != "0" ? true : false;
		room.isDeleted = req.query["isDeleted"] != "0" ? true : false;
		room.saveDB(function() {
			res.send("ok");	
		});
	});
}

function editSnapshot(req, res, app) {
	if (!app.validation.checkSnapshotID(req.query["id"])) {
		res.send({"error": "Snapshot ID is invalid."});
		return;
	}
	app.getSnapshot(req.query["id"], function(snapshot) {
		if (snapshot == null) {
			res.send({"error": "Snapshot not found."});
			return;
		}
		snapshot.isPrivate = req.query["isPrivate"] != "0" ? true : false;
		snapshot.isDeleted = req.query["isDeleted"] != "0" ? true : false;
		snapshot.isStaffPick = req.query["isStaffPick"] != "0" ? true : false;

		snapshot.save(app, function() {
			res.send("ok");	
		});
	});
}

module.exports = {
	handleRequest: handleRequest
};