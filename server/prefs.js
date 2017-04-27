module.exports = {
	save: function(req, res, app) {
		console.log("prefs.save() invoked");
		console.log(req.query);
		res.send("ok");
	}
}