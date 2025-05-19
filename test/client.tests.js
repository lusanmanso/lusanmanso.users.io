const clientController = require('../controllers/clientController');
const Client = require('../models/Client');
const { validationResult } = require('express-validator');
const { ApiError } = require('../middleware/handleError');

jest.mock('../models/Client');
jest.mock('express-validator', () => ({ validationResult: jest.fn() }));

describe('Client Controller', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

   // Test for createClient
  describe('createClient', () => {
    it('should throw 400 if validation errors exist', async () => {
      // Arrange
      const req = { body: { name: 'N', email: 'e@x', company: 'c1' }, user: { id: 'u1' } };
      validationResult.mockReturnValue({ isEmpty: () => false, array: () => ['err'] });
      // Act & Assert
      await expect(clientController.createClient(req)).rejects.toHaveProperty('statusCode', 400);
    });

    it('should throw 400 if client already exists', async () => {
      // Arrange
      const req = { body: { name: 'N', email: 'e@x' }, user: { id: 'u1' } };
      validationResult.mockReturnValue({ isEmpty: () => true });
      Client.findOne.mockResolvedValue({ _id: 'c1' });
      // Act & Assert
      await expect(clientController.createClient(req)).rejects.toHaveProperty('statusCode', 400);
    });

    it('should create a client successfully (201)', async () => {
      // Arrange
      const clientObj = { save: jest.fn(), name: 'N', email: 'e@x', company: null, user: 'u1' };
      const req = { body: { name: 'N', email: 'e@x' }, user: { id: 'u1' } };
      validationResult.mockReturnValue({ isEmpty: () => true });
      Client.findOne.mockResolvedValue(null);
      Client.mockImplementation(() => clientObj);
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      // Act
      await clientController.createClient(req, res);
      // Assert
      expect(clientObj.save).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ message: 'CLient created successfully', client: clientObj });
    });
  });

  // Test for getClients
  describe('getClients', () => {
    it('should retrieve active clients (200)', async () => {
      // Arrange
      const req = { user: { id: 'u1' } };
      const clients = [{ name: 'C1' }];
      Client.find = jest.fn(() => ({ populate: () => Promise.resolve(clients) }));
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      // Act
      await clientController.getClients(req, res);
      // Assert
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ message: 'Clients retrieved successfully', clients });
    });
  });

  // Test for getClientById
  describe('getClientById', () => {
    it('should throw 404 if client not found', async () => {
      // Arrange
      const req = { params: { id: 'c1' }, user: { id: 'u1' } };
      Client.findOne = jest.fn(() => ({ populate: () => Promise.resolve(null) }));
      // Act & Assert
      await expect(clientController.getClientById(req)).rejects.toHaveProperty('statusCode', 404);
    });

    it('should return client by ID (200)', async () => {
      // Arrange
      const req = { params: { id: 'c1' }, user: { id: 'u1' } };
      const client = { _id: 'c1' };
      Client.findOne = jest.fn(() => ({ populate: () => Promise.resolve(client) }));
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      // Act
      await clientController.getClientById(req, res);
      // Assert
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(client);
    });
  });

  // Test for updateClient
  describe('updateClient', () => {
    it('should throw 400 if validation errors exist', async () => {
      // Arrange
      const req = { params: { id: 'c1' }, body: {}, user: { id: 'u1' } };
      validationResult.mockReturnValue({ isEmpty: () => false, array: () => ['err'] });
      // Act & Assert
      await expect(clientController.updateClient(req)).rejects.toHaveProperty('statusCode', 400);
    });

    it('should throw 404 if client not found', async () => {
      // Arrange
      const req = { params: { id: 'c1' }, body: { email: 'e2' }, user: { id: 'u1' } };
      validationResult.mockReturnValue({ isEmpty: () => true });
      Client.findOne.mockResolvedValue(null);
      // Act & Assert
      await expect(clientController.updateClient(req)).rejects.toHaveProperty('statusCode', 404);
    });

    it('should throw 409 if duplicate email exists', async () => {
      // Arrange
      const req = { params: { id: 'c1' }, body: { email: 'e2' }, user: { id: 'u1' } };
      validationResult.mockReturnValue({ isEmpty: () => true });
      const clientMock = { email: 'e1' };
      Client.findOne = jest.fn()
        .mockResolvedValueOnce(clientMock) // find original
        .mockResolvedValueOnce({ _id: 'c2' }); // duplicate
      // Act & Assert
      await expect(clientController.updateClient(req)).rejects.toHaveProperty('statusCode', 409);
    });

    it('should update client successfully (200)', async () => {
      // Arrange
      const req = { params: { id: 'c1' }, body: { name: 'New' }, user: { id: 'u1' } };
      validationResult.mockReturnValue({ isEmpty: () => true });
      const clientMock = { name: 'Old', save: jest.fn(), email: 'e1', company: null };
      Client.findOne = jest.fn().mockResolvedValue(clientMock);
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      // Act
      await clientController.updateClient(req, res);
      // Assert
      expect(clientMock.name).toBe('New');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'Client updated successfully' }));
    });
  });

  // Test for archiveClient
  describe('archiveClient', () => {
    it('should throw 404 if client not found', async () => {
      // Arrange
      const req = { params: { id: 'c1' }, user: { id: 'u1' } };
      Client.findOne.mockResolvedValue(null);
      // Act & Assert
      await expect(clientController.archiveClient(req)).rejects.toHaveProperty('statusCode', 404);
    });

    it('should throw 400 if already archived', async () => {
      // Arrange
      const req = { params: { id: 'c1' }, user: { id: 'u1' } };
      const clientMock = { archived: true };
      Client.findOne.mockResolvedValue(clientMock);
      // Act & Assert
      await expect(clientController.archiveClient(req)).rejects.toHaveProperty('statusCode', 400);
    });

    it('should archive client successfully (200)', async () => {
      // Arrange
      const req = { params: { id: 'c1' }, user: { id: 'u1' } };
      const clientMock = { archived: false, save: jest.fn() };
      Client.findOne.mockResolvedValue(clientMock);
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      // Act
      await clientController.archiveClient(req, res);
      // Assert
      expect(clientMock.archived).toBe(true);
      expect(clientMock.save).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ message: 'Client archived successfully', client: clientMock });
    });
  });

  // Test for deleteClient
  describe('deleteClient', () => {
    it('should throw 404 if no deletion occurred', async () => {
      // Arrange
      const req = { params: { id: 'c1' }, user: { id: 'u1' } };
      Client.deleteOne = jest.fn().mockResolvedValue({ deleteCount: 0 });
      // Act & Assert
      await expect(clientController.deleteClient(req)).rejects.toHaveProperty('statusCode', 404);
    });

    it('should delete client successfully (200)', async () => {
      // Arrange
      const req = { params: { id: 'c1' }, user: { id: 'u1' } };
      Client.deleteOne = jest.fn().mockResolvedValue({ deleteCount: 1 });
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      // Act
      await clientController.deleteClient(req, res);
      // Assert
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ message: 'Client deleted successfully' });
    });
  });

  // Test for getArchivedClients
  describe('getArchivedClients', () => {
    it('should retrieve archived clients (200)', async () => {
      // Arrange
      const req = { user: { id: 'u1' } };
      const clients = [{ name: 'C1' }];
      Client.find = jest.fn(() => ({ populate: () => Promise.resolve(clients) }));
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      // Act
      await clientController.getArchivedClients(req, res);
      // Assert
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(clients);
    });
  });

  // Test for recoverClient
  describe('recoverClient', () => {
    it('should throw 404 if client not found', async () => {
      // Arrange
      const req = { params: { id: 'c1' }, user: { id: 'u1' } };
      Client.findOne = jest.fn().mockResolvedValue(null);
      // Act & Assert
      await expect(clientController.recoverClient(req)).rejects.toHaveProperty('statusCode', 404);
    });

    it('should throw 400 if client not archived', async () => {
      // Arrange
      const req = { params: { id: 'c1' }, user: { id: 'u1' } };
      Client.findOne = jest.fn().mockResolvedValue({ archived: false });
      // Act & Assert
      await expect(clientController.recoverClient(req)).rejects.toHaveProperty('statusCode', 400);
    });

    it('should recover archived client successfully (200)', async () => {
      // Arrange
      const req = { params: { id: 'c1' }, user: { id: 'u1' } };
      const clientMock = { archived: true, save: jest.fn().mockResolvedValue({ _id: 'c1' }) };
      Client.findOne = jest.fn().mockResolvedValue(clientMock);
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      // Act
      await clientController.recoverClient(req, res);
      // Assert
      expect(clientMock.archived).toBe(false);
      expect(clientMock.save).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ message: 'Client recovered successfully', client: { _id: 'c1' } });
    });
  });
});
