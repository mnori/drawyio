var minifier = require('minifier')
var settings = require("./settings"); // Our settings

input = []
settings.CLIENT_JS.forEach(filename => {
	input.push(settings.JSDEV_PATH+"/"+filename)
})

minifier.on('error', function(err) {
	console.log("Error occurred");
})
minifier.minify(input, {
	"output": settings.MINIFIED_CLIENT_PATH
});