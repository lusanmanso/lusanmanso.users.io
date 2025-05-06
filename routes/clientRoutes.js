// File: routes/clientRoutes.js
const express = require('express');
const { param, check } = require('express-validator');
const { validateCreateClient, validateUpdateClient, validateClientId } = require('../validators/clientValidators');
const clientController = require('../controllers/clientController');
const { auth } = require('../middleware/auth');
const { handleError, asyncHandler } = require('../middleware/handleError');

const router = express.Router();
router.use(auth); // Apply auth middleware to all routes

/**
 * @openapi
 * tags:
 *   - name: Client
 *     description: Client management endpoints
 */

/**
 * @openapi
 * /client:
 *   post:
 *     tags:
 *       - Client
 *     summary: Create a new client
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ClientInput'
 *     responses:
 *       '201':
 *         description: Client created successfully.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ClientOutput'
 *       '400':
 *         $ref: '#/components/responses/ValidationError'
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post(
   '/',
   validateCreateClient,
   asyncHandler(clientController.createClient)
);

/**
 * @openapi
 * /client:
 *   get:
 *     tags:
 *       - Client
 *     summary: List all active clients
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Array of client objects.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/ClientOutput'
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get(
   '/',
   asyncHandler(clientController.getClients)
);

/**
 * @openapi
 * /client/archived:
 *   get:
 *     tags:
 *       - Client
 *     summary: List all archived clients
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Array of archived client objects.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/ClientOutput'
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get(
   '/archived',
   asyncHandler(clientController.getArchivedClients)
);

/**
 * @route GET /api/client/:id
 * @desc Get a client by ID
 * @access Private
 * @param id (Client's MongoDB ObjectId)
 * @openapi
 * /client/{id}:
 *   get:
 *     tags:
 *       - Client
 *     summary: Get client by ID
 *     description: Retrieves a specific client by its ObjectId.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Client ObjectId.
 *     responses:
 *       '200':
 *         description: Client data retrieved successfully.
 *       '400':
 *         $ref: '#/components/responses/ValidationError'
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '404':
 *         $ref: '#/components/responses/NotFoundError'
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get(
   '/:id',
   validateClientId,
   asyncHandler(clientController.getClientById)
);

/**
 * @route PUT /api/client/:id
 * @desc Update a client
 * @access Private
 * @param id (Client's MongoDB ObjectId)
 * @body { name?: string, email?: string, company?: string (ObjectId) }
 * @openapi
 * /client/{id}:
 *   put:
 *     tags:
 *       - Client
 *     summary: Update a client
 *     description: Updates client data by its ObjectId.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Client ObjectId.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *               company:
 *                 type: string
 *     responses:
 *       '200':
 *         description: Client updated successfully.
 *       '400':
 *         $ref: '#/components/responses/ValidationError'
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '404':
 *         $ref: '#/components/responses/NotFoundError'
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 */
router.put(
   '/:id',
   validateUpdateClient,
   asyncHandler(clientController.updateClient)
);
// Alternatively support PATCH
/**
 * @openapi
 * /client/{id}:
 *   patch:
 *     tags:
 *       - Client
 *     summary: Partially update a client
 *     description: Partially updates client fields by its ObjectId.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Client ObjectId.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *               company:
 *                 type: string
 *     responses:
 *       '200':
 *         description: Client partially updated successfully.
 *       '400':
 *         $ref: '#/components/responses/ValidationError'
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '404':
 *         $ref: '#/components/responses/NotFoundError'
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 */
router.patch(
   '/:id',
   validateUpdateClient,
   asyncHandler(clientController.updateClient)
);

/**
 * @route PATCH /api/client/archive/:id
 * @desc Archive a client (soft delete)
 * @access Private
 * @param id (Client's MongoDB ObjectId)
 * @openapi
 * /client/{id}/archive:
 *   patch:
 *     tags:
 *       - Client
 *     summary: Archive a client
 *     description: Soft deletes a client by its ObjectId.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Client ObjectId.
 *     responses:
 *       '200':
 *         description: Client archived successfully.
 *       '400':
 *         $ref: '#/components/responses/ValidationError'
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '404':
 *         $ref: '#/components/responses/NotFoundError'
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 */
router.patch(
   '/:id/archive',
   validateClientId,
   asyncHandler(clientController.archiveClient)
);

/**
 * @route PATCH /api/client/recover/:id
 * @desc  Recover an archived client (soft delete)
 * @access Private
 * @param id (Client's MongoDB ObjectId)
 * @openapi
 * /client/{id}/recover:
 *   patch:
 *     tags:
 *       - Client
 *     summary: Recover an archived client
 *     description: Restores a soft-deleted client by its ObjectId.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Client ObjectId.
 *     responses:
 *       '200':
 *         description: Client recovered successfully.
 *       '400':
 *         $ref: '#/components/responses/ValidationError'
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '404':
 *         $ref: '#/components/responses/NotFoundError'
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 */
router.patch(
   '/:id/recover',
   validateClientId,
   asyncHandler(clientController.recoverClient)
);


/**
 * @route DELETE /api/client/:id
 * @desc Delete a client (hard delete)
 * @access Private
 * @param id (Client's MongoDB ObjectId)
 * @openapi
 * /client/{id}:
 *   delete:
 *     tags:
 *       - Client
 *     summary: Delete a client
 *     description: Permanently deletes a client by its ObjectId.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Client ObjectId.
 *     responses:
 *       '200':
 *         description: Client deleted successfully.
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '404':
 *         $ref: '#/components/responses/NotFoundError'
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 */
router.delete(
   '/:id',
   validateClientId,
   asyncHandler(clientController.deleteClient)
);

module.exports = router;
