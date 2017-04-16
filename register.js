var bcrypt = require('bcrypt');

// Code to register users goes here

function register(req, res, app) {
	console.log("register() invoked");
	console.log(req.query);

	var errors = [];

	// Check password submission
	var pw1 = req.query.pw1;
	var pw2 = req.query.pw2;
	if (!app.validation.checkPassword(pw1) || !app.validation.checkPassword(pw2)) {
		errors.push("Password must be at least "+
			app.settings.PASSWORD_MIN_LEN+" characters long.")
	}
	if (pw1 != pw2) {
		errors.push("Passwords must match.");
	}

	// Check CAPTCHA response exists
	if (!req.query["g-recaptcha-response"]) { // user has not done the recaptcha
		console.log("No captcha response");
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
		checkErrorsAndContinue(req, res, errors);
	});
}

function checkErrorsAndContinue(req, res, errors) {
	if (errors.length > 0) { // single place where errors are send to client
		res.send({"errors": errors});
	} else {
		console.log("CAPTCHA check passed!");
		createUser(req, res);
	}
}

function createUser(req, res) {
	// now we need to create the user object

	// create a salted password
	var password = req.query.pw1;
	// var salt = 

	var userID = 1; // dummy user ID. definitely change this!!!!!!
	res.send({"userID": userID});	
}

module.exports = {
	register: register
};

