// Database migrations for drawy.io

const settings = require("./settings")
var database = require("./database");
var db = new database.DB(settings.DB_CONNECT_PARAMS);

var migrations = [
	{ 
		name: "beginning", 
		run: function() {
			db.query("CREATE DATABASE IF NOT EXISTS drawyio");
			db.query('SHOW DATABASES', function (results, fields) {
				console.log(results);
				console.log('The solution is: '+results[0].solution);
			});
		}
	}
]

function migrate() {
	console.log("Started migration.");
	for (var i = 0; i < migrations.length; i++) {
		migration = migrations[i];
		migration.run();
		console.log("["+(i + 1)+": "+migration.name+"] completed migration");
	}
	console.log("Finished migration.");
}

migrate();
process.exit();