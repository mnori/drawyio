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

		// Is the password correct?
		bcrypt.compare(password, user.password, function(err, bres) {
			if (!bres) { // password not OK
				res.send({"error": errorMsg});
			} else { // password OK

				// 1. get the session using the request (req) object
				app.getSession(req, res, function(session) {
					
					// 2. set the session_id in the User object
					user.sessionID = session.id;
					user.save(function() {
						
						// 3. send some of the session / user data to the client
						console.log("Got session");
						console.log(session);
						console.log("username: ["+username+"]")
						console.log("password: ["+password+"]")	
						res.send(session.getClientData());
					});
				});
			}
		});
	});
}

module.exports = {
	login: login
};