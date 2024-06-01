const express = require("express");
const cors = require("cors");
const app = express();
require("dotenv").config();
const port = process.env.PORT || 5000;

// middleware
app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("pet adoption site server is running.......");
});

app.listen(port, (req, res) => {
  console.log(`server is running on port: ${port}`);
});
