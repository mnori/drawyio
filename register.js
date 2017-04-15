// Code to register users goes here

function register(req, res, app) {
	console.log("register() invoked");
	console.log(app.validation);

	var errors = [];
	if (!req.query["g-recaptcha-response"]) { // user has not done the recaptcha
		console.log("No captcha response");
		errors.push("Please respond to \"I'm not a robot\".");
		res.send({"error": errors});
		return
	}
	app.recaptcha.verify(req, function(error) {
		if (error) { // some other problem with the user's response
			errors.push("Invalid \"I'm not a robot\" response. Please try again.");
			res.send({"error": errors});

		} else { // all checks passed
			console.log("CAPTCHA check passed!");
			var userID = 1; // dummy user ID. definitely change this!!!!!!
			res.send({"userID": userID});	
		}
	});
}

module.exports = {
	register: register
};

