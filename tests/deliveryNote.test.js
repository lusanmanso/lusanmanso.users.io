const deliveryNoteController = require('../controllers/deliveryNoteController');
const DeliveryNote = require('../models/DeliveryNote');
const User = require('../models/User');
const mongoose = require('mongoose');
const { ApiError } = require('../middleware/handleError');

jest.mock('../models/DeliveryNote');
jest.mock('../models/User');

// Mock mongoose session
const sessionMock = {
  startTransaction: jest.fn(),
  commitTransaction: jest.fn(),
  abortTransaction: jest.fn(),
  endSession: jest.fn(),
};
mongoose.startSession = jest.fn().mockResolvedValue(sessionMock);

describe('DeliveryNote Controller', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  // Test for createDeliveryNote
  describe('createDeliveryNote', () => {
    it('should create delivery note successfully (201)', async () => {
      // Arrange
      const req = { user: { id: 'u1' }, body: { deliveryNoteNumber: 'DN1', date: '2025-01-01', projectId: 'p1', items: [] } };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      // Mock save and commit
      const savedNote = { _id: 'n1' };
      DeliveryNote.prototype.save = jest.fn().mockResolvedValue(savedNote);
      DeliveryNote.findById = jest.fn().mockReturnValue({
        populate: () => ({ populate: () => Promise.resolve(savedNote) })
      });
      // Act
      await deliveryNoteController.createDeliveryNote(req, res);
      // Assert
      expect(mongoose.startSession).toHaveBeenCalled();
      expect(sessionMock.startTransaction).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ message: 'Delivery note created successfully.', data: savedNote });
    });

    it('should throw 409 on duplicate key error', async () => {
      // Arrange
      const req = { user: { id: 'u1' }, body: {} };
      const res = {};
      DeliveryNote.prototype.save = jest.fn().mockRejectedValue({ code: 11000 });
      // Act & Assert
      await expect(deliveryNoteController.createDeliveryNote(req, res)).rejects.toHaveProperty('statusCode', 409);
      expect(sessionMock.abortTransaction).toHaveBeenCalled();
    });
  });

  // Test for getAllDeliveryNotes
  describe('getAllDeliveryNotes', () => {
    it('should return notes list (200)', async () => {
      // Arrange
      const req = { user: { id: 'u1' } };
      const notes = [{ id: 'n1' }];
      DeliveryNote.find = jest.fn().mockReturnValue({
        populate: () => ({ populate: () => ({ sort: () => Promise.resolve(notes) }) })
      });
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      // Act
      await deliveryNoteController.getAllDeliveryNotes(req, res);
      // Assert
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ message: 'Delivery notes retrieved successfully.', count: 1, data: expect.any(Array) });
    });
  });

  // Test for getDeliveryNoteById
  describe('getDeliveryNoteById', () => {
    it('should throw 404 if not found', async () => {
      // Arrange
      const req = { user: { id: 'u1' }, params: { id: 'n1' } };
      DeliveryNote.findOne = jest.fn().mockReturnValue({ populate: () => ({ populate: () => Promise.resolve(null) }) });
      const res = {};
      // Act & Assert
      await expect(deliveryNoteController.getDeliveryNoteById(req, res)).rejects.toHaveProperty('statusCode', 404);
    });

    it('should return note by id (200)', async () => {
      // Arrange
      const note = { toObject: () => ({ a: 1 }) };
      const req = { user: { id: 'u1' }, params: { id: 'n1' } };
      DeliveryNote.findOne = jest.fn().mockReturnValue({ populate: () => ({ populate: () => Promise.resolve(note) }) });
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      // Act
      await deliveryNoteController.getDeliveryNoteById(req, res);
      // Assert
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ message: 'Delivery note retrieved successfully.', data: expect.objectContaining({ a: 1 }) });
    });
  });

  // Test for updateDeliveryNote
  describe('updateDeliveryNote', () => {
    it('should throw 404 if note not found', async () => {
      const req = { user: { id: 'u1' }, params: { id: 'n1' }, body: {} };
      DeliveryNote.findOne = jest.fn().mockResolvedValue(null);
      // Act & Assert
      await expect(deliveryNoteController.updateDeliveryNote(req)).rejects.toHaveProperty('statusCode', 404);
    });

    it('should throw 403 if signed', async () => {
      const req = { user: { id: 'u1' }, params: { id: 'n1' }, body: {} };
      DeliveryNote.findOne = jest.fn().mockResolvedValue({ isSigned: true });
      // Act & Assert
      await expect(deliveryNoteController.updateDeliveryNote(req)).rejects.toHaveProperty('statusCode', 403);
    });

    it('should update successfully (200)', async () => {
      const req = { user: { id: 'u1' }, params: { id: 'n1' }, body: { notes: 'note' } };
      const noteMock = { isSigned: false, save: jest.fn(), toObject: () => ({ notes: 'note' }) };
      DeliveryNote.findOne = jest.fn().mockResolvedValue(noteMock);
      DeliveryNote.findById = jest.fn().mockReturnValue({ populate: () => ({ populate: () => Promise.resolve(noteMock) }) });
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      await deliveryNoteController.updateDeliveryNote(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'Delivery note updated successfully.' }));
    });
  });

  // Test for signDeliveryNote
  describe('signDeliveryNote', () => {
    it('should throw 400 if signatureUrl missing', async () => {
      const req = { user: { id: 'u1' }, params: { id: 'n1' }, body: {} };
      const res = {};
      await expect(deliveryNoteController.signDeliveryNote(req, res)).rejects.toHaveProperty('statusCode', 400);
    });

    it('should return already signed (200)', async () => {
      const req = { user: { id: 'u1' }, params: { id: 'n1' }, body: { signatureUrl: 'cid' } };
      // Session mock used
      const noteMock = { isSigned: true, toObject: () => ({ signatureUrl: 'cid', pdfUrl: null }), save: jest.fn() };
      DeliveryNote.findOne = jest.fn().mockReturnValue({ populate: () => ({ populate: () => Promise.resolve(noteMock) }), session: () => {} });
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      await deliveryNoteController.signDeliveryNote(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'Delivery note is already signed.' }));
    });
  });

  // Test for downloadDeliveryNotePdf
  describe('downloadDeliveryNotePdf', () => {
    it('should throw 404 if note not found', async () => {
      const req = { user: { id: 'u1' }, params: { id: 'n1' } };
      const res = {};
      DeliveryNote.findById = jest.fn().mockReturnValue({ populate: () => Promise.resolve(null) });
      await expect(deliveryNoteController.downloadDeliveryNotePdf(req, res)).rejects.toHaveProperty('statusCode', 404);
    });

    //
    it('should throw 403 if no permission', async () => {
      const req = { user: { id: 'u2' }, params: { id: 'n1' } };
      const note = { createdBy: { _id: 'u1', companyId: null }, isSigned: true, pdfUrl: 'cid' };
      DeliveryNote.findById = jest.fn().mockReturnValue({ populate: () => Promise.resolve(note) });
      User.findById = jest.fn().mockResolvedValue(null);
      await expect(deliveryNoteController.downloadDeliveryNotePdf(req)).rejects.toHaveProperty('statusCode', 403);
    });

    it('should redirect to IPFS URL (302)', async () => {
      const req = { user: { id: 'u1' }, params: { id: 'n1' } };
      const note = { createdBy: { _id: 'u1', companyId: null }, isSigned: true, pdfUrl: 'cid', deliveryNoteNumber: 'DN' };
      DeliveryNote.findById = jest.fn().mockReturnValue({ populate: () => Promise.resolve(note) });
      const res = { setHeader: jest.fn(), redirect: jest.fn() };
      await deliveryNoteController.downloadDeliveryNotePdf(req, res);
      expect(res.redirect).toHaveBeenCalledWith(302, expect.stringContaining('ipfs/cid'));
    });
  });

  // Test for deleteDeliveryNote
  describe('deleteDeliveryNote', () => {
    it('should throw 404 if not found', async () => {
      const req = { user: { id: 'u1' }, params: { id: 'n1' } };
      DeliveryNote.findOne = jest.fn().mockResolvedValue(null);
      await expect(deliveryNoteController.deleteDeliveryNote(req)).rejects.toHaveProperty('statusCode', 404);
    });

    it('should throw 403 if signed', async () => {
      const req = { user: { id: 'u1' }, params: { id: 'n1' } };
      DeliveryNote.findOne = jest.fn().mockResolvedValue({ isSigned: true });
      await expect(deliveryNoteController.deleteDeliveryNote(req)).rejects.toHaveProperty('statusCode', 403);
    });

    it('should delete successfully (200)', async () => {
      const req = { user: { id: 'u1' }, params: { id: 'n1' } };
      DeliveryNote.findOne = jest.fn().mockResolvedValue({ isSigned: false });
      DeliveryNote.deleteOne = jest.fn().mockResolvedValue();
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      await deliveryNoteController.deleteDeliveryNote(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ message: 'Delivery note deleted successfully.' });
    });
  });
});
