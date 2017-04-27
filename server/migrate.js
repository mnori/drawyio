// Database migrations for drawy.io

var colors = require('colors');
const settings = require("./settings")
var database = require("./database");
var db = new database.DB(settings.DB_CONNECT_PARAMS);
db.sync = require('synchronize');

var migrations = [
	{ 
		name: "beginning", 
		run: function() {
			var fs = require("fs");

			db.querySync("DROP DATABASE IF EXISTS "+settings.DB_NAME)

			// create the database and use
			db.querySync("CREATE DATABASE "+settings.DB_NAME);
			db.querySync("USE "+settings.DB_NAME);

			// note - this way of entering the sql is a bit cumbersome.
			// could try loading sql from a file instead
			// provide both options?
			// but will the db really get that big?

			// TODO - in the future we should create a session_ip table with a list
			// of all IP addresses associated with the session, this will help with 
			// the bans

			// create session table
			db.querySync([
				"CREATE TABLE session (",
				"	id CHAR("+settings.SESSION_ID_LEN+") NOT NULL,",
				"	name VARCHAR("+settings.USER_NAME_LEN+") NOT NULL,",
				"	ip_address VARCHAR(255) NOT NULL,",
				"	last_active DATETIME NOT NULL,",
				"	PRIMARY KEY (id)",
				")"
			].join("\n"));

			// create table for registered users
			db.querySync([
				"CREATE TABLE user (",
				"	id BIGINT NOT NULL AUTO_INCREMENT,",
				"	name VARCHAR("+settings.USER_NAME_LEN+") NOT NULL UNIQUE,",
				"	session_id VARCHAR("+settings.SESSION_ID_LEN+"),",
				"	password VARCHAR("+settings.PASSWORD_HASH_LEN+") NOT NULL,",
				"	type ENUM('user', 'mod') NOT NULL,",
				"	joined DATETIME NOT NULL,",
				"	PRIMARY KEY (id),",
				"	FOREIGN KEY (session_id) REFERENCES session(id)",
				")"
			].join("\n"));

			// create room table
			db.querySync([
				"CREATE TABLE room (",
				"	id CHAR("+settings.ID_LEN+"),",
				"	snapshot_id CHAR("+settings.ID_LEN+") REFERENCES snapshot(id),",
				"	name VARCHAR("+settings.ROOM_NAME_LEN+") DEFAULT '"+settings.DEFAULT_ROOM_NAME+"',",
				"	is_private BOOLEAN NOT NULL DEFAULT '0',",
				"	is_deleted BOOLEAN NOT NULL DEFAULT '0',",
				"	created DATETIME NOT NULL,",
				"	modified DATETIME NOT NULL,",
				"	PRIMARY KEY (id)",
				")"
			].join("\n"));

			// create snapshot table
			db.querySync([
				"CREATE TABLE snapshot (",
				"	id CHAR("+settings.ID_LEN+"),",
				"	room_id CHAR("+settings.ID_LEN+") NOT NULL REFERENCES room(id),",
				"	name VARCHAR("+settings.SNAPSHOT_NAME_LEN+") DEFAULT '"+settings.DEFAULT_SNAPSHOT_NAME+"',",
				"	is_private BOOLEAN NOT NULL DEFAULT '0',",
				"	is_deleted BOOLEAN NOT NULL DEFAULT '0',",
				"	is_staff_pick BOOLEAN NOT NULL DEFAULT '0',",
				"	created DATETIME NOT NULL,",
				"	PRIMARY KEY (id),",
				"	FOREIGN KEY (room_id) REFERENCES room(id)",
				")"
			].join("\n"));

			db.querySync([
				"ALTER TABLE room",
				"ADD CONSTRAINT FOREIGN KEY (snapshot_id) REFERENCES snapshot(id);"
			].join("\n"));

			// now populate the database using the files on disk
			var dir = settings.ROOMS_DIR;
			var files = fs.readdirSync(dir);
			files.forEach(filename => {
				var modified = fs.statSync(dir+"/"+filename).mtime.getTime() / 1000;
				var id = filename.split(".")[0]
				db.querySync([
					"INSERT INTO room (id, snapshot_id, is_private, created, modified) ",
					"VALUES (",
					"	"+db.esc(id)+",", // id
					"	NULL,", // snapshot_id
					"	0,", // is_private
					"	FROM_UNIXTIME("+modified+"),", // created
					"	FROM_UNIXTIME("+modified+")", // modified
					");"
				].join("\n"));
			});
		}
	}, { 
		name: "v0.2.1",
		run: function() {
			db.querySync("USE "+settings.DB_NAME);
			db.querySync("DROP TABLE IF EXISTS prefs");
			db.querySync([
				"CREATE TABLE prefs (",
				"	id BIGINT NOT NULL AUTO_INCREMENT,",
				"	hide_gallery_warning BOOLEAN NOT NULL DEFAULT '0',",
				"	PRIMARY KEY (id)",
				")"
			].join("\n"));

			db.querySync([
				"ALTER TABLE session",
				"ADD COLUMN prefs_id BIGINT AFTER name,",
				"ADD CONSTRAINT FOREIGN KEY (prefs_id) REFERENCES prefs(id);"
			].join("\n"));

			db.querySync([
				"ALTER TABLE user",
				"ADD COLUMN prefs_id BIGINT AFTER session_id,",
				"ADD CONSTRAINT FOREIGN KEY (prefs_id) REFERENCES prefs(id);"
			].join("\n"));
		}
	}
]

function migrate() {
	// fiber allows synchronous operations - avoids getting in a pickle with callbacks
	db.sync.fiber(function() {
		try {
			console.log("Started migration.");
			var migrating = false;
			for (var i = 0; i < migrations.length; i++) {
				migration = migrations[i];
				if (migration["name"] == settings.MIGRATE_START){
					migrating = true;	
				}
				if (!migrating) {
					console.log("\t"+"skipped".grey+" "+migration.name);
				} else {
					migration.run();
					console.log("\t"+"migrated".green+" "+migration.name);
				}
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
