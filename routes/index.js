// File: routes/index.js
const express = require('express');
const userRoutes = require('./userRoutes');
const clientRoutes = require('./clientRoutes');
const projectRoutes = require('./projectRoutes');
const deliveryNoteRoutes = require('./deliveryNoteRoutes');

/**
 * Initialize all API routes
 * @param {Express} app - Express application
 */
function initRoutes(app) {
  // User routes
  app.use('/api/user', userRoutes);
  // Client routes
  app.use('/api/client', clientRoutes);
   // Project routes
   app.use('/api/project', projectRoutes);
   // Delivery Note routes
   app.use('/api/deliverynote', require('./deliveryNoteRoutes'));

  /**
   * @openapi
   * tags:
   *   - name: General
   *     description: General API endpoints (info, welcome)
   */

  /**
   * @openapi
   * /api:
   *   get:
   *     tags:
   *       - General
   *     summary: Main API route - shows available endpoints
   *     description: Provides application info and available endpoints.
   *     responses:
   *       '200':
   *         description: API info retrieved successfully.
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ApiInfo'
   *       '500':
   *         $ref: '#/components/responses/InternalServerError'
   */
  // Main API route - shows available endpoints
  app.get('/api', (req, res) => {
    res.json({
      message: 'Albaranes API',
      version: '1.0.0',
      endpoints: {
        users: '/api/user',
        clients: '/api/client',
        projects: '/api/project',
        deliveryNotes: '/api/deliverynote',
      }
    });
  });

  /**
   * @openapi
   * /:
   *   get:
   *     tags:
   *       - General
   *     summary: Main root route
   *     description: Welcome message and API base path.
   *     responses:
   *       '200':
   *         description: Welcome message.
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/RootInfo'
   *       '500':
   *         $ref: '#/components/responses/InternalServerError'
   */
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
