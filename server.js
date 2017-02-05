"use strict";

const express = require("express");

// Constants
const PORT = 8080;

// App
const app = express();

// Tell node to serve files from the "public" subdirectory
app.use(express.static("public"))

// Non-static example
app.get("/test", function (req, res) {
  res.send("This is not static.\n");
});

app.listen(PORT);
console.log("Running on http://localhost:" + PORT);
