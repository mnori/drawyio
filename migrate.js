// Database migrations for drawy.io

const settings = require("./settings")
var database = require("./database");
var db = new database.DB(settings.DB_CONNECT_PARAMS);
var sync = require('synchronize');

var migrations = [
	{ 
		name: "beginning", 
		run: function() {
			db.querySync("DROP DATABASE IF EXISTS drawyio", sync)
			db.querySync("CREATE DATABASE drawyio", sync);
			var results = db.querySync('SHOW DATABASES', sync);
			console.log(results);
		}
	}
]

function migrate() {
	// fiber allows synchronous operations
	sync.fiber(function() {
		try {
			console.log("Started migration.");
			for (var i = 0; i < migrations.length; i++) {
				migration = migrations[i];
				migration.run();
				console.log("["+(i + 1)+": "+migration.name+"] migrated");
			}
			console.log("Finished migration.");
			process.exit(); 
		} catch (err) {
			console.log("Something went wrong:");
			console.log(err);
		}
	});
}

migrate();

// if we do this, it's going to quit before the async shiz has finished running
// definitely need to wait until mysql operations are finished
// consider using Promise to solve the issue