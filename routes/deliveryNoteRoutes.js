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
 * @route POST /api/deliverynote
 * @desc Create a new delivery note (hours or materials) for a specific project[cite: 6].
 * @access Private
 * @body { deliveryNoteNumber: string, projectId: string, date: Date, items: Array<{description: string, quantity: number, unitPrice?: number, person?: string}>, notes?: string }
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
router.put(
    '/:id',
    validateUpdateDeliveryNote, // Includes ID validation and body validation
    asyncHandler(deliveryNoteController.updateDeliveryNote)
);

// PATCH might be more semantically correct for partial updates
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
router.patch(
    '/sign/:id',
    validateSignDeliveryNote, // Specific validation for signing action
    asyncHandler(deliveryNoteController.signDeliveryNote)
);

/**
 * @route ET /api/deliverynote/pdf/:id
 * @desc Download the PDF of a specific (usually signed) delivery note[cite: 6, 8].
 * Checks if the PDF exists (preferentially from cloud/IPFS)[cite: 8].
 * Accessible by the note creator or guests of their company[cite: 7].
 * @access Private (permission check in controller)
 * @param id - The MongoDB ObjectId of the delivery note.
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
router.delete(
    '/:id',
    validateDeliveryNoteId,
    asyncHandler(deliveryNoteController.deleteDeliveryNote)
);

module.exports = router;
