

function login(req, res, app) {
	console.log("Query:")
	console.log(req.query);
}

module.exports = {
	login: login
};