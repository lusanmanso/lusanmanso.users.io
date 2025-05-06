// File: routes/deliveryNoteRoutes.js
const express = require('express');
const { auth } = require('../middleware/auth');
const deliveryNoteController = require('../controllers/deliveryNoteController');
const {
    validateCreateDeliveryNote,
    validateUpdateDeliveryNote,
    validateSignDeliveryNote,
    validateDeliveryNoteId
} = require('../validators/deliveryNoteValidators'); // Assuming validators are created
const { asyncHandler } = require('../middleware/handleError');

const router = express.Router();

// Apply auth middleware to all delivery note routes
router.use(auth);

/**
 * @openapi
 * tags:
 *   - name: DeliveryNote
 *     description: Delivery note management endpoints
 */

/**
 * @route POST /api/deliverynote
 * @desc Create a new delivery note (hours or materials) for a specific project[cite: 6].
 * @access Private
 * @body { deliveryNoteNumber: string, projectId: string, date: Date, items: Array<{description: string, quantity: number, unitPrice?: number, person?: string}>, notes?: string }
 */
/**
 * @openapi
 * /deliverynote:
 *   post:
 *     tags:
 *       - DeliveryNote
 *     summary: Create a new delivery note
 *     description: Creates a new delivery note (hours or materials) for a specific project.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - deliveryNoteNumber
 *               - projectId
 *               - date
 *               - items
 *             properties:
 *               deliveryNoteNumber:
 *                 type: string
 *               projectId:
 *                 type: string
 *               date:
 *                 type: string
 *                 format: date-time
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     description:
 *                       type: string
 *                     quantity:
 *                       type: number
 *                     unitPrice:
 *                       type: number
 *                     person:
 *                       type: string
 *               notes:
 *                 type: string
 *     responses:
 *       '201':
 *         description: Delivery note created successfully.
 *       '400':
 *         $ref: '#/components/responses/ValidationError'
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post(
    '/',
    validateCreateDeliveryNote,
    asyncHandler(deliveryNoteController.createDeliveryNote)
);

/**
 * @route GET /api/deliverynote
 * @desc List all delivery notes for the logged-in user[cite: 6].
 * @access Private
 * @query (Optional filters like projectId, clientId, date range can be added later)
 */
/**
 * @openapi
 * /deliverynote:
 *   get:
 *     tags:
 *       - DeliveryNote
 *     summary: List all delivery notes
 *     description: Retrieves all delivery notes for the authenticated user, with optional query filters.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: projectId
 *         schema:
 *           type: string
 *         description: Filter by project ID.
 *       - in: query
 *         name: clientId
 *         schema:
 *           type: string
 *         description: Filter by client ID.
 *       - in: query
 *         name: dateFrom
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date filter.
 *       - in: query
 *         name: dateTo
 *         schema:
 *           type: string
 *           format: date
 *         description: End date filter.
 *     responses:
 *       '200':
 *         description: List of delivery notes.
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get(
    '/',
    asyncHandler(deliveryNoteController.getAllDeliveryNotes)
);

/**
 * @route GET /api/deliverynote/:id
 * @desc Get a specific delivery note by its ID, populating related data[cite: 6].
 * @access Private
 * @param id - The MongoDB ObjectId of the delivery note.
 */
/**
 * @openapi
 * /deliverynote/{id}:
 *   get:
 *     tags:
 *       - DeliveryNote
 *     summary: Get delivery note by ID
 *     description: Retrieves a specific delivery note by its ID.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Delivery note ObjectId.
 *     responses:
 *       '200':
 *         description: Delivery note data retrieved successfully.
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
    validateDeliveryNoteId, // Validate the ID format
    asyncHandler(deliveryNoteController.getDeliveryNoteById)
);

/**
 * @route PUT /api/deliverynote/:id
 * @desc Update a delivery note. Should ideally prevent updates if signed (controller logic).
 * @access  Private
 * @param id - The MongoDB ObjectId of the delivery note.
 * @body (Fields to update, similar to create but all optional)
 */
