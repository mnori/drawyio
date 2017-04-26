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

	// Get session data, which includes the user object
	app.getSession(req, res, function(session) {
		if (!session.user) {
			res.send({"error": "Not logged in."});
			return;
		}
		var user = session.user;
		var errors = [];

		// Check existing password
		compare(req.query.pwCurr, user.password, function(err, bres) {
			if (!bres) { // password not OK
				errors.push("Existing password is incorrect.");
			}
			// Check new passwords fit criteria
			checkNew(req.query.pw1, req.query.pw2, errors, app);

			if (errors.length > 0) {
				res.send({"errors": errors});
				return;
			}

			var newPW = req.query.pw1;
			app.passwords.encrypt(newPW, app, function(err, hash) {
				if (err) {
					res.send({"error": "Could not create password."});
					return;
				}
				user.password = hash;
				// save user into database
				user.save(function(err) {
					if (err) {
						res.send({"error": "Could not save password."});
						return;
					}
					res.send("ok");
				});
			});
		});
	});
}

module.exports = {
	compare: compare,
	checkNew: checkNew,
	encrypt: encrypt,
	change: change
};