// File: tests/user.test.js
const request = require('supertest');
const app = require('../server'); // Importa la app de Express

// Mock the entire User module
jest.mock('../models/User');
const User = require('../models/User'); // Importa el modelo User real

const authService = require('../services/authService');
const handleEmail = require('../utils/handleEmail');

// Mocks para servicios externos para que los tests se centren en la lógica de la API
jest.mock('../utils/handleEmail', () => ({
   sendVerificationEmail: jest.fn(() => Promise.resolve()),
   sendResetPasswordEmail: jest.fn(() => Promise.resolve()),
   sendInvitationEmail: jest.fn(() => Promise.resolve()),
}));

jest.mock('../services/authService', () => ({
   generateToken: jest.fn(),
   hashPassword: jest.fn(),
   comparePassword: jest.fn(),
   generateVerificationCode: jest.fn(),
}));

describe('User API Endpoints', () => {
  // Limpiar la colección de usuarios antes de cada test para asegurar independencia
  beforeEach(async () => {
    // Resetear mocks de jest.fn() para que cada test tenga mocks limpios
    jest.clearAllMocks();

    // Mocks comunes para authService si son necesarios globalmente
    authService.hashPassword.mockResolvedValue('hashedPasswordForTests');
    authService.generateVerificationCode.mockReturnValue('123456');
    authService.comparePassword.mockResolvedValue(true);
    authService.generateToken.mockImplementation((payload) => `mockTokenFor-${payload.id || payload._id}`);

    // Mock Mongoose model methods
    // Default mock for findOne to return null (no user found)
    User.findOne.mockResolvedValue(null);
    User.findById.mockResolvedValue(null);
    User.create.mockImplementation(async (data) => {
      // Simulate saving a new user
      const newUser = { ...data, _id: new mongoose.Types.ObjectId() };
      User.findOne.mockResolvedValue(newUser); // After creation, findOne should find it
      return newUser;
    });
    User.deleteOne.mockResolvedValue({ deletedCount: 1 });
    User.countDocuments.mockResolvedValue(0);

    // This mock allows chaining .save() after a User instance
    User.prototype.save = jest.fn().mockResolvedValue(this);
  });

  // -- Test para registerUser --
  describe('POST /api/user/register', () => {
    it('should return 400 if validation errors exist (e.g., missing email or passwordConfirm)', async () => {
      const response = await request(app)
        .post('/api/user/register')
        .send({ name: 'Test', surname: 'User', email: 'invalid@example.com', password: 'Password123' });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('type', 'VALIDATION_ERROR');
      expect(response.body.data.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ msg: 'Password confirmation is required.' })
        ])
      );
    });

    it('should register a new user successfully and return 201', async () => {
      const userData = { name: 'Test', surname: 'User', email: 'test@example.com', password: 'Password123', passwordConfirm: 'Password123' };
      // Mock User.findOne to return null initially for a new registration
      User.findOne.mockResolvedValueOnce(null);
      // Mock User.create to return a new user instance
      User.create.mockImplementationOnce((data) => ({
        ...data,
        _id: new mongoose.Types.ObjectId(),
        isEmailVerified: false,
        verificationCode: '123456',
        save: jest.fn().mockResolvedValue(true) // Mock save method for the created user
      }));

      const res = await request(app)
        .post('/api/user/register')
        .send(userData);

      expect(res.statusCode).toEqual(201);
      expect(res.body).toHaveProperty('message', 'User registered successfully. Verification email sent.');
      expect(res.body).toHaveProperty('user');
      expect(res.body.user).toHaveProperty('email', 'test@example.com');
      expect(res.body.user).not.toHaveProperty('password');
      expect(authService.hashPassword).toHaveBeenCalledWith('Password123');
      expect(authService.generateVerificationCode).toHaveBeenCalled();
      expect(handleEmail.sendVerificationEmail).toHaveBeenCalledWith('test@example.com', '123456');
    });

    it('should return 409 if email already exists and is verified', async () => {
      const existingVerifiedUser = {
        _id: new mongoose.Types.ObjectId(),
        email: 'existing@example.com',
        password: 'HashedPasswordActual',
        isEmailVerified: true
      };
      User.findOne.mockResolvedValueOnce(existingVerifiedUser);

      const res = await request(app)
        .post('/api/user/register')
        .send({ name: 'Existing', surname: 'User', email: 'existing@example.com', password: 'Password123', passwordConfirm: 'Password123' });

      expect(res.statusCode).toEqual(409);
      expect(res.body).toHaveProperty('message', 'Email is already registered and verified');
      expect(handleEmail.sendVerificationEmail).not.toHaveBeenCalled();
    });

    it('should overwrite user if email exists but is not verified, and return 201', async () => {
      const unverifiedUser = {
        _id: new mongoose.Types.ObjectId(),
        email: 'unverified@example.com',
        password: 'HashedPasswordOld',
        isEmailVerified: false
      };
      User.findOne.mockResolvedValueOnce(unverifiedUser);
      User.deleteOne.mockResolvedValueOnce({ deletedCount: 1 });
      User.create.mockImplementationOnce((data) => ({
        ...data,
        _id: new mongoose.Types.ObjectId(),
        isEmailVerified: false,
        verificationCode: '123456',
        save: jest.fn().mockResolvedValue(true)
      }));

      const res = await request(app)
        .post('/api/user/register')
        .send({ name: 'New', surname: 'User', email: 'unverified@example.com', password: 'PasswordNew', passwordConfirm: 'PasswordNew' });

      expect(res.statusCode).toEqual(201);
      expect(res.body).toHaveProperty('message', 'User registered successfully. Verification email sent.');
      expect(User.deleteOne).toHaveBeenCalledWith({ _id: unverifiedUser._id });
      expect(handleEmail.sendVerificationEmail).toHaveBeenCalled();
    });
  });

  // -- Test para validateUser (Email Verification) --
  describe('POST /api/user/validation', () => {
    let testUser, token;
    const testCode = '123456';

    beforeEach(async () => {
      testUser = {
        _id: new mongoose.Types.ObjectId(),
        email: 'verify@example.com',
        password: 'hashedPasswordForTests',
        isEmailVerified: false,
        verificationCode: testCode,
        verificationAttempts: 0,
        maxVerificationAttempts: 3,
        save: jest.fn().mockResolvedValue(true)
      };
      // Mock User.findById to return our testUser for these tests
      User.findById.mockResolvedValue(testUser);
      authService.generateToken.mockReturnValue(`mockTokenFor-${testUser._id.toString()}`);
      token = authService.generateToken({ id: testUser._id.toString() });
    });

    it('should return 400 for validation errors (e.g., missing code)', async () => {
      const response = await request(app)
        .post('/api/user/validation')
        .set('Authorization', `Bearer ${token}`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('type', 'VALIDATION_ERROR');
      expect(response.body.data.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ msg: 'Verification code is required.' })
        ])
      );
    });

    it('should return 401 if no token is provided', async () => {
      const response = await request(app)
        .post('/api/user/validation')
        .send({ code: testCode });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('message', 'No token, authorization denied');
    });

    it('should return 404 if user from token not found in DB', async () => {
      User.findById.mockResolvedValueOnce(null); // Explicitly mock for this test

      const response = await request(app)
        .post('/api/user/validation')
        .set('Authorization', `Bearer ${token}`)
        .send({ code: testCode });

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('message', 'User not found');
    });

    it('should verify email successfully and return 200', async () => {
      const response = await request(app)
        .post('/api/user/validation')
        .set('Authorization', `Bearer ${token}`)
        .send({ code: testCode });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'Email verified successfully');
      expect(testUser.isEmailVerified).toBe(true);
      expect(testUser.verificationCode).toBeNull();
      expect(testUser.verificationAttempts).toBe(0);
      expect(testUser.save).toHaveBeenCalled();
    });

    it('should return 400 if verification code is incorrect', async () => {
      const response = await request(app)
        .post('/api/user/validation')
        .set('Authorization', `Bearer ${token}`)
        .send({ code: 'wrongCode' });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message', 'Incorrect verification code');
      expect(testUser.verificationAttempts).toBe(1);
      expect(testUser.isEmailVerified).toBe(false);
      expect(testUser.save).toHaveBeenCalled();
    });

    it('should return 400 if max verification attempts exceeded', async () => {
      testUser.verificationAttempts = testUser.maxVerificationAttempts; // Set to max attempts

      const response = await request(app)
        .post('/api/user/validation')
        .set('Authorization', `Bearer ${token}`)
        .send({ code: 'wrongCode' });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message', 'Maximum verification attempts reached. Please request a new code.');
      expect(testUser.isEmailVerified).toBe(false);
      expect(testUser.save).not.toHaveBeenCalled(); // Should not save if max attempts reached and no new code is requested
    });

    it('should return 400 if user email is already verified', async () => {
      testUser.isEmailVerified = true; // Set user as already verified

      const response = await request(app)
        .post('/api/user/validation')
        .set('Authorization', `Bearer ${token}`)
        .send({ code: 'anyCode' });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message', 'Email is already verified.');
      expect(testUser.save).not.toHaveBeenCalled();
    });
  });

  // -- Test para loginUser --
  describe('POST /api/user/login', () => {
    let testUser, hashedPassword;

    beforeEach(async () => {
      hashedPassword = 'hashedPasswordForLogin';
      testUser = {
        _id: new mongoose.Types.ObjectId(),
        email: 'login@example.com',
        password: hashedPassword,
        isEmailVerified: true,
        role: 'user',
        save: jest.fn().mockResolvedValue(true)
      };
      User.findOne.mockResolvedValue(testUser);
      authService.hashPassword.mockResolvedValue(hashedPassword);
      authService.comparePassword.mockResolvedValue(true);
      authService.generateToken.mockImplementation((payload) => `mockTokenFor-${payload.id || payload._id}`);
    });

    it('should return 400 for validation errors (e.g., missing email or password)', async () => {
      const response = await request(app)
        .post('/api/user/login')
        .send({ email: 'login@example.com' }); // Missing password

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('type', 'VALIDATION_ERROR');
      expect(response.body.data.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ msg: 'Password is required.' })
        ])
      );
    });

    it('should return 401 if user not found', async () => {
      User.findOne.mockResolvedValueOnce(null); // Mock user not found

      const response = await request(app)
        .post('/api/user/login')
        .send({ email: 'nonexistent@example.com', password: 'password123' });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('message', 'Invalid credentials');
    });

    it('should return 400 if email not verified', async () => {
      testUser.isEmailVerified = false;
      User.findOne.mockResolvedValueOnce(testUser);

      const response = await request(app)
        .post('/api/user/login')
        .send({ email: 'login@example.com', password: 'correctPassword' });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message', 'Email not verified. Please verify your email to log in.');
    });

    it('should return 401 if password does not match', async () => {
      authService.comparePassword.mockResolvedValueOnce(false); // Incorrect password

      const response = await request(app)
        .post('/api/user/login')
        .send({ email: 'login@example.com', password: 'wrongPassword' });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('message', 'Invalid credentials');
    });

    it('should login successfully and return 200 with token and user data', async () => {
      const response = await request(app)
        .post('/api/user/login')
        .send({ email: 'login@example.com', password: 'correctPassword' });

      expect(authService.comparePassword).toHaveBeenCalledWith('correctPassword', hashedPassword);
      expect(authService.generateToken).toHaveBeenCalledWith(expect.objectContaining({ id: testUser._id.toString() }));
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('token', `mockTokenFor-${testUser._id.toString()}`);
      expect(response.body.user).toEqual(expect.objectContaining({
        email: testUser.email,
        role: testUser.role,
        id: testUser._id.toString(), // Ensure the ID is part of the returned user object
      }));
      expect(response.body.user).not.toHaveProperty('password');
    });
  });

  // -- Test para getCurrentUser --
  describe('GET /api/user', () => {
    let testUser, token;

    beforeEach(async () => {
      testUser = {
        _id: new mongoose.Types.ObjectId(),
        email: 'current@example.com',
        firstName: 'Current',
        lastName: 'User',
        isEmailVerified: true,
        save: jest.fn().mockResolvedValue(true)
      };
      User.findById.mockResolvedValue(testUser);
      authService.generateToken.mockReturnValue(`mockTokenFor-${testUser._id.toString()}`);
      token = authService.generateToken({ id: testUser._id.toString() });
    });

    it('should return 401 if no token is provided', async () => {
      const response = await request(app).get('/api/user');
      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('message', 'No token, authorization denied');
    });

    it('should return 404 if user from token not found in DB', async () => {
      User.findById.mockResolvedValueOnce(null);

      const response = await request(app)
        .get('/api/user')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('message', 'User not found');
    });

    it('should return current user data (200)', async () => {
      const response = await request(app)
        .get('/api/user')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual(expect.objectContaining({
        _id: testUser._id.toString(),
        email: testUser.email,
        firstName: testUser.firstName,
        lastName: testUser.lastName,
      }));
      expect(response.body).not.toHaveProperty('password');
    });
  });

  // -- Test para updatePersonalData --
  describe('PUT /api/user', () => {
    let testUser, token;

    beforeEach(async () => {
      testUser = {
        _id: new mongoose.Types.ObjectId(),
        email: 'update@example.com',
        firstName: 'Original',
        lastName: 'User',
        save: jest.fn().mockResolvedValue(true) // Mock save for update operation
      };
      User.findById.mockResolvedValue(testUser);
      authService.generateToken.mockReturnValue(`mockTokenFor-${testUser._id.toString()}`);
      token = authService.generateToken({ id: testUser._id.toString() });
    });

    it('should return 401 if no token is provided', async () => {
      const response = await request(app)
        .put('/api/user')
        .send({ firstName: 'New Name' });
      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('message', 'No token, authorization denied');
    });

    it('should return 400 for validation errors (e.g., invalid data)', async () => {
      const response = await request(app)
        .put('/api/user')
        .set('Authorization', `Bearer ${token}`)
        .send({ firstName: '' }); // Invalid empty name

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('type', 'VALIDATION_ERROR');
      expect(response.body.data.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ msg: 'First name cannot be empty.' })
        ])
      );
    });

    it('should return 404 if user not found', async () => {
      User.findById.mockResolvedValueOnce(null); // User not found for update

      const response = await request(app)
        .put('/api/user')
        .set('Authorization', `Bearer ${token}`)
        .send({ firstName: 'Updated Name' });

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('message', 'User not found');
    });

    it('should update personal data successfully and return 200', async () => {
      const updateData = { firstName: 'New Updated Name', lastName: 'New Surname' };

      const response = await request(app)
        .put('/api/user')
        .set('Authorization', `Bearer ${token}`)
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'Personal data updated successfully');
      expect(testUser.firstName).toBe(updateData.firstName); // Check if mock user was updated
      expect(testUser.lastName).toBe(updateData.lastName);
      expect(testUser.save).toHaveBeenCalled(); // Ensure save was called on the mock user
      expect(response.body.user).toEqual(expect.objectContaining({
        firstName: updateData.firstName,
        lastName: updateData.lastName,
      }));
    });
  });
});

// Helper to create a mongoose ObjectId for mocking
const mongoose = require('mongoose');
