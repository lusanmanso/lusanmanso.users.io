// File: server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const connectDB = require('./config/mongo');
const initRoutes = require('./routes');
const { handleApiErrors } = require('./middleware/errorHandler');
// const { googleApis } = require('googleapis');
const swaggerUi = require('swagger-ui-express');
const swaggerSpecs = require('./docs/swagger');
const { Server } = require('http');
const swagger = require('./docs/swagger');

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

// Initialize Express
const app = express();

ensureDirectories();

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Swagger documentation
app.use("/api-docs",
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpecs)
)

app.use("/api", require("/routes"))

// Serve static files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Connect to database
connectDB();

// Initialize all routes
initRoutes(app)

// Error handle middleware
app.use(handleApiErrors);

// Port and server start
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;