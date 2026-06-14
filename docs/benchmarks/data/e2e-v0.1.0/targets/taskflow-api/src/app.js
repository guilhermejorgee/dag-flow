const express = require('express');

const app = express();
app.use(express.json());

// Routes will be mounted here by agents

module.exports = app;
