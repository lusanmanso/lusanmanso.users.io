// File: routes/index.js
const express = require('express');
const userRoutes = require('./userRoutes');
const clientRoutes = require('./clientRoutes');

/**
 * Initialize all API routes
 * @param {Express} app - Express application
 */
function initRoutes(app) {
  // User routes
  app.use('/api/user', userRoutes);
  // Client routes
  app.use('/api/client', clientRoutes);

  // Add other route groups here as application grows

  // Main API route - shows available endpoints
  app.get('/api', (req, res) => {
    res.json({
      message: 'Albaranes API',
      version: '1.0.0',
      endpoints: {
        users: '/api/user',
        clients: '/api/client',
      }
    });
  });

  // Main route
  app.get('/', (req, res) => {
    res.json({
      message: 'Welcome to Albaranes API',
      api: '/api'
    });
  });

  // Not found route handler - must be the last route
  app.use((req, res) => {
    res.status(404).json({ message: 'Route not found' });
  });
}

module.exports = initRoutes;
