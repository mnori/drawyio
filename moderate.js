// Moderation tools

function handleRequest(req, res, app) {
	console.log("handleRequest invoked with");
	console.log(req);
	res.send({"error": "Not yet implemented."});
}

module.exports = {
	handleRequest: handleRequest
};