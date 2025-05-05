// File: routes/clientRoutes.js
const express = require('express');
const { param, check } = require('express-validator');
const { createClientValidators, updateClientValidators } = require('../validators/clientValidators');
const clientController = require('../controllers/clientController');
const { auth } = require('../middleware/auth');
// const { asyncHandler } = require('../middleware/handleError'); FIXME: destructuring declaration needs initializer

const router = express.Router();
router.use(auth); // Apply auth middleware to all routes

// Validation for client ID in route params
const validateMongoId = param('id').isMongoId().withMessage('Invalid client ID');

/**
 * @route   POST /api/client
 * @desc    Crear un nuevo cliente
 * @access  Private
 * @body    { name: string, email: string, company?: string (ObjectId) }
 */
router.post(
  '/',
  createClientValidators,
  clientController.createClient
);

/**
 * @route   GET /api/client
 * @desc    Obtener la lista de clientes activos del usuario
 * @access  Private
 */
router.get(
  '/',
  clientController.getAllClients
);

/**
 * @route   GET /api/client/archived
 * @desc    Obtener la lista de clientes archivados del usuario
 * @access  Private
 */
router.get(
  '/archived',
  clientController.getArchivedClients
);

/**
 * @route   GET /api/client/:id
 * @desc    Obtener un cliente específico por su ID
 * @access  Private
 * @param   id (Client's MongoDB ObjectId)
 */
router.get(
  '/:id',
  validateMongoId,
  clientController.getClientById
);

/**
 * @route   PUT /api/client/:id
 * @desc    Actualizar un cliente existente
 * @access  Private
 * @param   id (Client's MongoDB ObjectId)
 * @body    { name?: string, email?: string, company?: string (ObjectId) }
 */
router.put(
  '/:id',
  validateMongoId,
  updateClientValidators,
  clientController.updateClient
);
// Alternatively support PATCH
router.patch(
  '/:id',
   validateMongoId,
  updateClientValidators,
  clientController.updateClient
);

/**
 * @route   PATCH /api/client/archive/:id
 * @desc    Archivar un cliente (Soft Delete)
 * @access  Private
 * @param   id (Client's MongoDB ObjectId)
 */
router.patch(
  '/:id/archive',
  validateMongoId,
  clientController.archiveClient
);

/**
 * @route   PATCH /api/client/recover/:id
 * @desc    Recuperar un cliente archivado
 * @access  Private
 * @param   id (Client's MongoDB ObjectId)
 */
router.patch(
  '/:id/recover',
  validateMongoId,
  clientController.recoverClient
);


/**
 * @route   DELETE /api/client/:id
 * @desc    Eliminar un cliente permanentemente (Hard Delete)
 * @access  Private
 * @param   id (Client's MongoDB ObjectId)
 */
router.delete(
  '/:id',
  validateMongoId,
  clientController.deleteClient
);

module.exports = router;
