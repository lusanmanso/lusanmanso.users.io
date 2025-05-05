// File: validators/deliveryNoteValidators.js
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
  validateOptionalBoolean,
} = require('./commonValidators'); // Assuming commonValidators.js exists and is correct
const DeliveryNote = require('../models/DeliveryNote'); // For uniqueness check

/**
 * Validation rules for creating a new delivery note.
 * @constant {Array<import('express-validator').ValidationChain | Function>}
 */
const validateCreateDeliveryNote = [
  validateRequiredString('deliveryNoteNumber').custom(async (deliveryNoteNumber, { req }) => {
    const userId = req.user?.id;
    if (!userId) throw new Error('User ID not found for validation.');
    const existingNote = await DeliveryNote.findOne({ deliveryNoteNumber, createdBy: userId }); // Corrected field name
    if (existingNote) {
      return Promise.reject('Delivery note number already exists for this user.');
    }
  }),
  validateRequiredDate('date'),
  validateMongoIdBody('projectId'), // Ensure projectId is a valid ObjectId in the body

  // Validate 'items' array - must exist and not be empty
  body('items')
    .notEmpty().withMessage('Delivery note must have at least one item.')
    .isArray({ min: 1 }).withMessage('Items must be an array with at least one item.'),

  // Validate each item within the 'items' array
  body('items.*.description', 'Item description')
    .notEmpty().withMessage('cannot be empty.')
    .isString().withMessage('must be a string.')
    .trim(),
  body('items.*.quantity', 'Item quantity')
    .notEmpty().withMessage('cannot be empty.')
    .isNumeric().withMessage('must be a number.')
    .isFloat({ min: 0.01 }).withMessage('must be a positive number.'), // Quantity must be > 0
  body('items.*.unitPrice', 'Item unit price')
    .optional({ checkFalsy: true }) // Price is optional
    .isNumeric().withMessage('must be a number.')
    .isFloat({ min: 0 }).withMessage('cannot be negative.'),
   body('items.*.person', 'Item person')
    .optional({ checkFalsy: true }) // Person is optional
    .isString().withMessage('must be a string.')
    .trim(),
  validateOptionalString('notes'), // Optional notes field

  handleValidationErrors,
];

/**
 * Validation rules for updating an existing delivery note.
 * @constant {Array<import('express-validator').ValidationChain | Function>}
 */
const validateUpdateDeliveryNote = [
  validateMongoId('id'), // Validate the ID in the URL parameter

  validateOptionalString('deliveryNoteNumber').custom(async (deliveryNoteNumber, { req }) => {
    if (deliveryNoteNumber === undefined || deliveryNoteNumber === null) return;
    const userId = req.user?.id;
    const noteId = req.params?.id;
    if (!userId || !noteId) throw new Error('User or Note ID not found for validation.');
    const existingNote = await DeliveryNote.findOne({
      deliveryNoteNumber, // Corrected field name
      createdBy: userId, // Corrected field name
      _id: { $ne: noteId },
    });
    if (existingNote) {
      return Promise.reject('Another delivery note with this number already exists for this user.');
    }
  }),
  validateOptionalDate('date'),
  validateMongoIdBody('projectId', { optional: true }),

  // Allow updating items, but maintain validation structure if provided
   body('items')
    .optional()
    .isArray({ min: 1 }).withMessage('Items, if provided, must be an array with at least one item.'),
   body('items.*.description', 'Item description')
    .if(body('items').exists({ checkFalsy: false })) // Validate only if items array is present
    .notEmpty().withMessage('cannot be empty.')
    .isString().withMessage('must be a string.')
    .trim(),
  body('items.*.quantity', 'Item quantity')
    .if(body('items').exists({ checkFalsy: false }))
    .notEmpty().withMessage('cannot be empty.')
    .isNumeric().withMessage('must be a number.')
    .isFloat({ min: 0.01 }).withMessage('must be a positive number.'),
  body('items.*.unitPrice', 'Item unit price')
    .if(body('items').exists({ checkFalsy: false }))
    .optional({ checkFalsy: true })
    .isNumeric().withMessage('must be a number.')
    .isFloat({ min: 0 }).withMessage('cannot be negative.'),
   body('items.*.person', 'Item person')
    .if(body('items').exists({ checkFalsy: false }))
    .optional({ checkFalsy: true })
    .isString().withMessage('must be a string.')
    .trim(),

  validateOptionalString('notes'),

  handleValidationErrors,
];

/**
 * Validation rules for signing a delivery note.
 * Expects the signature URL (IPFS CID or cloud URL).
 * @constant {Array<import('express-validator').ValidationChain | Function>}
 */
const validateSignDeliveryNote = [
  validateMongoId('id'),
  validateRequiredString('signatureUrl'), // Changed from URL to string to accept CID [cite: 8]
  validateOptionalDate('signedDate'),
  handleValidationErrors,
];

/**
 * Validation rules for operations requiring just a delivery note ID.
 * @constant {Array<import('express-validator').ValidationChain | Function>}
 */
const validateDeliveryNoteId = [
    validateMongoId('id'),
    handleValidationErrors
];

module.exports = {
  validateCreateDeliveryNote,
  validateUpdateDeliveryNote,
  validateSignDeliveryNote,
  validateDeliveryNoteId,
};
