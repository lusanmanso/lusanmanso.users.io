// File: routes/clientRoutes.js
const express = require('express');
const { param, check } = require('express-validator');
const { validateCreateClient, validateUpdateClient, validateClientId } = require('../validators/clientValidators');
const clientController = require('../controllers/clientController');
const { auth } = require('../middleware/auth');
// const { asyncHandler } = require('../middleware/handleError');

const router = express.Router();
router.use(auth); // Apply auth middleware to all routes

/**
 * @route POST /api/client
 * @desc Create a new client
 * @access Private
 * @body { name: string, email: string, company?: string (ObjectId) }
 */
router.post(
   '/',
   validateCreateClient,
   clientController.createClient
);

/**
 * @route GET /api/client
 * @desc Get all active clients of the user
 * @access Private
 */
router.get(
   '/',
   clientController.getClients

);

/**
 * @route GET /api/client/archived
 * @desc Get all archived clients of the user
 * @access Private
 */
router.get(
   '/archived',
   clientController.getArchivedClients
);

/**
 * @route GET /api/client/:id
 * @desc Get a client by ID
 * @access Private
 * @param id (Client's MongoDB ObjectId)
 */
router.get(
   '/:id',
   validateClientId,
   clientController.getClientById
);

/**
 * @route PUT /api/client/:id
 * @desc Update a client
 * @access Private
 * @param id (Client's MongoDB ObjectId)
 * @body { name?: string, email?: string, company?: string (ObjectId) }
 */
router.put(
   '/:id',
   validateUpdateClient,
   clientController.updateClient
);
// Alternatively support PATCH
router.patch(
   '/:id',
   validateUpdateClient,
   clientController.updateClient
);

/**
 * @route PATCH /api/client/archive/:id
 * @desc Archive a client (soft delete)
 * @access Private
 * @param id (Client's MongoDB ObjectId)
 */
router.patch(
   '/:id/archive',
   validateClientId,
   clientController.archiveClient
);

/**
 * @route PATCH /api/client/recover/:id
 * @desc  Recover an archived client (soft delete)
 * @access Private
 * @param id (Client's MongoDB ObjectId)
 */
router.patch(
   '/:id/recover',
   validateClientId,
   clientController.recoverClient
);


/**
 * @route DELETE /api/client/:id
 * @desc Delete a client (hard delete)
 * @access Private
 * @param id (Client's MongoDB ObjectId)
 */
router.delete(
   '/:id',
   validateClientId,
   clientController.deleteClient
);

module.exports = router;
