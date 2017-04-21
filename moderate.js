// Moderation tools

function handleRequest(req, res, app) {
	console.log("handleRequest invoked with");
	console.log(req.query);
	res.send({"error": "Not yet implemented."});
	// res.send("ok");
}

module.exports = {
	handleRequest: handleRequest
};