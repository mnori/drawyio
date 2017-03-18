// Database migrations for drawy.io

const settings = require("./settings")
var database = require("./database");
var db = new database.DB(settings.DB_CONNECT_PARAMS);
db.sync = require('synchronize');

var migrations = [
	{ 
		name: "beginning", 
		run: function() {
			db.querySync("DROP DATABASE IF EXISTS drawyio")

			// create the database and use
			db.querySync("CREATE DATABASE drawyio");
			db.querySync("USE drawyio");

			// create room table
			db.querySync([
				"CREATE TABLE room (",
				"	id VARCHAR("+settings.LAYER_CODE_LEN+") PRIMARY KEY,",
				"	snapshot_id VARCHAR("+settings.LAYER_CODE_LEN+"),",
				"	last_active DATETIME NOT NULL",
				")"
			].join("\n"));

			// create snapshot table
			db.querySync([
				"CREATE TABLE snapshot (",
				"	id VARCHAR("+settings.LAYER_CODE_LEN+") PRIMARY KEY,",
				"	room_id VARCHAR("+settings.LAYER_CODE_LEN+") NOT NULL,",
				"	taken_on DATETIME NOT NULL",
				")"
			].join("\n"));



			// results = db.querySync('SHOW DATABASES');
			// console.log(results);
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