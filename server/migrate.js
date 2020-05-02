// Database migrations for drawy.io
// (c) 2020 drawy.io

var colors = require('colors');
const settings = require("./settings")
var fs = require("fs");
var database = require("./database");
var utils = require("./utils")

var dbParams = settings.DB_CONNECT_PARAMS;
dbParams["multipleStatements"] = true; // set this here because it shouldn't be allowed in app context.
var db = new database.DB(dbParams);

// All keys/value to replace in the migration SQL files
// TODO make this a bit less repetitive somehow? Could just have an array of key names
var configReplacements = new utils.AssocArray({
	"settings.DB_NAME" : settings.DB_NAME,
	"settings.DEFAULT_ROOM_NAME" : settings.DEFAULT_ROOM_NAME,
	"settings.DEFAULT_SNAPSHOT_NAME" : settings.DEFAULT_SNAPSHOT_NAME,
	"settings.ID_LEN" : settings.ID_LEN,
	"settings.PASSWORD_HASH_LEN" : settings.PASSWORD_HASH_LEN,
	"settings.ROOM_NAME_LEN" : settings.ROOM_NAME_LEN,
	"settings.SESSION_ID_LEN" : settings.SESSION_ID_LEN,
	"settings.SNAPSHOT_NAME_LEN" : settings.SNAPSHOT_NAME_LEN,
	"settings.USER_NAME_LEN" : settings.USER_NAME_LEN
});

