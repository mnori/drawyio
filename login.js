// Login flow
var bcrypt = require('bcrypt');

function login(req, res, app) {
	console.log("Query:")
	console.log(req.query);
	var username = req.query.username;
	var password = req.query.password;

	var user = new app.models.User(app);
	user.name = username;
	user.load(function() {
		console.log("username: ["+username+"]")
		console.log("password: ["+password+"]")
		res.send({"error": "The username and/or password were incorrect."});
	});
}

module.exports = {
	login: login
};