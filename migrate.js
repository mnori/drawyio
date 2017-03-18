// Database migrations for drawy.io

const settings = require("./settings")
var database = require("./database");
var db = new database.DB(settings.DB_CONNECT_PARAMS);
db.sync = require('synchronize');

var migrations = [
	{ 
		name: "beginning", 
		run: function() {
			var results = db.querySync("DROP DATABASE IF EXISTS drawyio")
			db.querySync("CREATE DATABASE drawyio");
			results = db.querySync('SHOW DATABASES');
			console.log(results);
		}
	}
]

function migrate() {
	// fiber allows synchronous operations - avoids getting in a pickle with callbacks
	db.sync.fiber(function() {
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