var migrations = [

	// // Dummy test migrations - return some promise chains which can then be attached into a longer one
	// {
	// 	name: "m1",
	// 	run: function() {
	// 		return db
	// 			.pquery("select sleep(1)")
	// 			.then(_ => console.log("Finished sleeping 1"))
	// 			.then(_ => db.pquery("select * from mysql.help_category"))
	// 			.then(_ => console.log("Finished selection 1"))
	// 	}
	// },
	// {
	// 	name: "m2",
	// 	run: function() {
	// 		return db
	// 			.pquery("select sleep(1)")
	// 			.then(_ => console.log("Finished sleeping 2"))
	// 			.then(_ => db.pquery("select * from mysql.help_category"))
	// 			.then(_ => console.log("Finished selection 2"))
	// 	}
	// }

	{ 
		name: "beginning", 
		run: function() {
			return db.
				// pqueryf("dummy.sql", new utils.AssocArray({"REPLACE_ME": "UR MOM"}))
				pqueryf("migrate_beginning_setup.sql", configReplacements)
				.then(_ => console.log("FUCK YEAH"))

			// db.querySync("DROP DATABASE IF EXISTS "+settings.DB_NAME)

			// // create the database and use
			// db.querySync("CREATE DATABASE "+settings.DB_NAME);
			// db.querySync("USE "+settings.DB_NAME);

			// // note - this way of entering the sql is a bit cumbersome.
			// // could try loading sql from a file instead
			// // provide both options?
			// // but will the db really get that big?

			// // TODO - in the future we should create a session_ip table with a list
			// // of all IP addresses associated with the session, this will help with 
			// // the bans

			// // create session table
			// db.querySync([
			// 	"CREATE TABLE session (",
			// 	"	id CHAR("+settings.SESSION_ID_LEN+") NOT NULL,",
			// 	"	name VARCHAR("+settings.USER_NAME_LEN+") NOT NULL,",
			// 	"	ip_address VARCHAR(255) NOT NULL,",
			// 	"	last_active DATETIME NOT NULL,",
			// 	"	PRIMARY KEY (id)",
			// 	")"
			// ].join("\n"));

			// // create table for registered users
			// db.querySync([
			// 	"CREATE TABLE user (",
			// 	"	id BIGINT NOT NULL AUTO_INCREMENT,",
			// 	"	name VARCHAR("+settings.USER_NAME_LEN+") NOT NULL UNIQUE,",
			// 	"	session_id VARCHAR("+settings.SESSION_ID_LEN+"),",
			// 	"	password VARCHAR("+settings.PASSWORD_HASH_LEN+") NOT NULL,",
			// 	"	type ENUM('user', 'mod') NOT NULL,",
			// 	"	joined DATETIME NOT NULL,",
			// 	"	PRIMARY KEY (id),",
			// 	"	FOREIGN KEY (session_id) REFERENCES session(id)",
			// 	")"
			// ].join("\n"));

			// // create room table
			// db.querySync([
			// 	"CREATE TABLE room (",
			// 	"	id CHAR("+settings.ID_LEN+"),",
			// 	"	snapshot_id CHAR("+settings.ID_LEN+") REFERENCES snapshot(id),",
			// 	"	name VARCHAR("+settings.ROOM_NAME_LEN+") DEFAULT '"+settings.DEFAULT_ROOM_NAME+"',",
			// 	"	is_private BOOLEAN NOT NULL DEFAULT '0',",
			// 	"	is_deleted BOOLEAN NOT NULL DEFAULT '0',",
			// 	"	created DATETIME NOT NULL,",
			// 	"	modified DATETIME NOT NULL,",
			// 	"	PRIMARY KEY (id)",
			// 	")"
			// ].join("\n"));

			// // create snapshot table
			// db.querySync([
			// 	"CREATE TABLE snapshot (",
			// 	"	id CHAR("+settings.ID_LEN+"),",
			// 	"	room_id CHAR("+settings.ID_LEN+") NOT NULL REFERENCES room(id),",
			// 	"	name VARCHAR("+settings.SNAPSHOT_NAME_LEN+") DEFAULT '"+settings.DEFAULT_SNAPSHOT_NAME+"',",
			// 	"	is_private BOOLEAN NOT NULL DEFAULT '0',",
			// 	"	is_deleted BOOLEAN NOT NULL DEFAULT '0',",
			// 	"	is_staff_pick BOOLEAN NOT NULL DEFAULT '0',",
			// 	"	created DATETIME NOT NULL,",
			// 	"	PRIMARY KEY (id),",
			// 	"	FOREIGN KEY (room_id) REFERENCES room(id)",
			// 	")"
			// ].join("\n"));

			// db.querySync([
			// 	"ALTER TABLE room",
			// 	"ADD CONSTRAINT FOREIGN KEY (snapshot_id) REFERENCES snapshot(id);"
			// ].join("\n"));

			// // now populate the database using the files on disk
			// var dir = settings.ROOMS_DIR;
			// var files = fs.readdirSync(dir);
			// files.forEach(filename => {
			// 	var modified = fs.statSync(dir+"/"+filename).mtime.getTime() / 1000;
			// 	var id = filename.split(".")[0]
			// 	db.querySync([
			// 		"INSERT INTO room (id, snapshot_id, is_private, created, modified) ",
			// 		"VALUES (",
			// 		"	"+db.esc(id)+",", // id
			// 		"	NULL,", // snapshot_id
			// 		"	0,", // is_private
			// 		"	FROM_UNIXTIME("+modified+"),", // created
			// 		"	FROM_UNIXTIME("+modified+")", // modified
			// 		");"
			// 	].join("\n"));
			// });
		}
	}, { 
		name: "v0.2.1",
		run: function() {

			return db
				.pquery("select sleep(2)")

			// db.querySync("USE "+settings.DB_NAME);
			// db.querySync("DROP TABLE IF EXISTS prefs");
			// db.querySync([
			// 	"CREATE TABLE prefs (",
			// 	"	id BIGINT NOT NULL AUTO_INCREMENT,",
			// 	"	hide_gallery_warning BOOLEAN NOT NULL DEFAULT '0',",
			// 	"	PRIMARY KEY (id)",
			// 	")"
			// ].join("\n"));

			// db.querySync([
			// 	"ALTER TABLE session",
			// 	"ADD COLUMN user_id BIGINT AFTER name,",
			// 	"ADD COLUMN prefs_id BIGINT AFTER user_id,",
			// 	"ADD CONSTRAINT FOREIGN KEY (user_id) REFERENCES user(id),",
			// 	"ADD CONSTRAINT FOREIGN KEY (prefs_id) REFERENCES prefs(id)"
			// ].join("\n"));

			// db.querySync([
			// 	"ALTER TABLE user",
			// 	"DROP FOREIGN KEY user_ibfk_1,",
			// 	"DROP COLUMN session_id,",
			// 	"ADD COLUMN prefs_id BIGINT AFTER name,",
			// 	"ADD CONSTRAINT FOREIGN KEY (prefs_id) REFERENCES prefs(id);"
			// ].join("\n"));
		}
	}
]


// Migration method executes promise chains in the correct order. Got the idea from here:
// https://medium.com/better-programming/dynamic-promise-chaining-af9c5cb87f2e
function migrate() {
	console.log("Started migration.");
	return migrations.reduce((chain, migration) => {
        return chain.then(_ => {
        	console.log("*** Processing "+migration.name+" ***");
        	return migration.run()
        });
    }, Promise.resolve())
    .then(_ => {
    	console.log("Finished migration.");
		process.exit(); 
    })
    .catch(_ => {
    	console.log("Migration failed");
    	console.log(_);
    	process.exit();
    });
}

migrate();
