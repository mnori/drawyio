// Database API wrapper
// This wrapper means we can get some nice debugging and also run synchronous queries.
// (c) 2017 drawy.io

const mysql = require("mysql"); // https://www.npmjs.com/package/mysql
const sqlstring = require("sqlstring") // sql escaping library
const settings = require("./settings")

class DB {
	constructor(params) {
		this.connection = mysql.createConnection(params)
		this.connection.connect();
		this.deasync = null; // set in migrate.js when setting up the database
	}

	// Do a query asynchronously, then call the supplied callback with the results.
	query(sql, callback) {
		if (settings.SQL_DEBUG) {
			console.log("Async query:\n"+this.addTab(sql))		
		}
		this.connection.query(sql, function(error, results, fields) {
			if (error) {
				console.log("Database error");
				console.log(error);
			}
			if (typeof(callback) != "undefined") {
				return callback(results, fields, error);
			}
		});
	}

	// Do query synchronously. For use in database migrations, don't use on the server.
	// @deprecated
	// querySync(sql) {
	// 	if (settings.SQL_DEBUG) {
	// 		console.log("Sync query:\n"+this.addTab(sql))		
	// 	}
	// 	if (this.deasync == null) { // should not ever happen, because it shouldn't be called within app
	// 		console.log("\tCan't find deasync API!");
	// 	}

	// 	// explanation of how this work can be found here:
	// 	// https://www.npmjs.com/package/deasync
	// 	var done = false
	// 	var output = null;
	// 	this.connection.query(sql, function cb(error, results, fields) {
	// 		done = true;
	// 		output = {
	// 			"error": error,
	// 			"results": results,
	// 			"fields": fields
	// 		};
	// 	});
	// 	var results = this.deasync.loopWhile(function() { return !done; });
	// 	return results;
	// }

	// Like query() but returns a promise so you can do sequential shit
	pquery(sql) {
		return new Promise((resolve, reject) => {
			this.query(sql, function(results, fields, error) {
				if (error) { // fail, return error object
					reject(error);
				} else { // success, return result and field object
					resolve({ "results": results, "fields": fields });
				}
			});
		})
	}

	// For debugging
	addTab(sql) {
		var bits = sql.split("\n");
		var buf = ""
		for (var i = 0; i < bits.length; i++) {
			buf += bits[i] = "    "+bits[i].replace("\t", "    ");
		}
		return bits.join("\n");
	}

	esc(strIn) {
		// !! fill this out
		return sqlstring.escape(strIn);
	}
};

module.exports = {
	DB: DB
};