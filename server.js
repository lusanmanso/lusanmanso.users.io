// File: server.js

const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');
const connectDB = require('./config/mongo');
const initRoutes = require('./routes');
const { handleApiErrors } = require('./middleware/handleError');
// const { googleApis } = require('googleapis');
const swaggerUi = require('swagger-ui-express');
const swaggerSpecs = require('./docs/swagger');

// Ensure required directories exist
const ensureDirectories = () => {
  const directories = [
    path.join(__dirname, 'uploads'),
    path.join(__dirname, 'uploads/logos')
  ];

  directories.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`Created directory: ${dir}`);
    }
  });
};

// Load environment variables depending on the environment
if (process.env.NODE_ENV === 'test') {
  dotenv.config({ path: '.env.test' });
} else {
  dotenv.config();
}

// Initialize Express
const app = express();

ensureDirectories();

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Only connect to the database if not in test environment (Jest manages the connection)
if (process.env.NODE_ENV !== 'test') {
  connectDB();
}

// Swagger documentation
app.use("/api-docs",
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpecs)
)

// Serve static files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Connect to database
connectDB();

// Initialize all routes
initRoutes(app)

// Error handle middleware
app.use(handleApiErrors);

// Load server only if not in test environment
if (process.env.NODE_ENV !== 'test') {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

module.exports = app;
