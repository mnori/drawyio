var minifier = require('minifier')
var settings = require("./settings"); // Our settings

settings.CLIENT_JS.forEach(val => {
	console.log(val);
})

// var input = '/some/path'
// minifier.on('error', function(err) {
// 	// handle any potential error
// })
// minifier.minify(input, options)