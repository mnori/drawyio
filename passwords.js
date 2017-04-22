var bcrypt = require('bcrypt');

// Compare password against its hash
function compare(pw, hash, callback) {
	bcrypt.compare(pw, hash, callback);
}

// Check passwords 1 & 2 match and are above certain length
// Used on registration and password changes
function checkNew(pw1, pw2, errors, app) {
	if (!app.validation.checkPassword(pw1) || !app.validation.checkPassword(pw2)) {
		errors.push("Password must be at least "+
			app.settings.PASSWORD_MIN_LEN+" characters long.")
	}
	if (pw1 != pw2) {
		errors.push("Passwords must match.");
	}
}

function encrypt(password, app, callback) {
	bcrypt.genSalt(app.settings.PASSWORD_SALT_ROUNDS, function(err, salt) {
		bcrypt.hash(password, salt, callback);
	});
}

// Change password form
function change(req, res, app) {
	console.log("change() invoked");
	console.log(req.query);
	res.send({"error": "Not yet implemented"});
}

module.exports = {
	compare: compare,
	checkNew: checkNew,
	encrypt: encrypt,
	change: change
};