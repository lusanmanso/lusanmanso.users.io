// File: validators/clientValidators.js
const { body } = require('express-validator');
const {
  validateMongoId,
  handleValidationErrors,
  validateRequiredString,
  validateOptionalString,
  validateMongoIdBody,
} = require('./commonValidators');
const Client = require('../models/Client'); // Needed for uniqueness check

/**
 * Validation rules for creating a new client.
 * @constant {Array<import('express-validator').ValidationChain | Function>}
 */
const validateCreateClient = [
  validateRequiredString('name', 2),
  validateRequiredString('email')
    .isEmail()
    .withMessage('Must be a valid email address.')
    .normalizeEmail()
    .custom(async (email, { req }) => {
      // Check if client email already exists for this user/company
      const userId = req.user?.id;
      if (!userId) {
        // This should ideally not happen if auth middleware runs first
        throw new Error('User information not found.');
      }
      const existingClient = await Client.findOne({ email, userId });
      if (existingClient) {
        return Promise.reject('Client with this email already exists for this user.');
      }
    }),
   body('phone')
      .optional({ checkFalsy: true }) // Allows the field to be null, undefined or empty string
      .matches(/^\d{9}$/)
      .withMessage('Phone number must be exactly 9 digits long and contain only numbers.'),
  validateOptionalString('address'),
  validateOptionalString('cif', 9), // Assuming CIF has a typical length
  handleValidationErrors,
];

/**
 * Validation rules for updating an existing client.
 * Allows partial updates (PATCH/PUT).
 * Requires client ID in the route parameter.
 * @constant {Array<import('express-validator').ValidationChain | Function>}
 */
const validateUpdateClient = [
  validateMongoId('id'), // Validate the ID in the URL parameter
  validateOptionalString('name', 2),
  body('email') // Handle email update carefully
    .optional()
    .isEmail()
    .withMessage('Must be a valid email address.')
    .normalizeEmail()
    .custom(async (email, { req }) => {
      const userId = req.user?.id;
      const clientId = req.params?.id;
      if (!userId || !clientId) {
        throw new Error('User or Client ID not found for validation.');
      }
      // Check if the new email is already used by *another* client of the same user
      const existingClient = await Client.findOne({
        email,
        createdBy: userId,
        _id: { $ne: clientId }, // Exclude the current client being updated
      });
      if (existingClient) {
        return Promise.reject(
          'Another client with this email already exists for this user.'
        );
      }
    }),
   body('phone')
      .optional({ checkFalsy: true }) // Allows the field to be null, undefined or empty string
      .matches(/^\d{9}$/)
      .withMessage('Phone number must be exactly 9 digits long and contain only numbers.'),
  validateOptionalString('address'),
  validateOptionalString('cif', 9),

  handleValidationErrors,
];

/**
 * Validation rules for operations requiring a client ID in the route parameter.
 * @constant {Array<import('express-validator').ValidationChain | Function>}
 */
const validateClientId = [validateMongoId('id'), handleValidationErrors];

module.exports = {
  validateCreateClient,
  validateUpdateClient,
  validateClientId,
};
