// File: config/mongo.js
const mongoose = require('mongoose');

/**
 * Connect to MongoDB database
 * @async
 * @function connectDB
 * @returns {Promise<mongoose.Connection>} Mongoose connection promise
 */
const connectDB = async () => {
  try {
    // Get MongoDB URI from environment variables
    const mongoURI = process.env.MONGODB_URI;

    // Validate MongoDB URI
    if (!mongoURI) {
      console.error('MONGODB_URI is not defined in environment variables');
      console.error('Please create a .env file with MONGODB_URI=mongodb://localhost:27017/user-management');
      process.exit(1);
    }

    console.log('Attempting to connect to MongoDB...');

    // Connect to MongoDB
    const conn = await mongoose.connect(mongoURI);

    console.log(`MongoDB connected: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.error(`Error connecting to MongoDB: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
