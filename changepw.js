// Change password

function changePw(req, res, app) {
	var errors = [];

	res.send("error": "Not yet implemented");

	// Check new passwords
	var pw1 = req.query.pw1;
	var pw2 = req.query.pw2;
	
	app.passwords.checkNew(pw1, pw2, errors, app);



	// // Check CAPTCHA response exists
	// if (!req.query["g-recaptcha-response"]) { // user has not done the recaptcha
	// 	errors.push("Please respond to \"I'm not a robot\".");
	// }

	// // Don't check the CAPTCHA until all the other stuff passes
	// if (errors.length > 0) {
	// 	checkErrorsAndContinue(req, res, errors);
	// 	return;	
	// }
	
	// app.recaptcha.verify(req, function(error) { // Ask google if CAPTCHA is valid
	// 	if (error) { // some other problem with the user's response
	// 		errors.push("Invalid \"I'm not a robot\" response. Please try again.");
	// 	}
	// 	checkErrorsAndContinue(req, res, errors, app);
	// });
}

module.exports = {
	changePw: changePw
};