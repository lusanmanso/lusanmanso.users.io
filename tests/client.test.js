// File: client.test.js

const request = require('supertest'); // Import supertest for HTTP assertions
const app = require('../server'); // Import Express app instance
const Client = require('../models/Client');
const { validationResult } = require('express-validator');
const { ApiError } = require('../middleware/handleError'); // Import ApiError for specific error assertions (though supertest usually catches it)

// Mocking external dependencies
jest.mock('../models/Client');
jest.mock('express-validator', () => ({
  validationResult: jest.fn(),
}));

// Helper function to mock validationResult consistently
const mockValidationResult = (isEmpty, errors = []) => {
  validationResult.mockReturnValue({
    isEmpty: () => isEmpty,
    array: () => errors,
  });
};

const testClientId = 'testClientId123';
const mockAuthToken = 'mockTestToken'; // Dummy token for Auth header

describe('Client API Endpoints', () => {
  afterEach(() => {
    jest.clearAllMocks(); // To ensure isolation
  });

  // createClient()
  describe('POST /api/client', () => {
    // Test case: should return 400 if validation errors exist
    it('should return 400 if validation errors exist', async () => {
      // Arrange: Set up request body and mock validationResult to indicate errors
      const clientData = { name: 'N', email: 'e@x', company: 'c1' };
      mockValidationResult(false, [{ msg: 'Name is too short' }]); // Specific error message for clarity

      // Act: Send POST request via supertest
      const response = await request(app)
        .post('/api/client')
        .set('Authorization', `Bearer ${mockAuthToken}`)
        .set('x-test-user-id', testClientId) // Simulate authenticated user
        .send(clientData);

      // Assert: Check HTTP status and response body
      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Validation errors');
      expect(response.body.errors).toEqual([{ msg: 'Name is too short' }]);
    });

    // Test case: 400
    it('should return 400 if client already exists for the user', async () => {
      // Arrange: Mock validationResult to be empty (no validation errors)
      // Mock Client.findOne to return an existing client
      const clientData = { name: 'Existing Client', email: 'e@x', company: null };
      mockValidationResult(true);
      Client.findOne.mockResolvedValue({ _id: 'existingClientId', email: 'e@x', user: testClientId });

      // Act: Send POST request
      const response = await request(app)
        .post('/api/client')
        .set('Authorization', `Bearer ${mockAuthToken}`)
        .set('x-test-user-id', testClientId)
        .send(clientData);

      // Assert
      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Client already exists');
    });

    // Test case: 201
    it('should create a client successfully (201)', async () => {
      // Arrange: Set up request, mock successful validation and no existing client
      // Mock the Client constructor and its save method
      const clientData = { name: 'New Client', email: 'new@example.com', company: 'comp1' };
      mockValidationResult(true);
      Client.findOne.mockResolvedValue(null); // No existing client

      const mockClientInstance = {
        _id: 'newClientId',
        name: clientData.name,
        email: clientData.email,
        company: clientData.company,
        user: testClientId,
        save: jest.fn().mockResolvedValue(this), // Simulate save returning the updated client
      };
      Client.mockImplementation(() => mockClientInstance);

      // Act: Send POST request
      const response = await request(app)
        .post('/api/client  ')
        .set('Authorization', `Bearer ${mockAuthToken}`)
        .set('x-test-user-id', testClientId)
        .send(clientData);

      // Assert
      expect(Client).toHaveBeenCalledWith(expect.objectContaining({
        name: 'New Client',
        email: 'new@example.com',
        company: 'comp1',
        user: testClientId,
      }));
      expect(mockClientInstance.save).toHaveBeenCalledTimes(1);
      expect(response.status).toBe(201);
      expect(response.body).toEqual(expect.objectContaining({
        message: 'CLient created successfully',
        client: expect.objectContaining({ _id: 'newClientId' }),
      }));
    });
  });

  // Test suite for getClients
  describe('GET /api/client', () => {
    // Test case: 200
    it('should retrieve active clients successfully (200)', async () => {
      // Arrange: Set up request and mock Client.find to return a list of clients
      const mockClients = [
        { _id: 'c1', name: 'Client A', archived: false, company: { name: 'Company X' } },
        { _id: 'c2', name: 'Client B', archived: false, company: null },
      ];
      Client.find.mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockClients)
      });

      // Act: Send GET request
      const response = await request(app)
        .get('/api/client')
        .set('Authorization', `Bearer ${mockAuthToken}`)
        .set('x-test-user-id', testClientId);

      // Assert
      expect(Client.find).toHaveBeenCalledWith({ createdBy: testClientId, archived: false });
      expect(Client.find().populate).toHaveBeenCalledWith('compnay', 'name');
      expect(response.status).toBe(200);
      expect(response.body).toEqual(expect.objectContaining({
        message: 'Clients retrieved successfully',
        clients: mockClients,
      }));
    });
  });

  // getClientById()
  describe('GET /api/client/:id', () => {
    // Test case:404
    it('should return 404 if client not found', async () => {
      // Arrange
      Client.findOne.mockReturnValue({
        populate: jest.fn().mockResolvedValue(null)
      });

      // Act
      const response = await request(app)
        .get(`/api/client/nonExistentId`)
        .set('Authorization', `Bearer ${mockAuthToken}`)
        .set('x-test-user-id', testClientId);

      // Assert
      expect(response.status).toBe(404);
      expect(response.body.message).toBe('Client not found');
    });

    // Test case: 200
    it('should return client by ID (200)', async () => {
      // Arrange
      const clientId = 'c1';
      const mockClient = { _id: clientId, name: 'Found Client', archived: false, company: { name: 'Test Corp' } };
      Client.findOne.mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockClient)
      });

      // Act
      const response = await request(app)
        .get(`/api/client/${clientId}`)
        .set('Authorization', `Bearer ${mockAuthToken}`)
        .set('x-test-user-id', testClientId);

      // Assert
      expect(Client.findOne).toHaveBeenCalledWith({ _id: clientId, createdBy: testClientId, archived: false });
      expect(Client.findOne().populate).toHaveBeenCalledWith('company', 'name');
      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockClient);
    });
  });

  // updateClient()
  describe('PUT /api/client/:id', () => {
    // Test case: 400
    it('should return 400 if validation errors exist', async () => {
      // Arrange
      const clientId = 'c1';
      const updateData = { name: '' };
      mockValidationResult(false, [{ msg: 'Name cannot be empty' }]);

      // Act
      const response = await request(app)
        .put(`/api/client/${clientId}`)
        .set('Authorization', `Bearer ${mockAuthToken}`)
        .set('x-test-user-id', testClientId)
        .send(updateData);

      // Assert
      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Validation errors');
    });

    // Test case: 404
    it('should return 404 if client not found', async () => {
      // Arrange
      const clientId = 'nonExistentId';
      const updateData = { name: 'Updated Name' };
      mockValidationResult(true);
      Client.findOne.mockResolvedValue(null);

      // Act
      const response = await request(app)
        .put(`/api/client/${clientId}`)
        .set('Authorization', `Bearer ${mockAuthToken}`)
        .set('x-test-user-id', testClientId)
        .send(updateData);

      // Assert
      expect(response.status).toBe(404);
      expect(response.body.message).toBe('Client not found');
    });

    // Test case: 409
    it('should return 409 if duplicate email exists for another client', async () => {
      // Arrange
      const clientId = 'c1';
      const updateData = { email: 'duplicate@example.com' };
      mockValidationResult(true);
      const existingClient = { _id: clientId, email: 'original@example.com', name: 'Client 1', save: jest.fn() };
      const anotherClientWithDuplicateEmail = { _id: 'c2', email: 'duplicate@example.com' };

      // Set up sequential mock responses for Client.findOne
      Client.findOne
        .mockResolvedValueOnce(existingClient) // First call to find the client to be updated
        .mockResolvedValueOnce(anotherClientWithDuplicateEmail); // Second call to check for duplicate email

      // Act
      const response = await request(app)
        .put(`/api/client/${clientId}`)
        .set('Authorization', `Bearer ${mockAuthToken}`)
        .set('x-test-user-id', testClientId)
        .send(updateData);

      // Assert
      expect(response.status).toBe(409);
      expect(response.body.message).toBe('Another client with this email already exists for this user');
      expect(existingClient.save).not.toHaveBeenCalled();
    });

    // Test case: 200
    it('should update client successfully (200)', async () => {
      // Arrange
      const clientId = 'c1';
      const updateData = { name: 'Updated Name', company: 'newCompId', email: 'original@example.com' };
      mockValidationResult(true);
      const mockClient = {
        _id: clientId,
        name: 'Original Name',
        email: 'original@example.com',
        company: 'oldCompId',
        archived: false,
        save: jest.fn().mockResolvedValue(this), // Simulate save returning the updated client
      };
      Client.findOne.mockResolvedValueOnce(mockClient); // For finding the client to update
      Client.findOne.mockResolvedValueOnce(null); // For duplicate email check (no duplicate)

      // Need to mock `updatedClient` from the controller
      const populatedClientMock = {
        _id: clientId,
        name: 'Updated Name',
        email: 'original@example.com',
        company: 'newCompId',
        archived: false,
      };

      // Mock Client.findById for the response after save
      Client.findById.mockReturnValue({
        populate: jest.fn().mockResolvedValue(populatedClientMock)
      });

      // Act
      const response = await request(app)
        .put(`/api/client/${clientId}`)
        .set('Authorization', `Bearer ${mockAuthToken}`)
        .set('x-test-user-id', testClientId)
        .send(updateData);

      // Assert
      expect(mockClient.name).toBe('Updated Name'); // Verify direct property update on the mock instance
      expect(mockClient.company).toBe('newCompId'); // Verify company update
      expect(mockClient.save).toHaveBeenCalledTimes(1); // Ensure save was called
      expect(response.status).toBe(200);
      expect(response.body).toEqual(expect.objectContaining({
        message: 'Client updated successfully',
        client: populatedClientMock, // The controller returns the fully populated updated client object
      }));
    });

    // Test case: updating company to null
    it('should allow updating company to null', async () => {
      // Arrange
      const clientId = 'c1';
      const updateData = { company: null, email: 'client@example.com' };
      mockValidationResult(true);
      const mockClient = {
        _id: clientId,
        name: 'Client with Company',
        email: 'client@example.com',
        company: 'existingCompanyId',
        archived: false,
        save: jest.fn().mockResolvedValue(this),
      };
      Client.findOne.mockResolvedValueOnce(mockClient);
      Client.findOne.mockResolvedValueOnce(null); // No duplicate email

      const populatedClientMock = {
        _id: clientId,
        name: 'Client with Company',
        email: 'client@example.com',
        company: null, // Ensure company is null
        archived: false,
      };
      Client.findById.mockReturnValue({
        populate: jest.fn().mockResolvedValue(populatedClientMock)
      });

      // Act
      const response = await request(app)
        .put(`/api/client/${clientId}`)
        .set('Authorization', `Bearer ${mockAuthToken}`)
        .set('x-test-user-id', testClientId)
        .send(updateData);

      // Assert
      expect(mockClient.company).toBeNull(); // Verify company is set to null
      expect(mockClient.save).toHaveBeenCalledTimes(1);
      expect(response.status).toBe(200);
      expect(response.body).toEqual(expect.objectContaining({
        message: 'Client updated successfully',
        client: populatedClientMock,
      }));
    });
  });

  // archiveClient()
  describe('PATCH /api/client/archive/:id', () => {
    // Test case: 404
    it('should return 404 if client not found', async () => {
      // Arrange
      const clientId = 'nonExistentId';
      Client.findOne.mockResolvedValue(null);

      // Act
      const response = await request(app)
        .patch(`/api/client/archive/${clientId}`)
        .set('Authorization', `Bearer ${mockAuthToken}`)
        .set('x-test-user-id', testClientId);

      // Assert
      expect(response.status).toBe(404);
      expect(response.body.message).toBe('Client not found');
    });

    // Test case: 400
    it('should return 400 if client is already archived', async () => {
      // Arrange
      const clientId = 'c1';
      const mockClient = { _id: clientId, archived: true, save: jest.fn() };
      Client.findOne.mockResolvedValue(mockClient);

      // Act
      const response = await request(app)
        .patch(`/api/client/archive/${clientId}`)
        .set('Authorization', `Bearer ${mockAuthToken}`)
        .set('x-test-user-id', testClientId);

      // Assert
      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Client already archived');
      expect(mockClient.save).not.toHaveBeenCalled(); // Ensure save was not called
    });

    // Test case: 200
    it('should archive client successfully (200)', async () => {
      // Arrange
      const clientId = 'c1';
      const mockClient = { _id: clientId, archived: false, save: jest.fn().mockResolvedValue(this) };
      Client.findOne.mockResolvedValue(mockClient);

      // Act
      const response = await request(app)
        .patch(`/api/client/archive/${clientId}`)
        .set('Authorization', `Bearer ${mockAuthToken}`)
        .set('x-test-user-id', testClientId);

      // Assert
      expect(mockClient.archived).toBe(true); // Verify archived status is updated
      expect(mockClient.save).toHaveBeenCalledTimes(1); // Ensure save was called
      expect(response.status).toBe(200);
      expect(response.body).toEqual(expect.objectContaining({
        message: 'Client archived successfully',
        client: mockClient,
      }));
    });
  });

  // deleteClient()
  describe('DELETE /api/client/:id', () => {
    // Test case: 404
    it('should return 404 if no deletion occurred', async () => {
      // Arrange
      const clientId = 'nonExistentId';
      Client.deleteOne.mockResolvedValue({ deletedCount: 0 });

      // Act
      const response = await request(app)
        .delete(`/api/client/${clientId}`)
        .set('Authorization', `Bearer ${mockAuthToken}`)
        .set('x-test-user-id', testClientId);

      // Assert
      expect(response.status).toBe(404);
      expect(response.body.message).toBe('Client not found');
    });

    // Test case: 200
    it('should delete client successfully (200)', async () => {
      // Arrange
      const clientId = 'c1';
      Client.deleteOne.mockResolvedValue({ deletedCount: 1 });

      // Act
      const response = await request(app)
        .delete(`/api/client/${clientId}`)
        .set('Authorization', `Bearer ${mockAuthToken}`)
        .set('x-test-user-id', testClientId);

      // Assert
      expect(Client.deleteOne).toHaveBeenCalledWith({ _id: clientId, createdBy: testClientId });
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ message: 'Client deleted successfully' });
    });
  });

  // getArchivedClients()
  describe('GET /api/client/archived', () => {
    // Test case: should retrieve archived clients successfully (200)
    it('should retrieve archived clients (200)', async () => {
      // Arrange
      const mockArchivedClients = [
        { _id: 'ac1', name: 'Archived Client 1', archived: true, company: { name: 'Old Company' } },
        { _id: 'ac2', name: 'Archived Client 2', archived: true, company: null },
      ];
      Client.find.mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockArchivedClients)
      });

      // Act
      const response = await request(app)
        .get('/api/client/archived')
        .set('Authorization', `Bearer ${mockAuthToken}`)
        .set('x-test-user-id', testClientId);

      // Assert
      expect(Client.find).toHaveBeenCalledWith({ createdBy: testClientId, archived: true });
      expect(Client.find().populate).toHaveBeenCalledWith('company', 'name');
      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockArchivedClients);
    });
  });

  // recoverClient()
  describe('PATCH /api/client/recover/:id', () => {
    // Test case: 404
    it('should return 404 if client not found', async () => {
      // Arrange
      const clientId = 'nonExistentId';
      Client.findOne.mockResolvedValue(null);

      // Act
      const response = await request(app)
        .patch(`/api/client/recover/${clientId}`)
        .set('Authorization', `Bearer ${mockAuthToken}`)
        .set('x-test-user-id', testClientId);

      // Assert
      expect(response.status).toBe(404);
      expect(response.body.message).toBe('Client not found or you do not have permission');
    });

    // Test case: 400
    it('should return 400 if client is not archived', async () => {
      // Arrange
      const clientId = 'c1';
      const mockClient = { _id: clientId, archived: false, save: jest.fn() };
      Client.findOne.mockResolvedValue(mockClient);

      // Act
      const response = await request(app)
        .patch(`/api/client/recover/${clientId}`)
        .set('Authorization', `Bearer ${mockAuthToken}`)
        .set('x-test-user-id', testClientId);

      // Assert
      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Client is not archived');
      expect(mockClient.save).not.toHaveBeenCalled();
    });

    // Test case: 200
    it('should recover archived client successfully (200)', async () => {
      // Arrange
      const clientId = 'c1';
      const mockClient = {
        _id: clientId,
        name: 'Archived Client',
        archived: true,
        save: jest.fn().mockResolvedValue(this) // Simulate save returning the updated client
      };
      Client.findOne.mockResolvedValue(mockClient);

      const populatedClientMock = {
        _id: clientId,
        name: 'Archived Client',
        archived: false, // Should be false after recovery
        // TODO: Add other properties that would be populated in the controller response
      };
      Client.findById.mockReturnValue({
        populate: jest.fn().mockResolvedValue(populatedClientMock)
      });

      // Act
      const response = await request(app)
        .patch(`/api/client/recover/${clientId}`)
        .set('Authorization', `Bearer ${mockAuthToken}`)
        .set('x-test-user-id', testClientId);

      // Assert
      expect(mockClient.archived).toBe(false); // Verify archived status is updated
      expect(mockClient.save).toHaveBeenCalledTimes(1); // Ensure save was called
      expect(response.status).toBe(200);
      expect(response.body).toEqual(expect.objectContaining({
        message: 'Client recovered successfully',
        client: populatedClientMock,
      }));
    });
  });
});
