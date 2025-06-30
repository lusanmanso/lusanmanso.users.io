// File: tests/setup.js
const mongoose = require('mongoose');
const dotenv = require('dotenv');

// Cargar las variables de entorno para el entorno de test
// Asegúrate de que tu archivo .env.test exista y contenga MONGODB_URI_TEST
dotenv.config({ path: '.env.test' });

module.exports = async () => {
  // Conectar a la base de datos de test
  const mongoURI_test = process.env.MONGODB_URI_TEST;
  if (!mongoURI_test) {
    throw new Error('MONGODB_URI_TEST not defined in .env.test');
  }

  console.log(`Attempting to connect to MongoDB test database: ${mongoURI_test}`);
  await mongoose.connect(mongoURI_test);

  // Guardar la conexión para que globalTeardown pueda cerrarla
  global.__MONGO_DB_CONNECTION__ = mongoose.connection;
  console.log('MongoDB test connection established.');
};
