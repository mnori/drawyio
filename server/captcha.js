// Check google captcha response

function check(req, app, errors, callback) {

	if (app.settings.IGNORE_CAPTCHA) {
		callback(true);
		return;
	}

	if (!req.query["g-recaptcha-response"]) { // user has not done the recaptcha
		errors.push("Please respond to \"I'm not a robot\".");
	}

	// Don't check the CAPTCHA until all the other stuff passes
	if (errors.length > 0) {
		callback(false)
		return;
	}
	
	app.recaptcha.verify(req, function(error) { // Ask google if CAPTCHA is valid
		if (error) { // some other problem with the user's response
			errors.push("Invalid \"I'm not a robot\" response. Please try again.");
			callback(false);
			return;
		}
		callback(true);
	});
}

module.exports = {
	check: check
};