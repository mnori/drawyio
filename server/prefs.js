module.exports = {
	save: function(req, res, app) {
		app.getSession(req, res, function(session) {
			session.prefs.hideGalleryWarning = req.query["hideGalleryWarning"] == "true" ? true : false;
			session.prefs.save(function() {
				res.send("ok");
			});
		});
	}
}