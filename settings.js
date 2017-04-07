var isLive = false;

// Settings file for drawy.io node.js backend
// Define global constants
module.exports = {
	IS_LIVE: isLive,
	VERSION_TXT: "v0.2.0",
	CLIENT_FILE: (isLive) ? "client.js" : "client_welszhdxrvejjoyc.js",
	PORT: (isLive) ? 80 : 8080, // Which port to expose to the outside world
	ID_LEN: 16, // The length of the ID string for drawings
	SNAPSHOT_ID_LEN: 16,
	LAYER_CODE_LEN: 32, // Length of layer codes
	MAX_LAYERS: 5, // Max number of layers to store before flattening the image

	// After n ms since last edit, flatten the image
	// Too high will lead to layering problems
	// To low and there will be a nasty issue during processCanvas
	// ^ can't remember when I wrote that, but if it's true, there's a bug to fix,
	// since the system should be able to handle any timeout. Might mean there is some
	// unpleasant non-atomic stuff going down in the backend
	FLATTEN_TIMEOUT: 1000,

	// Rolling timeout for saving images to disk (5 seconds)
	SAVE_TIMEOUT: 5000, 

	// at intervals, check memory and cleanup if needed (1 minutes)
	CLEANUP_INTERVAL: 60000,
	// CLEANUP_INTERVAL: 1000,

	// after n ms, delete image from memory, providing there is enough stuff
	// for the front page (10 minutes)
	DELETE_TIME: 600000,

	TITLE_LEN: 50,

	// Parameters for creating blank drawings
	DRAWING_PARAMS: { 
		width: 800,
		height:  600,
		channels: 4,
		rgbaPixel: 0xFFFFFFFF
	},
	DB_CONNECT_PARAMS: {
		host: "localhost",
		user: "root",
		password: ""
	},
	DB_NAME: "drawyio",
	SQL_DEBUG: (isLive) ? false : true,
	ROOMS_DIR: "/usr/src/app/code/images/rooms",
	SNAPSHOTS_DIR: "/usr/src/app/code/images/snapshots",
	MIN_DRAWINGS_MEMORY: 16 // this is also the max number of images in the gallery
}

