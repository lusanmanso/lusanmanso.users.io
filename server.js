// File: server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/database');
const initRoutes = require('./routes');

// Initialize Express
const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

// Connect to database
connectDB();

// Initialize all routes
initRoutes(app);

// Port and server start
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});