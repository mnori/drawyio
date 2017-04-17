var bcrypt = require('bcrypt');

// Login flow
function login(req, res, app) {
	var bcrypt = require('bcrypt');

	var errorMsg = "The username and/or password were incorrect."

	console.log("Query:")
	console.log(req.query);
	var username = req.query.username;
	var password = req.query.password;

	var user = new app.models.User(app);
	user.name = username;
	user.load(function(ok) {
		if (!ok) {
			// username is wrong
			res.send({"error": errorMsg});
			return;
		}
		bcrypt.compare(password, user.password, function(err, bres) {
			if (!bres) { // password not OK
				res.send({"error": errorMsg});
			} else { // password OK
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