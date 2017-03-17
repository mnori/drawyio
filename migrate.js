// Database migrations for drawy.io

var migrations = [
	{ 
		name: "beginning", 
		run: function() {
			console.log("run!");
		}
	}
]
function migrate() {
	for (var i = 0; i < migrations.length; i++) {
		migration = migrations[i];
		console.log("["+migration.name+"] completed migration");
	}
}

migrate();