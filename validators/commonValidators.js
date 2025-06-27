// File: validators/commonValidators.js
const { body, param, validationResult } = require('express-validator');
const mongoose = require('mongoose');
const { handleError } = require('../middleware/handleError');

/**
 * Middleware to handle validation errors from express-validator.
 *
 * @param {import('express').Request} req - The Express request object.
 * @param {import('express').Response} res - The Express response object.
 * @param {import('express').NextFunction} next - The Express next middleware function.
 */
const handleValidationErrors = (req, res, next) => {
   try {
      validationResult(req).throw();
      return next();
   } catch (err) {
      // Use the existing handleError middleware for consistent error responses
      return handleError(res, 'VALIDATION_ERROR', 400, err.errors);
   }
};

/**
 * Creates a validation chain to check if a request parameter is a valid MongoDB ObjectId.
 *
 * @param {string} fieldName - The name of the request parameter to validate (e.g., 'id', 'userId').
 * @returns {import('express-validator').ValidationChain} - The express-validator validation chain.
 */
const validateMongoId = (fieldName) =>
   param(fieldName)
      .notEmpty()
      .withMessage(`${fieldName} cannot be empty.`)
      .isMongoId()
      .withMessage(`${fieldName} must be a valid MongoDB ObjectId.`);

/**
 * Creates a validation chain to check if a request body field is a valid MongoDB ObjectId.
 *
 * @param {string} fieldName - The name of the field in the request body to validate.
 * @param {object} [options={}] - Options object.
 * @param {boolean} [options.optional=false] - Whether the field is optional.
 * @returns {import('express-validator').ValidationChain} - The express-validator validation chain.
 */
const validateMongoIdBody = (fieldName, options = {}) => {
   const validator = body(fieldName);
   if (options.optional) {
      return validator
         .optional({ checkFalsy: true })
         .isMongoId()
         .withMessage(`${fieldName} must be a valid MongoDB ObjectId if provided.`);
   }
   return validator
      .notEmpty()
      .withMessage(`${fieldName} cannot be empty.`)
      .isMongoId()
      .withMessage(`${fieldName} must be a valid MongoDB ObjectId.`);
};


/**
 * Creates a validation chain for a required string field in the request body.
 *
 * @param {string} fieldName - The name of the field in the request body.
 * @param {number} [minLength=1] - The minimum length of the string.
 * @returns {import('express-validator').ValidationChain} - The express-validator validation chain.
 */
const validateRequiredString = (fieldName, minLength = 1) =>
   body(fieldName)
      .notEmpty()
      .withMessage(`${fieldName} cannot be empty.`)
      .isString()
      .withMessage(`${fieldName} must be a string.`)
      .trim()
      .isLength({ min: minLength })
      .withMessage(`${fieldName} must be at least ${minLength} characters long.`);

/**
 * Creates a validation chain for an optional string field in the request body.
 *
 * @param {string} fieldName - The name of the field in the request body.
 * @param {number} [minLength=0] - The minimum length of the string if provided.
 * @returns {import('express-validator').ValidationChain} - The express-validator validation chain.
 */
const validateOptionalString = (fieldName, minLength = 0) =>
   body(fieldName)
      .optional({ checkFalsy: true }) // Allows null, undefined, ''
      .isString()
      .withMessage(`${fieldName} must be a string if provided.`)
      .trim()
      .isLength({ min: minLength })
      .withMessage(`${fieldName} must be at least ${minLength} characters long if provided.`);

/**
 * Creates a validation chain for a required number field in the request body.
 *
 * @param {string} fieldName - The name of the field in the request body.
 * @returns {import('express-validator').ValidationChain} - The express-validator validation chain.
 */
const validateRequiredNumber = (fieldName) =>
   body(fieldName)
      .notEmpty()
      .withMessage(`${fieldName} cannot be empty.`)
      .isNumeric()
      .withMessage(`${fieldName} must be a number.`);

/**
 * Creates a validation chain for an optional number field in the request body.
 *
 * @param {string} fieldName - The name of the field in the request body.
 * @returns {import('express-validator').ValidationChain} - The express-validator validation chain.
 */
const validateOptionalNumber = (fieldName) =>
   body(fieldName)
      .optional({ checkFalsy: true })
      .isNumeric()
      .withMessage(`${fieldName} must be a number if provided.`);

/**
 * Creates a validation chain for a required boolean field in the request body.
 *
 * @param {string} fieldName - The name of the field in the request body.
 * @returns {import('express-validator').ValidationChain} - The express-validator validation chain.
 */
const validateRequiredBoolean = (fieldName) =>
   body(fieldName)
      .isBoolean()
      .withMessage(`${fieldName} must be a boolean (true or false).`);

/**
 * Creates a validation chain for an optional boolean field in the request body.
 *
 * @param {string} fieldName - The name of the field in the request body.
 * @returns {import('express-validator').ValidationChain} - The express-validator validation chain.
 */
const validateOptionalBoolean = (fieldName) =>
   body(fieldName)
      .optional({ checkFalsy: true }) // Allos null, undefined, ''
      .isBoolean()
      .withMessage(`${fieldName} must be a boolean (true or false).`);


/**
 * Creates a validation chain for a required date field in the request body.
 *
 * @param {string} fieldName - The name of the field in the request body.
 * @returns {import('express-validator').ValidationChain} - The express-validator validation chain.
 */
const validateRequiredDate = (fieldName) =>
   body(fieldName)
      .notEmpty()
      .withMessage(`${fieldName} cannot be empty.`)
      .isISO8601()
      .withMessage(`${fieldName} must be a valid date in ISO8601 format (YYYY-MM-DD).`)
      .toDate(); // Convert to Date object

/**
 * Creates a validation chain for an optional date field in the request body.
 *
 * @param {string} fieldName - The name of the field in the request body.
 * @returns {import('express-validator').ValidationChain} - The express-validator validation chain.
 */
const validateOptionalDate = (fieldName) =>
   body(fieldName)
      .optional({ checkFalsy: true }) // Allows null, undefined, ''
      .isISO8601()
      .withMessage(`${fieldName} must be a valid date in ISO8601 format (YYYY-MM-DD).`)
      .toDate(); // Convert to Date object

module.exports = {
   handleValidationErrors,
   validateMongoId,
   validateMongoIdBody,
   validateRequiredString,
   validateOptionalString,
   validateRequiredNumber,
   validateOptionalNumber,
   validateRequiredBoolean,
   validateOptionalBoolean,
   validateRequiredDate,
   validateOptionalDate
};
