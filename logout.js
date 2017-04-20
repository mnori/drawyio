var bcrypt = require('bcrypt');

// Logout backend flow
function logout(req, res, app) {
	res.send({"error": "Not yet implemented"});

	// // Load session
	// app.getSession(req, res, function(session) {

	// 	session.user.sessionID = null;
		

	// 	res.send(session.getClientData());	
	// });

	// ... send sessionData at the end
}

module.exports = {
	logout: logout
};