var isLive = false;

// Settings file for drawy.io node.js backend
// Define global constants
module.exports = {
	IS_LIVE: isLive,
	VERSION_TXT: "v0.1.1",
	PORT: (isLive) ? 80 : 8080, // Which port to expose to the outside world
	ID_LEN: 16, // The length of the ID string for drawings
	LAYER_CODE_LEN: 32, // Length of layer codes
	MAX_LAYERS: 5, // Max number of layers to store before flattening the image

	// After n ms since last edit, flatten the image
	// Too high will lead to layering problems
	// To low and there will be a nasty issue during processCanvas
	FLATTEN_TIMEOUT: 1000,

	// milliseconds before deleting the drawing from memory
	// This affects the disconnection when user is idle, if the drawing is less popular
	MEMORY_TIMEOUT: 60000, 

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
	SQL_DEBUG: true,
	IMAGES_DIR: "/usr/src/app/code/images",
	MIN_DRAWINGS_MEMORY: 16 // this is also the max number of images in the gallery
}

