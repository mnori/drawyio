// Code to register users goes here

function register(req, res, app) {
	var errors = [];

	// Check password submission
	var pw1 = req.query.pw1;
	var pw2 = req.query.pw2;
	
	app.passwords.check(pw1, pw2, errors, app);

	// Check CAPTCHA response exists
	if (!req.query["g-recaptcha-response"]) { // user has not done the recaptcha
		errors.push("Please respond to \"I'm not a robot\".");
	}

	// Don't check the CAPTCHA until all the other stuff passes
	if (errors.length > 0) {
		checkErrorsAndContinue(req, res, errors);
		return;	
	}
	
	app.recaptcha.verify(req, function(error) { // Ask google if CAPTCHA is valid
		if (error) { // some other problem with the user's response
			errors.push("Invalid \"I'm not a robot\" response. Please try again.");
		}
		checkErrorsAndContinue(req, res, errors, app);
	});
}

function checkErrorsAndContinue(req, res, errors, app) {
	if (errors.length > 0) { // single place where errors are send to client
		res.send({"errors": errors});
	} else {
		createUser(req, res, app);
	}
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

