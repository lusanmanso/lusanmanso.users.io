// File: validators/userValidators.js
const { body } = require('express-validator');
const User = require('../models/User');

// Email validator
const validateEmail = body('email')
  .isEmail()
  .withMessage('Please enter a valid email')
  .custom((value) => {
    // Verify email format according to RFC 5322
    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    if (!emailRegex.test(value)) {
      throw new Error('Email format is not valid');
    }
    return true;
  })
  .normalizeEmail();

// Password validator
const validatePassword = body('password')
  .isLength({ min: 8 })
  .withMessage('Password must be at least 8 characters long')
  .custom((value) => {
    // Verify that the password has at least one number
    if (!/\d/.test(value)) {
      throw new Error('Password must include at least one number');
    }
    // Verify that the password has at least one uppercase letter
    if (!/[A-Z]/.test(value)) {
      throw new Error('Password must include at least one uppercase letter');
    }
    // Verify that the password has at least one special character
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(value)) {
      throw new Error('Password must include at least one special character');
    }
    return true;
  });

// Verification code validator
const validateVerificationCode = body('code')
  .isLength({ min: 6, max: 6 })
  .withMessage('Verification code must be 6 digits')
  .isNumeric()
  .withMessage('Verification code must contain only numbers');

module.exports = {
  validateEmail,
  validatePassword,
  validateVerificationCode
};