// File: tests/teardown.js
module.exports = async () => {
  // Close the MongoDB connection everytime tests are done
  if (global.__MONGO_DB_CONNECTION__) {
    console.log('Closing MongoDB test connection...');
    await global.__MONGO_DB_CONNECTION__.close();
    console.log('MongoDB test connection closed.');
  }
};
