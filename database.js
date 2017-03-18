// Database API wrapper

const mysql = require('mysql');

class DB {
	constructor(params) {
		this.connection = mysql.createConnection(params)
		this.connection.connect();
	}

	// Do a query async. Correct way to do a query on the server.
	query(sql, callback) {
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

	// Only for migrations, do not use in serverland!
	querySync(sql, sync) {
		var results = sync.await(this.connection.query(sql, sync.defer()));
		return results;
	}
};

module.exports = {
	DB: DB
};