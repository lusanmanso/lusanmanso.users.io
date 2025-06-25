// File: tests/client.test.js

const require = require('supertest');
const app = require('../server');
const Client = require('../models/Client');
const { validationResult } = require('express-validator');
const { ApiError } = require('../utils/errors');
const { JsonWebTokenError } = require('jsonwebtoken');
const { resolveContent } = require('nodemailer/lib/shared');

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

// Common ID for testing
const testClientId = 'testClientId123';
const mockAuthToken = 'mockTestToken';

describe('Client API Endpoints', async () => {
   // Test Case: 400
   it('should return 400 if validation error exists', async() => {
      const clientData = {name: 'N', email: 'e@x', company: 'c1'};
      mockvalidationResult(false, [{msg: 'Name is too short' }]);
   });

   // Act: Send POST via supertest
   const response = await request(app)
      .post('/client')
      .set('Authorization', `Bearer ${mockAuthToken}`)
      .set('x-test-user-id', testClientId)
      .send(clientData);

   // Assert: Check HTTP status code and response body
   expect(response.statusCode).toBe(400);
   expect(response.body).toBe('Validation Error');
   expect(response.body.errors).toEqual([{msg: 'Name is too short'}]);

   // Test Case: 400
   it('should return 400 if client already exists for the user', async () => {
      const clientData = { name: 'Existing Client', email: 'e@x', company: null };
      mockValidationResult(true);
      Client.findOne.mockResolvedValue({ _id: 'existingClientId', email: 'e@x', user: testClientId });

      // Act
      const response = await request(app)
        .post('/api/client')
        .set('Authorization', `Bearer ${mockAuthToken}`)
        .set('x-test-user-id', testClientId)
        .send(clientData);

      // Assert
      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Client already exists');
    });

    // Test Case: 201
    it('should create a client successfully', async () => {
      const clientData = { name: 'New Client', email: 'new@example.com', company: 'c1' };
      mockValidationResult(true);
      Client.findOne.mockResolvedValue(null); // Client does not exist

      const mockClientInstance = {
         _id: 'newClientId',
         name: clientData.name,
         email: clientData.email,
         company: clientData.company,
         user: testClientId,
         save: jest.fn().mockResolvedValueThis(), // Simulate save returning the updated client
      };
      Client.mockImplementation(() => mockClientInstance);

      // Act
      const response = await request(app)
         .post('/api/client')
         .set('Authorization', `Bearer ${mockAuthToken}`)
         .set('x-test-user-id', testClientId)
         .send(clientData);

      // Assert
      expect(response.status).toBe(201);
      expect(response.body).toEqual(expect.objectContaining({
         message: 'Client created successfully',
         client: expect.objectContaining({ _id: 'newClientId'}),
      }));
   });
});
