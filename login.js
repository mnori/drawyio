var bcrypt = require('bcrypt');

// Login flow
function login(req, res, app) {
	var bcrypt = require('bcrypt');

	console.log("Query:")
	console.log(req.query);
	var username = req.query.username;
	var password = req.query.password;

	var user = new app.models.User(app);
	user.name = username;
	user.load(function(ok) {
		if (!ok) {
			res.send({"error": "The username and/or password were incorrect [2]."});
			return;
		}
		bcrypt.compare(password, user.password, function(err) {
			if (err) {
				console.log(err);
				res.send({"error": "The username and/or password were incorrect."});
			} else {
				// password was correct
				// link the user to the sse
				console.log("username: ["+username+"]")
				console.log("password: ["+password+"]")	
				res.send("ok");
			}
		});
	});
}

module.exports = {
	login: login
};