// File: routes/index.js
const express = require('express');
const userRoutes = require('./userRoutes');

/**
 * Initialize all API routes
 * @param {Express} app - Express application
 */
function initRoutes(app) {
  // User routes
  app.use('/api/user', userRoutes);
  
  // Add other route groups here as your application grows
  // app.use('/api/products', productRoutes);
  // app.use('/api/orders', orderRoutes);
  
  // Main API route - shows available endpoints
  app.get('/api', (req, res) => {
    res.json({
      message: 'User Management API',
      version: '1.0.0',
      endpoints: {
        users: '/api/user'
      }
    });
  });
  
  // Main route
  app.get('/', (req, res) => {
    res.json({
      message: 'Welcome to the User Management API',
      api: '/api'
    });
  });
  
  // Not found route handler - must be the last route
  app.use((req, res) => {
    res.status(404).json({ message: 'Route not found' });
  });
}

module.exports = initRoutes;