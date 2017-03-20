// Settings file for drawy.io node.js backend
// see https://stackoverflow.com/questions/5797852/in-node-js-how-do-i-include-functions-from-my-other-files

// Define global constants
module.exports = {
	PORT: 8080, // Which port to expose to the outside world
	ID_LEN: 16, // The length of the ID string for drawings
	LAYER_CODE_LEN: 32, // Length of layer codes
	MAX_LAYERS: 5, // Max number of layers to store before flattening the image
	FLATTEN_TIMEOUT: 1000, // after n ms since last edit, flatten the image
	MEMORY_TIMEOUT: 1000, // milliseconds before deleting the drawing from memory
	DRAWING_PARAMS: { // Parameters for creating blank drawings
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
	IMAGES_DIR: "/usr/src/app/code/images"
}

