// Database API wrapper
// This wrapper means we can get some nice debugging and also run synchronous queries.
// (c) 2017 drawy.io

const mysql = require('mysql'); // https://www.npmjs.com/package/mysql
const sqlstring = require("sqlstring") // Our db wrapper
const settings = require("./settings")

class DB {
	constructor(params) {
		this.connection = mysql.createConnection(params)
		this.connection.connect();
		this.sync = null;
	}

	// Do a query async. Correct way to do a query on the server.
	query(sql, callback) {
		if (settings.SQL_DEBUG) {
			console.log("Async query:\n"+this.addTab(sql))		
		}
		this.connection.query(sql, function(error, results, fields) {
			if (error) {
				console.log("Database error");
				console.log(error);
				throw error;
			}
			if (typeof(callback) != "undefined") {
				return callback(results, fields);
			}
		});
	}

	// Do query synchronously. For use in database migrations, don't use on the server.
	querySync(sql) {
		if (settings.SQL_DEBUG) {
			console.log("Sync query:\n"+this.addTab(sql))		
		}
		if (this.sync == null) { // should not ever happen
			console.log("\tSync is null!");
		}
		var results = this.sync.await(this.connection.query(sql, this.sync.defer()));
		return results;
	}

	// For debugging
	addTab(sql) {
		var bits = sql.split("\n");
		var buf = ""
		for (var i = 0; i < bits.length; i++) {
			buf += bits[i] = "\t"+bits[i];
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