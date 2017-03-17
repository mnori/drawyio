const mysql = require('mysql');
// Thin database wrapper

class DB {
	constructor(params) {
		this.connection = mysql.createConnection(params)
		this.connection.connect();
	}

	query(sql, callback) {
		this.connection.query(sql, function(error, results, fields) {
			if (error) {
				console.log(error);
				throw error;
			}
			if (typeof(callback) != "undefined") {
				callback(results, fields);
			}
		});
	}

};

module.exports = {
	DB: DB
};