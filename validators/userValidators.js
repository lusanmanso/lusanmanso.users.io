// File: validators/userValidators.js
const { body } = require('express-validator');
const {
  validateMongoId,
  handleValidationErrors,
  validateRequiredString,
  validateOptionalString,
} = require('./commonValidators');
const User = require('../models/User'); // Needed for email existence check

/**
 * Validation rules for user registration.
 * @constant {Array<import('express-validator').ValidationChain | Function>}
 */
const validateUserRegistration = [
  validateRequiredString('name', 2),
  validateRequiredString('surname', 2),
  body('email')
    .notEmpty()
    .withMessage('Email cannot be empty.')
    .isEmail()
    .withMessage('Must be a valid email address.')
    .normalizeEmail()
    .custom(async (email) => {
      // Check if email already exists
      const user = await User.findOne({ email });
      if (user) {
        return Promise.reject('Email already in use.');
      }
    }),
  body('password')
    .notEmpty()
    .withMessage('Password cannot be empty.')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long.')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d\S]{8,}$/)
    .withMessage(
      'Password must contain at least one uppercase letter, one lowercase letter, and one number.'
    ),
  handleValidationErrors,
];

/**
 * Validation rules for user login.
 * @constant {Array<import('express-validator').ValidationChain | Function>}
 */
const validateUserLogin = [
  body('email')
    .notEmpty()
    .withMessage('Email cannot be empty.')
    .isEmail()
    .withMessage('Must be a valid email address.')
    .normalizeEmail(),
  body('password').notEmpty().withMessage('Password cannot be empty.'),
  handleValidationErrors,
];

/**
 * Validation rules for validating user email with a code.
 * @constant {Array<import('express-validator').ValidationChain | Function>}
 */
const validateEmailVerification = [
  body('validationCode')
    .notEmpty()
    .withMessage('Validation code cannot be empty.')
    .isString()
    .withMessage('Validation code must be a string.')
    .isLength({ min: 6, max: 6 }) // Assuming a 6-digit code
    .withMessage('Validation code must be 6 characters long.'),
  handleValidationErrors,
];

/**
 * Validation rules for updating user personal data.
 * Allows partial updates (PATCH).
 * @constant {Array<import('express-validator').ValidationChain | Function>}
 */
const validateUpdateUser = [
  validateOptionalString('name', 2),
  validateOptionalString('surname', 2),
  // Email update is usually handled separately or requires re-validation
  // Add other updatable personal fields here if needed
  handleValidationErrors,
];

/**
 * Validation rules for updating user company data.
 * Allows partial updates (PATCH).
 * @constant {Array<import('express-validator').ValidationChain | Function>}
 */
const validateUpdateCompany = [
  validateOptionalString('companyName', 2),
  validateOptionalString('companyAddress'),
  validateOptionalString('companyPhone'),
  validateOptionalString('companyNIF'),
  // Add other updatable company fields here if needed
  handleValidationErrors,
];

/**
 * Validation rules for changing password.
 * @constant {Array<import('express-validator').ValidationChain | Function>}
 */
const validateChangePassword = [
  body('currentPassword')
    .notEmpty()
    .withMessage('Current password cannot be empty.'),
  body('newPassword')
    .notEmpty()
    .withMessage('New password cannot be empty.')
    .isLength({ min: 8 })
    .withMessage('New password must be at least 8 characters long.')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d\S]{8,}$/)
    .withMessage(
      'New password must contain at least one uppercase letter, one lowercase letter, and one number.'
    )
    .custom((value, { req }) => {
      if (value === req.body.currentPassword) {
        throw new Error('New password cannot be the same as the current password.');
      }
      return true;
    }),
  handleValidationErrors,
];

/**
 * Validation rules for requesting password recovery.
 * @constant {Array<import('express-validator').ValidationChain | Function>}
 */
const validateForgotPassword = [
  body('email')
    .notEmpty()
    .withMessage('Email cannot be empty.')
    .isEmail()
    .withMessage('Must be a valid email address.')
    .normalizeEmail(),
  handleValidationErrors,
];

/**
 * Validation rules for resetting password with a token.
 * @constant {Array<import('express-validator').ValidationChain | Function>}
 */
const validateResetPassword = [
  body('token').notEmpty().withMessage('Reset token cannot be empty.'),
  body('newPassword')
    .notEmpty()
    .withMessage('New password cannot be empty.')
    .isLength({ min: 8 })
    .withMessage('New password must be at least 8 characters long.')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d\S]{8,}$/)
    .withMessage(
      'New password must contain at least one uppercase letter, one lowercase letter, and one number.'
    ),
  handleValidationErrors,
];

/**
 * Validation rules for inviting another user.
 * @constant {Array<import('express-validator').ValidationChain | Function>}
 */
const validateInviteUser = [
  body('email')
    .notEmpty()
    .withMessage('Email cannot be empty.')
    .isEmail()
    .withMessage('Must be a valid email address.')
    .normalizeEmail(),
  body('role')
    .optional()
    .isIn(['admin', 'guest']) // Adjust roles as needed
    .withMessage('Invalid role specified.'),
  handleValidationErrors,
];

/**
 * Validation rules for operations requiring a user ID in the route parameter.
 * @constant {Array<import('express-validator').ValidationChain | Function>}
 */
const validateUserId = [validateMongoId('id'), handleValidationErrors];

module.exports = {
  validateUserRegistration,
  validateUserLogin,
  validateEmailVerification,
  validateUpdateUser,
  validateUpdateCompany,
  validateChangePassword,
  validateForgotPassword,
  validateResetPassword,
  validateInviteUser,
  validateUserId, // Export validator for routes like GET /api/user/:id
};
