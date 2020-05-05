// Database migrations for drawy.io
// (c) 2020 drawy.io

const settings = require("./settings")
var fs = require("fs");
var database = require("./database");
var utils = require("./utils")

var dbParams = settings.DB_CONNECT_PARAMS;
dbParams["multipleStatements"] = true; // set this here because it shouldn't be allowed in app context.
var db = new database.DB(dbParams);

// Names of variables in the settings.js to replace in our SQL files
var settingReplacements = utils.getSettingReplacements([
	"DB_NAME",
	"DEFAULT_ROOM_NAME",
	"DEFAULT_SNAPSHOT_NAME",
	"ID_LEN",
	"PASSWORD_HASH_LEN",
	"ROOM_NAME_LEN",
	"SESSION_ID_LEN",
	"SNAPSHOT_NAME_LEN",
	"USER_NAME_LEN"
], settings);

var migrations = [
	{ 
		name: "beginning", 
		run: function() {
			return db.
				// Initial queries
				pqueryf("migrate_beginning_setup.sql", settingReplacements)
				// Convert images in our folder into rooms
				.then(_ => {
					var dir = settings.ROOMS_DIR;
					var filenames = fs.readdirSync(settings.ROOMS_DIR);
					return filenames.reduce((chain, filename) => {
				        return chain.then(_ => {
				        	if (filename[0] === ".") {
				        		return; // ignore hidden files
				        	}
				        	var modified = fs.statSync(dir+"/"+filename).mtime.getTime() / 1000;
							var id = filename.split(".")[0]
				        	return db.pquery([
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
				    }, Promise.resolve())	
				})
		}
	}, { 
		name: "v0.2.1",
		run: function() {
			return db.pqueryf("migrate_v0.2.1_all.sql", settingReplacements);
		}
	}
]

// Migration method executes promise chains in the correct order. Got the idea from here:
// https://medium.com/better-programming/dynamic-promise-chaining-af9c5cb87f2e
function migrate() {
	console.log("Started migration.");
	return migrations.reduce((chain, migration) => {
        return chain.then(_ => {
        	console.log("Processing "+migration.name+"...");
        	return migration.run()
        });
    }, Promise.resolve())
    .then(_ => {
    	console.log("Finished migration.");
		process.exit(); 
    })
    .catch(error => {
    	console.log("Migration failed");
    	console.log(error);
    	process.exit();
    });
}

migrate();
