/**
 * @fileoverview Validation rules for delivery note (albaran) related requests.
 * @version 1.1.0
 * @module deliveryNoteValidators
 */

const { body } = require('express-validator');
const {
  validateMongoId,
  handleValidationErrors,
  validateRequiredString,
  validateOptionalString,
  validateMongoIdBody,
  validateRequiredNumber,
  validateOptionalNumber,
  validateRequiredDate,
  validateOptionalDate,
  validateOptionalBoolean, // isSigned is usually optional on update/handled separately
} = require('./commonValidators');
const DeliveryNote = require('../models/DeliveryNote'); // Needed for uniqueness check

/**
 * Validation rules for creating a new delivery note.
 * Corresponds to POST /api/deliverynote
 * @constant {Array<import('express-validator').ValidationChain | Function>}
 */
const validateCreateDeliveryNote = [
  // --- Core Information ---
  validateRequiredString('noteNumber').custom(async (noteNumber, { req }) => {
    // Check uniqueness scoped to the user creating the note
    const userId = req.user?.id;
    if (!userId) {
      // Should be caught by auth middleware, but good practice to check
      throw new Error('User ID not found for validation.');
    }
    const existingNote = await DeliveryNote.findOne({ noteNumber, userId });
    if (existingNote) {
      return Promise.reject(
        'Delivery note number already exists for this user.'
      );
    }
  }),
  validateRequiredDate('date'), // Date of the delivery note
  validateMongoIdBody('projectId'), // Link to the project
  validateMongoIdBody('clientId'), // Link to the client

  // --- Content Details (Allow either hours or items, or both if needed) ---
  validateOptionalNumber('hours', 0), // Hours worked (min 0), optional
  validateOptionalString('workDescription'), // Description if hours are provided, optional

  // Validate 'items' array if present
  body('items')
    .optional()
    .isArray({ min: 0 }) // Allow empty array or non-existence
    .withMessage('Items must be an array.'),
  // Validate each item within the 'items' array
  body('items.*.description', 'Item description') // Custom message prefix
    .if(body('items').exists({ checkFalsy: false })) // Only validate if items array exists
    .notEmpty()
    .withMessage('cannot be empty.')
    .isString()
    .withMessage('must be a string.'),
  body('items.*.quantity', 'Item quantity')
    .if(body('items').exists({ checkFalsy: false }))
    .notEmpty()
    .withMessage('cannot be empty.')
    .isNumeric()
    .withMessage('must be a number.')
    .isFloat({ min: 0 }) // Allow 0 quantity, adjust if min should be 1
    .withMessage('cannot be negative.'),
  body('items.*.unitPrice', 'Item unit price')
    .if(body('items').exists({ checkFalsy: false }))
    .notEmpty()
    .withMessage('cannot be empty.')
    .isNumeric()
    .withMessage('must be a number.')
    .isFloat({ min: 0 })
    .withMessage('cannot be negative.'),

  // --- Fields typically set by system/later actions (not validated on create) ---
  // isSigned (defaults to false)
  // signatureUrl (set on signing)
  // signedDate (set on signing)
  // pdfUrl (set after generation/upload)

  handleValidationErrors, // Process any validation errors
];

/**
 * Validation rules for updating an existing delivery note.
 * Corresponds to PUT or PATCH /api/deliverynote/:id
 * Allows partial updates. Updates to signed notes might be restricted in the controller.
 * @constant {Array<import('express-validator').ValidationChain | Function>}
 */
const validateUpdateDeliveryNote = [
  validateMongoId('id'), // Validate the ID in the URL parameter

  // --- Core Information (Allow optional updates) ---
  validateOptionalString('noteNumber').custom(async (noteNumber, { req }) => {
    // If noteNumber is being updated, check its uniqueness excluding the current note
    if (noteNumber === undefined || noteNumber === null) return; // Skip if not provided
    const userId = req.user?.id;
    const noteId = req.params?.id;
    if (!userId || !noteId) {
      throw new Error('User or Note ID not found for validation.');
    }
    const existingNote = await DeliveryNote.findOne({
      noteNumber,
      userId,
      _id: { $ne: noteId }, // Check other notes of the same user
    });
    if (existingNote) {
      return Promise.reject(
        'Another delivery note with this number already exists for this user.'
      );
    }
  }),
  validateOptionalDate('date'),
  validateMongoIdBody('projectId', { optional: true }),
  validateMongoIdBody('clientId', { optional: true }),

  // --- Content Details (Allow optional updates) ---
  validateOptionalNumber('hours', 0),
  validateOptionalString('workDescription'),

  // Validate 'items' array if present for update
  body('items')
    .optional()
    .isArray({ min: 0 })
    .withMessage('Items must be an array.'),
  // Validate each item within the 'items' array if provided
  body('items.*.description', 'Item description')
    .if(body('items').exists({ checkFalsy: false }))
    .notEmpty()
    .withMessage('cannot be empty.')
    .isString()
    .withMessage('must be a string.'),
  body('items.*.quantity', 'Item quantity')
    .if(body('items').exists({ checkFalsy: false }))
    .notEmpty()
    .withMessage('cannot be empty.')
    .isNumeric()
    .withMessage('must be a number.')
    .isFloat({ min: 0 })
    .withMessage('cannot be negative.'),
  body('items.*.unitPrice', 'Item unit price')
    .if(body('items').exists({ checkFalsy: false }))
    .notEmpty()
    .withMessage('cannot be empty.')
    .isNumeric()
    .withMessage('must be a number.')
    .isFloat({ min: 0 })
    .withMessage('cannot be negative.'),

  // --- Status/Signature fields (Usually handled by specific endpoints/logic) ---
  // It's generally better *not* to allow updating these via the generic update endpoint.
  // validateOptionalBoolean('isSigned'), // Avoid direct update here
  // validateOptionalString('signatureUrl'), // Avoid direct update here
  // validateOptionalDate('signedDate'), // Avoid direct update here
  // validateOptionalString('pdfUrl'), // Avoid direct update here

  // Controller should handle logic like preventing updates if isSigned is true.

  handleValidationErrors,
];

/**
 * Validation rules for signing a delivery note.
 * Corresponds to PATCH /api/deliverynote/sign/:id (example route)
 * Expects the signature URL after it has been uploaded.
 * @constant {Array<import('express-validator').ValidationChain | Function>}
 */
const validateSignDeliveryNote = [
  validateMongoId('id'), // Validate the ID in the URL parameter
  // Assuming the signature image/data was uploaded and its URL is now being provided
  validateRequiredString('signatureUrl') // Validate the URL of the uploaded signature
    .isURL()
    .withMessage('Signature URL must be a valid URL.'),
  // signedDate could be set automatically in the controller or optionally provided
  validateOptionalDate('signedDate'),

  handleValidationErrors,
];

/**
 * Validation rules for operations requiring just a delivery note ID in the route parameter.
 * Used for GET /api/deliverynote/:id, DELETE /api/deliverynote/:id, GET /api/deliverynote/pdf/:id
 * @constant {Array<import('express-validator').ValidationChain | Function>}
 */
const validateDeliveryNoteId = [
    validateMongoId('id'),
    handleValidationErrors
];

module.exports = {
  validateCreateDeliveryNote,
  validateUpdateDeliveryNote,
  validateSignDeliveryNote, // Specific validator for the signing action
  validateDeliveryNoteId, // Generic validator for routes needing only the ID
};
