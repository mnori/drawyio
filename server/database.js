// Database API wrapper
// This wrapper means we can get some nice debugging and also run synchronous queries.
// (c) 2020 drawy.io

const mysql = require("mysql"); // https://www.npmjs.com/package/mysql
const sqlstring = require("sqlstring") // sql escaping library
const settings = require("./settings")
const utils = require("./utils");
const fs = require("fs");

class DB {

	constructor(params) {
		this.connection = mysql.createConnection(params)
		this.connection.connect();
		this.deasync = null; // set in migrate.js when setting up the database
	}

	// Do a query and then call the supplied callback with the results.
	query(sql, callback) {
		if (settings.SQL_DEBUG) {
			console.log("Async query:\n"+this.addTab(sql));
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

	// Like query(), but accepts path to an SQL file instead of an SQL string. 
	// Can include string replacements e.g. from a config file.
	queryf(filepath, replacements, callback) {
		fs.readFile(settings.SQL_BASEPATH+"/"+filepath, "utf8", (error, sql) => {
			if (error) {
				// Failed to read anything from the file
				return callback(null, null, error);

			} else {
				// File read successfully. Apply any replacements specified to the SQL
				if (replacements) {
					for (const search of replacements.getKeys()) {
						const replace = replacements.get(search);
						sql = utils.replaceAll(sql, ":"+search, replace);
					}
				}

				// Run the query
				return this.query(sql, callback);
			}
		})
	}

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
		});
	}

	// Like pquery() but reads from file instead.
	pqueryf(filepath, replacements) {
		return new Promise((resolve, reject) => {
			this.queryf(filepath, replacements, function(results, fields, error) {
				if (error) { // fail, return error object
					reject(error);
				} else { // success, return result and field object
					resolve({ "results": results, "fields": fields });
				}
			});
		});
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

	// For escaping mysql strings
	esc(strIn) {
		return sqlstring.escape(strIn);
	}
};

module.exports = {
	DB: DB
};