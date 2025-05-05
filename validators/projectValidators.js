const { body, param } = require('express-validator');
const mongoose = require('mongoose');

const validateMongoIdInParam = param('id').isMongoId.withMessage('Invalid ID format');
const createProjectValidator = [
   body('name')
      .notEmpty().withMessage('Project name is required')
      .isString().withMessage('Project name must be a string')
      .trim()
      .isLength({ min: 2, max: 150 }).withMessage('Project name must be between 2 and 150 characters'),

   body('description')
      .optional()
      .isString().withMessage('Description must be a string')
      .trim ()
      .isLength({ max: 500 }).withMessage('Description cannot exceed 500 characters'),

   body('client')
      .notEmpty().withMessage('Client ID is required')
      .isMongoId().withMessage('Invalid Client ID format')
];

const updateProjectValidator = [
   body('name')
      .optional({ nullable: true })
      .isString().withMessage('Project name must be a string')
      .trim()
      .isLength({ min: 2, max: 150 }).withMessage('Project name must be between 2 and 150 characters'),

   body('description')
      .optional({ nullable: true })
      .isString().withMessage('Description must be a string')
      .trim()
      .isLength({ max: 500 }).withMessage('Description cannot exceed 500 characters'),

   body('client')
      .optional()
      .isMongoId().withMessage('Invalid Client ID format')
];

module.exports = {createProjectValidator, updateProjectValidator, validateMongoIdInParam}; // Export also de ID validator!
