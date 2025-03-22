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

// Personal data validator
const validatePersonalData = [
    body('firstName')
        .notEmpty()
        .withMessage('First name is required')
        .isLength({ min: 2, max: 50 })
        .withMessage('First name must be between 2 and 50 characters long')
        .trim(),

    body('lastName')
        .notEmpty()
        .withMessage('Last name is required')
        .isLength({ min: 2, max: 50 })
        .withMessage('Last name must be between 2 and 50 characters long')
        .trim(),

    body('nif')
        .notEmpty()
        .withMessage('NIF is required')
        .matches(/[0-9]{8}[A-Z]$/)
        .withMessage('NIF must be 8 digits followed by a letter')
        .trim()
];

// Company data validator
const validateCompanyData = [
    body('company.name')
        .notEmpty()
        .withMessage('Company name is required')
        .isLength({ min: 2, max: 50 })
        .withMessage('Company name must be between 2 and 50 characters long')
        .trim(),

    body('company.cif')
        .notEmpty()
        .withMessage('CIF is required')
        .matches(/[A-Z]{1}[0-9]{8}$/)
        .withMessage('CIF must start with a letter followed by 8 digits')
        .trim(),

    body('company.address.street')
        .notEmpty()
        .withMessage('Street is required')
        .trim(),

    body('company.address.city')
        .notEmpty()
        .withMessage('City is required')
        .trim(),
    
    body('company.address.postalCode')
        .notEmpty()
        .withMessage('Postal code is required')
        .matches(/^[0-9]{5}$/)
        .withMessage('Postal code must be 5 digits')
        .trim(),

    body('company.isAutonomous')
        .isBoolean()
        .withMessage('Is autonomous must be a boolean value'),
];

module.exports = {
    validateEmail,
    validatePassword,
    validateVerificationCode,
    validatePersonalData,
    validateCompanyData
};