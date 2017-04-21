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
	var params = req.query;

	if (params["type"] == "room") {

	} else {
		// ... snapshot
	}

	console.log("Reached process() with params:");
	console.log(params);
	res.send("ok");
}

module.exports = {
	handleRequest: handleRequest
};