var bcrypt = require('bcrypt');

// Check passwords 1 & 2 match and are above certain length
function check(pw1, pw2, errors, app) {
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

module.exports = {
	check: check,
	encrypt: encrypt
};