var isLive = false;

// Settings file for drawy.io node.js backend
// Define global constants
module.exports = {
	IS_LIVE: isLive,
	DEFAULT_NICK: "Anonymous",
	VERSION_TXT: "v0.2.2",
	
	CLIENT_JS: [ // names of the client source files before minification
		"Base.js",
		"GalleryUI.js",
		"RoomUI.js",
		"SnapshotUI.js",
		"Dialog.js"
	],
	IGNORE_CAPTCHA: true,

	CLIENT_LOCATION: (isLive) ? "/js/client.js" : "/jsdev/client.js",
	PORT: (isLive) ? 80 : 8080, // Which port to expose to the outside world
	ID_LEN: 16, // The length of the ID string for drawings
	SESSION_ID_LEN: 64, // Length of session IDs
	SESSION_COOKIE_LIFETIME: 60 * 60 * 24 * 365, // in seconds
	SNAPSHOT_ID_LEN: 16,
	PASSWORD_HASH_LEN: 128,
	PASSWORD_MIN_LEN: 8,
	PASSWORD_MAX_LEN: 80,
	PASSWORD_SALT_ROUNDS: 10,
	LAYER_CODE_LEN: 32, // Length of layer codes
	MAX_LAYERS: 5, // Max number of layers to store before flattening the image
	FLATTEN_TIMEOUT: 1000, // After n ms since last edit, flatten the image
	SAVE_TIMEOUT: 5000, // Rolling timeout for saving images to disk (5 seconds)

	// at intervals, check memory and cleanup if needed (1 minutes)
	CLEANUP_INTERVAL: 60000,

	// after n ms, delete image from memory, providing there is enough stuff
	// for the front page
	// this will disconnect sockets, so we should wait quite a while here (10 minutes).
	DELETE_TIME: 10 * 60 * 1000,

	ROOM_NAME_LEN: 50,
	SNAPSHOT_NAME_LEN: 50,
	USER_NAME_LEN: 20,

	// Parameters for creating blank drawings
	DRAWING_PARAMS: { 
		width: 800,
		height:  600,
		channels: 4,
		rgbaPixel: 0xFFFFFFFF
	},
	DB_CONNECT_PARAMS: {
		host: (isLive) ? "localhost" : "mysql",
		user: "root",
		password: (isLive) ? "CHANGEME" : "password"
	},
	DB_NAME: "drawyio",
	MIGRATE_START: "v0.2.1", 
	SQL_DEBUG: false, // (isLive) ? false : true,
	DEBUG_FILEPATH: "/usr/src/app/code/debug.log",
	ROOMS_DIR: "/usr/src/app/code/images/rooms",
	SNAPSHOTS_DIR: "/usr/src/app/code/images/snapshots",
	JSDEV_PATH: "/usr/src/app/code/client",
	MINIFIED_CLIENT_PATH: "/usr/src/app/code/public/js/client.js",
	MIN_DRAWINGS_MEMORY: 16, // this is also the max number of images in the gallery

	DEFAULT_ROOM_NAME: "An unnamed room",
	DEFAULT_SNAPSHOT_NAME: "An unnamed snapshot",

	RECAPTCHA_SITE_KEY: (isLive)
		? "CHANGEME"
		: "6LetFx0UAAAAANa1w3iqcPSQhie8NcMofdkqSUMg",
	RECAPTCHA_SECRET_KEY: (isLive)
		? "CHANGEME"
		: "6LetFx0UAAAAAD-h_22R8g_b_1Ubqaxem9lqdZNv"

}

