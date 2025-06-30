// File: validators/projectValidators.js
const { body } = require('express-validator');
const {
  validateMongoId,
  handleValidationErrors,
  validateRequiredString,
  validateOptionalString,
  validateMongoIdBody,
  validateOptionalDate,
} = require('./commonValidators');
const Project = require('../models/Project'); // Needed for uniqueness check if required

/**
 * Validation rules for creating a new project.
 * @constant {Array<import('express-validator').ValidationChain | Function>}
 */
const validateCreateProject = [
  validateRequiredString('name', 3),
  validateRequiredString('description', 10),
  validateMongoIdBody('client'), // Ensure clientId is a valid ObjectId in the body
  validateOptionalDate('startDate'),
  validateOptionalDate('endDate'),
  body('endDate').custom((value, { req }) => {
    if (value && req.body.startDate && new Date(value) < new Date(req.body.startDate)) {
      throw new Error('End date cannot be before start date.');
    }
    return true;
  }),
  // Add custom validation if project names must be unique per client/user
  // .custom(async (name, { req }) => {
  //   const userId = req.user?.id;
  //   const clientId = req.body.clientId;
  //   if (!userId || !clientId) {
  //     throw new Error('User or Client ID not found for validation.');
  //   }
  //   const existingProject = await Project.findOne({ name, userId, clientId });
  //   if (existingProject) {
  //     return Promise.reject('Project with this name already exists for this client.');
  //   }
  // }),
  handleValidationErrors,
];

/**
 * Validation rules for updating an existing project.
 * Allows partial updates (PATCH/PUT).
 * Requires project ID in the route parameter.
 * @constant {Array<import('express-validator').ValidationChain | Function>}
 */
const validateUpdateProject = [
  validateMongoId('id'), // Validate the ID in the URL parameter
  validateOptionalString('name', 3),
  validateOptionalString('description', 10),
  validateMongoIdBody('client', { optional: true }), // Allow updating client association
  validateOptionalDate('startDate'),
  validateOptionalDate('endDate'),
  body('endDate').custom((value, { req }) => {
    // Need to potentially fetch the project to compare dates if only one is provided
    // This logic might be better placed in the controller or service layer after fetching the project
    // For simplicity here, we only validate if both dates are present in the request
    const startDate = req.body.startDate;
    if (value && startDate && new Date(value) < new Date(startDate)) {
      throw new Error('End date cannot be before start date.');
    }
    // If only endDate is provided, we'd need the existing startDate to compare
    // If only startDate is provided, we'd need the existing endDate to compare
    return true;
  }),
  // Add custom validation for uniqueness if needed, similar to create but excluding self
  handleValidationErrors,
];

/**
 * Validation rules for operations requiring a project ID in the route parameter.
 * @constant {Array<import('express-validator').ValidationChain | Function>}
 */
const validateProjectId = [validateMongoId('id'), handleValidationErrors];

module.exports = {
  validateCreateProject,
  validateUpdateProject,
  validateProjectId,
};