/**
 * @openapi
 * /deliverynote/{id}:
 *   put:
 *     tags:
 *       - DeliveryNote
 *     summary: Update a delivery note
 *     description: Updates a delivery note; should prevent updates if already signed.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Delivery note ObjectId.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               deliveryNoteNumber:
 *                 type: string
 *               projectId:
 *                 type: string
 *               date:
 *                 type: string
 *                 format: date-time
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *               notes:
 *                 type: string
 *     responses:
 *       '200':
 *         description: Delivery note updated successfully.
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
    validateUpdateDeliveryNote, // Includes ID validation and body validation
    asyncHandler(deliveryNoteController.updateDeliveryNote)
);

// PATCH might be more semantically correct for partial updates
/**
 * @openapi
 * /deliverynote/{id}:
 *   patch:
 *     tags:
 *       - DeliveryNote
 *     summary: Partially update a delivery note
 *     description: Partially updates fields of a delivery note.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Delivery note ObjectId.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               items:
 *                 type: array
 *               notes:
 *                 type: string
 *     responses:
 *       '200':
 *         description: Delivery note partially updated successfully.
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
    validateUpdateDeliveryNote, // Same validation applies
    asyncHandler(deliveryNoteController.updateDeliveryNote)
);


/**
 * @route PATCH /api/deliverynote/sign/:id
 * @desc Sign a delivery note by providing the signature image URL (e.g., IPFS CID)[cite: 8].
 * This endpoint handles marking as signed, generating PDF, and storing URLs.
 * @access Private
 * @param id - The MongoDB ObjectId of the delivery note.
 * @body { signatureUrl: string (IPFS CID or cloud URL), signedDate?: Date }
 */
/**
 * @openapi
 * /deliverynote/sign/{id}:
 *   patch:
 *     tags:
 *       - DeliveryNote
 *     summary: Sign a delivery note
 *     description: Signs a delivery note with a signature URL, generates PDF, and stores references.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Delivery note ObjectId to sign.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - signatureUrl
 *             properties:
 *               signatureUrl:
 *                 type: string
 *               signedDate:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       '200':
 *         description: Delivery note signed successfully.
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
    '/sign/:id',
    validateSignDeliveryNote, // Specific validation for signing action
    asyncHandler(deliveryNoteController.signDeliveryNote)
);

/**
 * @route GET /api/deliverynote/pdf/:id
 * @desc Download the PDF of a specific (usually signed) delivery note[cite: 6, 8].
 * Checks if the PDF exists (preferentially from cloud/IPFS)[cite: 8].
 * Accessible by the note creator or guests of their company[cite: 7].
 * @access Private (permission check in controller)
 * @param id - The MongoDB ObjectId of the delivery note.
 */
/**
 * @openapi
 * /deliverynote/pdf/{id}:
 *   get:
 *     tags:
 *       - DeliveryNote
 *     summary: Download delivery note PDF
 *     description: Downloads the PDF of a specific delivery note, if available.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Delivery note ObjectId.
 *     responses:
 *       '200':
 *         description: PDF file stream.
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '404':
 *         $ref: '#/components/responses/NotFoundError'
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get(
    '/pdf/:id',
    validateDeliveryNoteId,
    asyncHandler(deliveryNoteController.downloadDeliveryNotePdf)
);


/**
 * @route DELETE /api/deliverynote/:id
 * @desc Delete a delivery note (only if it is not signed)[cite: 8].
 * @access Private
 * @param id - The MongoDB ObjectId of the delivery note.
 */
/**
 * @openapi
 * /deliverynote/{id}:
 *   delete:
 *     tags:
 *       - DeliveryNote
 *     summary: Delete a delivery note
 *     description: Deletes a delivery note if it is not signed.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Delivery note ObjectId.
 *     responses:
 *       '200':
 *         description: Delivery note deleted successfully.
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '404':
 *         $ref: '#/components/responses/NotFoundError'
 *       '500':
 *         $ref: '#/components/responses/InternalServerError'
 */
router.delete(
    '/:id',
    validateDeliveryNoteId,
    asyncHandler(deliveryNoteController.deleteDeliveryNote)
);

module.exports = router;
