// Database migrations for drawy.io

const settings = require("./settings")
var database = require("./database");
var db = new database.DB(settings.DB_CONNECT_PARAMS);
db.sync = require('synchronize');

var migrations = [
	{ 
		name: "beginning", 
		run: function() {
			db.querySync("DROP DATABASE IF EXISTS "+settings.DB_NAME)

			// create the database and use
			db.querySync("CREATE DATABASE "+settings.DB_NAME);
			db.querySync("USE "+settings.DB_NAME);

			// note - this way of entering the sql is a bit cumbersome.
			// could try loading sql from a file instead
			// provide both options?
			// but will the db really get that big?

			// create room table
			db.querySync([
				"CREATE TABLE room (",
				"	id CHAR("+settings.ID_LEN+"),",
				"	snapshot_id CHAR("+settings.ID_LEN+") REFERENCES snapshot(id),",
				"	last_active DATETIME NOT NULL,",
				"	is_private BOOLEAN NOT NULL,",
				"	PRIMARY KEY (id)",
				// "	FOREIGN KEY (snapshot_id) REFERENCES snapshot(id)",
				")"
			].join("\n"));

			// create snapshot table
			db.querySync([
				"CREATE TABLE snapshot (",
				"	id CHAR("+settings.ID_LEN+"),",
				"	room_id CHAR("+settings.ID_LEN+") NOT NULL REFERENCES room(id),",
				"	taken_on DATETIME NOT NULL,",
				"	PRIMARY KEY (id),",
				"	FOREIGN KEY (room_id) REFERENCES room(id)",
				")"
			].join("\n"));

			db.querySync([
				"ALTER TABLE room",
				"ADD CONSTRAINT FOREIGN KEY (snapshot_id) REFERENCES snapshot(id);"
			].join("\n"));
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
			process.exit(); 
		}
	});
}

migrate();
