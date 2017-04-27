// Code to register users goes here

function register(req, res, app) {
	var errors = [];

	// Check password submission
	var pw1 = req.query.pw1;
	var pw2 = req.query.pw2;
	app.passwords.checkNew(pw1, pw2, errors, app);

	// Check captcha
	app.captcha.check(req, app, errors, function() {
		if (errors.length > 0) {
			res.send({"errors": errors});
		} else {
			createUser(req, res, app); // all checks passed, register user
		}
	});
}

function createUser(req, res, app) {

	// create a salted password string	
	var password = req.query.pw1;
	app.passwords.encrypt(password, app, function(err, hash) {
		if (err) {
			res.send({"error": "Could not create password."});
			return;
		}

		// get session data to help fill out the user data
		app.getSession(req, res, function(session) {

			// fill out user data
			var user = new app.models.User(app);
			user.name = session.name;
			user.sessionID = session.id;
			user.prefsID = session.prefsID;
			user.password = hash;
			user.type = "user";
			user.joined = new Date();

			// save user into database
			user.save(function(err) {
				if (err) {
					// This is a rare case since we already check the username on the
					// nickname dialog, just before the register dialog
					res.send({"error": "The username you have chosen is not available."});
					return;
				}
				session.user = user;

				// now update the session with the user ID
				res.send(session.getClientDataJson())
			});
		});
	});
}

module.exports = {
	register: register
};

