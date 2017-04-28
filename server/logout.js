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

		// When user logs out, we must create new prefs and save them to the object

		session.prefs = new app.models.Prefs(session.app);
		session.prefs.save(function() {
			session.prefsID = session.prefs.id;

			// Change the nickname back to the default
			session.name = app.settings.DEFAULT_NICK;
			session.user = null;
			session.userID = null; // we must unlink the user from this session
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