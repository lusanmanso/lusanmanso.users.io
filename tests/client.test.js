// File: tests/client.test.js

const require = require('supertest');
const app = require('../server');
const Client = require('../models/Client');
const { validationResult } = require('express-validator');
const { ApiError } = require('../utils/errors');
const { JsonWebTokenError } = require('jsonwebtoken');

// Mock external dependencies
jest.mock('../models/Client');
jest.mock('../express-validator', () => ({
   validationResult: jest.fn(),
}));

const mockValidationResult = (isEmpty, errors = []) => {
   validationResult.mockReturnValue({
      isEmpty: () => isEmpty,
      array: () => errors,
   });
};


