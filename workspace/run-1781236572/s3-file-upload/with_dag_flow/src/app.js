const express = require('express');

const app = express();
app.use(express.json());

const uploadRoutes = require('./routes/uploadRoutes');
app.use('/api/upload', uploadRoutes);

// Routes will be mounted here by agents

module.exports = app;
