var bcrypt = require('bcrypt');

// Login backend flow
function login(req, res, app) {
	var bcrypt = require('bcrypt');

	var errorMsg = "The username and/or password were incorrect."

	var username = req.query.username;
	var password = req.query.password;

	if (!username || !password) { // check for blank fields
		res.send({"error": "Please enter a username and password."})
		return;
	}

	var user = new app.models.User(app);
	user.name = username;
	user.load(function(ok) {
		if (!ok) {
			// username is wrong
			res.send({"error": errorMsg});
			return;
		}

		// Is the password correct?
		app.passwords.compare(password, user.password, function(err, bres) {
			if (!bres) { // password not OK
				res.send({"error": errorMsg});

			} else { // password OK

				// Get session ID from cookie
				var sessionID = req.cookies.sessionID;
				if (sessionID === undefined) { 
					res.send({"error": "Invalid session."})
					return;
				}
				// Save the session_id in the User object
				user.sessionID = sessionID;
				user.save(function() {

					// Load session and send data to the client
					app.getSession(req, res, function(session) {
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