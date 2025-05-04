// File: validators/clientValidators.js
const { body } = require('express-validator');

/**
 * Validate client data for creation and update
 * @module clientValidators
 * @requires express-validator
 */
const createClientValidators = [
  body('name')
    .notEmpty().withMessage('Name is required')
    .isLength({ min: 2, max: 100 }).withMessage('Name must be between 2 and 100 characters')
    .trim(),
  body('email')
    .isEmail().withMessage('Please enter a valid email')
    .normalizeEmail(),
  body('company')
    .optional()
    .isMongoId().withMessage('Invalid company ID'),
];

/**
 * Validate client data for update
 * @module clientValidators
 * @requires express-validator
 */
const updateClientValidators = [
  body('name')
    .optional()
    .isLength({ min: 2, max: 100 }).withMessage('Name must be between 2 and 100 characters')
    .trim(),
  body('email')
    .optional()
    .isEmail().withMessage('Please enter a valid email')
    .normalizeEmail(),
  body('company')
    .optional()
    .isMongoId().withMessage('Invalid company ID'),
];

module.exports = {
  createClientValidators,
  updateClientValidators
};
