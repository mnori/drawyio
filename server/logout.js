var bcrypt = require('bcrypt');

// Logout backend flow
function logout(req, res, app) {
	// Load session
	app.getSession(req, res, function(session) {
		// Detach the session from the user. save updated user into the database
		var user = session.user; 
		if (!user) {
			res.send({"error": "User not found, cannot log out"});
			return;
		}
		user.sessionID = null;
		user.save(function() {

			// Change the nickname back to the default
			session.name = app.settings.DEFAULT_NICK;
			session.user = null;
			session.save(function() {
				// send updated sessionData at the end		
				res.send(session.getClientData());
			});
		});
	});
}

module.exports = {
	logout: logout
};