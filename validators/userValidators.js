// File: validators/userValidators.js
const { body, param, validationResult } = require('express-validator');
const mongoose = require('mongoose');

/**
 * Handle validation errors and format response
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      type: 'VALIDATION_ERROR',
      data: { errors: errors.array() }
    });
  }
  next();
};

/**
 * Validate MongoDB ObjectId in route parameters
 * @param {string} paramName - The parameter name to validate
 * @returns {ValidationChain}
 */
const validateMongoId = (paramName) => {
  return param(paramName)
    .custom((value) => {
      if (!mongoose.Types.ObjectId.isValid(value)) {
        throw new Error(`${paramName} must be a valid MongoDB ObjectId.`);
      }
      return true;
    });
};

/**
 * Validation rules for user registration.
 * @constant {Array<import('express-validator').ValidationChain | Function>}
 */
const validateUserRegistration = [
  body('name')
    .notEmpty()
    .withMessage('Name cannot be empty.')
    .isLength({ min: 2, max: 50 })
    .withMessage('Name must be between 2 and 50 characters.'),
  body('surname')
    .notEmpty()
    .withMessage('Surname cannot be empty.')
    .isLength({ min: 2, max: 50 })
    .withMessage('Surname must be between 2 and 50 characters.'),
  body('email')
    .notEmpty()
    .withMessage('Email cannot be empty.')
    .isEmail()
    .withMessage('Must be a valid email address.')
    .normalizeEmail(),
  body('password')
    .notEmpty()
    .withMessage('Password cannot be empty.')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long.')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d\S]{8,}$/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number.'),
  body('passwordConfirm')
    .notEmpty()
    .withMessage('Password confirmation is required.')
    .custom((value, { req }) => {
      if (value !== req.body.password) {
        throw new Error('Password confirmation does not match password.');
      }
      return true;
    }),
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
  body('password')
    .notEmpty()
    .withMessage('Password is required.'),
  handleValidationErrors,
];

/**
 * Validation rules for email verification.
 * @constant {Array<import('express-validator').ValidationChain | Function>}
 */
const validateEmailVerification = [
  body('code')
    .notEmpty()
    .withMessage('Verification code is required.')
    .isLength({ min: 6, max: 6 })
    .withMessage('Verification code must be exactly 6 characters.')
    .isNumeric()
    .withMessage('Verification code must be numeric.'),
  handleValidationErrors,
];

/**
 * Validation rules for updating user personal data.
 * @constant {Array<import('express-validator').ValidationChain | Function>}
 */
const validateUpdateUser = [
  body('firstName')
    .optional()
    .notEmpty()
    .withMessage('First name cannot be empty.')
    .isLength({ min: 2, max: 50 })
    .withMessage('First name must be between 2 and 50 characters.'),
  body('lastName')
    .optional()
    .notEmpty()
    .withMessage('Last name cannot be empty.')
    .isLength({ min: 2, max: 50 })
    .withMessage('Last name must be between 2 and 50 characters.'),
  body('phoneNumber')
    .optional()
    .isMobilePhone()
    .withMessage('Must be a valid phone number.'),
  body('nif')
    .optional()
    .isLength({ min: 9, max: 9 })
    .withMessage('NIF must be exactly 9 characters.'),
  handleValidationErrors,
];

/**
 * Validation rules for updating user company data.
 * @constant {Array<import('express-validator').ValidationChain | Function>}
 */
const validateUpdateCompany = [
  body('company.name')
    .optional()
    .notEmpty()
    .withMessage('Company name cannot be empty.')
    .isLength({ min: 2, max: 100 })
    .withMessage('Company name must be between 2 and 100 characters.'),
  body('company.cif')
    .optional()
    .isLength({ min: 9, max: 9 })
    .withMessage('CIF must be exactly 9 characters.'),
  body('company.address')
    .optional()
    .notEmpty()
    .withMessage('Company address cannot be empty.'),
  body('company.phone')
    .optional()
    .isMobilePhone()
    .withMessage('Must be a valid phone number.'),
  body('company.isAutonomous')
    .optional()
    .isBoolean()
    .withMessage('isAutonomous must be a boolean value.'),
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
 * Validation rules for resetting password with a code.
 * @constant {Array<import('express-validator').ValidationChain | Function>}
 */
const validateResetPassword = [
  body('email')
    .notEmpty()
    .withMessage('Email cannot be empty.')
    .isEmail()
    .withMessage('Must be a valid email address.')
    .normalizeEmail(),
  body('code')
    .notEmpty()
    .withMessage('Reset code cannot be empty.')
    .isLength({ min: 6, max: 6 })
    .withMessage('Reset code must be exactly 6 characters.')
    .isNumeric()
    .withMessage('Reset code must be numeric.'),
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
    .isIn(['admin', 'guest'])
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
  validateUserId,
};
