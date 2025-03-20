// File: server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const connectDB = require('./config/database');
const initRoutes = require('./routes');
const { googleApis } = require('googleapis');

// Initialize Express
const app = express();

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Connect to database
connectDB();

// Initialize all routes
initRoutes(app)

// Handle server errors
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({message: 'Something went wrong!', error: err.message});
});

// Port and server start
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;