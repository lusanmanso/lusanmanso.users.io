// File: tests/user.test.js
const request = require('supertest');
const app = require('../server'); // Importa la app de Express
const mongoose = require('mongoose'); // Todavía necesitas mongoose para interactuar con la DB
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
  // ELIMINADO: beforeAll para mongoose.connect
  // ELIMINADO: afterAll para mongoose.connection.close()

  // Limpiar la colección de usuarios antes de cada test para asegurar independencia
  beforeEach(async () => {
    await User.deleteMany({});
    // Resetear mocks de jest.fn() para que cada test tenga mocks limpios
    jest.clearAllMocks();
    // Mocks comunes para authService si son necesarios globalmente
    authService.hashPassword.mockResolvedValue('hashedPasswordForTests');
    authService.generateVerificationCode.mockReturnValue('123456');
    authService.comparePassword.mockResolvedValue(true);
    authService.generateToken.mockImplementation((payload) => `mockTokenFor-${payload.id || payload._id}`);
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

      const userInDb = await User.findOne({ email: 'test@example.com' });
      expect(userInDb).not.toBeNull();
      expect(userInDb.isEmailVerified).toBe(false);
      expect(userInDb.verificationCode).toBe('123456');
    });

    it('should return 409 if email already exists and is verified', async () => {
      await User.create({
        name: 'Existing',
        surname: 'User',
        email: 'existing@example.com',
        password: 'HashedPasswordActual',
        isEmailVerified: true,
        verificationCode: '789012'
      });

      const res = await request(app)
        .post('/api/user/register')
        .send({
          name: 'New',
          surname: 'Person',
          email: 'existing@example.com',
          password: 'NewPassword123',
          passwordConfirm: 'NewPassword123'
        });

      expect(res.statusCode).toEqual(409);
      expect(res.body).toHaveProperty('message', 'Email is already registered and verified');
      expect(handleEmail.sendVerificationEmail).not.toHaveBeenCalled();
    });

    it('should overwrite user if email exists but is not verified, and return 201', async () => {
      const oldUser = await User.create({
        name: 'Old',
        surname: 'User',
        email: 'unverified@example.com',
        password: 'OldHashedPassword',
        isEmailVerified: false,
        verificationCode: 'oldCode123',
        verificationAttempts: 0,
        maxVerificationAttempts: 3
      });

      const res = await request(app)
        .post('/api/user/register')
        .send({
          name: 'New',
          surname: 'User',
          email: 'unverified@example.com',
          password: 'NewPassword123',
          passwordConfirm: 'NewPassword123'
        });

      expect(res.statusCode).toEqual(201);
      expect(res.body).toHaveProperty('message', 'User registered successfully. Verification email sent.');

      const newCount = await User.countDocuments({ email: 'unverified@example.com' });
      expect(newCount).toBe(1);
      const updatedUser = await User.findOne({ email: 'unverified@example.com' });

      expect(updatedUser.name).toBe('New');
      expect(updatedUser.isEmailVerified).toBe(false);
      expect(updatedUser.verificationCode).toBe('123456');
      expect(updatedUser._id.toString()).not.toBe(oldUser._id.toString());
      expect(handleEmail.sendVerificationEmail).toHaveBeenCalledWith('unverified@example.com', '123456');
    });
  });

  // Test para verifyEmail
  describe('POST /api/user/validation', () => {
    let token;
    let mockUserInstance;
    const testEmail = 'verify@example.com';
    const testCode = '123456';

    beforeEach(async () => {
      jest.clearAllMocks(); // Clear mocks again for this suite's beforeEach
      authService.hashPassword.mockResolvedValue('hashedPasswordForTests');
      authService.generateVerificationCode.mockReturnValue('123456');
      authService.comparePassword.mockResolvedValue(true);
      authService.generateToken.mockImplementation((payload) => `mockTokenFor-${payload.id || payload._id}`);

      mockUserInstance = await User.create({
        name: 'Verify User',
        surname: 'Test',
        email: testEmail,
        password: 'hashedPassword',
        isEmailVerified: false,
        verificationCode: testCode,
        verificationExpires: new Date(Date.now() + 3600000),
        verificationAttempts: 0,
        maxVerificationAttempts: 5,
      });

      token = authService.generateToken({ id: mockUserInstance._id.toString(), email: mockUserInstance.email, role: 'user' });
    });

    it('should return 400 for validation errors (e.g., missing code)', async () => {
      const response = await request(app)
        .post('/api/user/validation')
        .set('Authorization', `Bearer ${token}`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('success', false);
      expect(response.body.data.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ msg: 'Verification code cannot be empty.' })
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
      User.findById.mockResolvedValueOnce(null);

      const response = await request(app)
        .post('/api/user/validation')
        .set('Authorization', `Bearer ${token}`)
        .send({ code: testCode });

      expect(User.findById).toHaveBeenCalledWith(mockUserInstance._id.toString());
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('message', 'User not found');
    });

    it('should verify email successfully and return 200', async () => {
      const response = await request(app)
        .post('/api/user/validation')
        .set('Authorization', `Bearer ${token}`)
        .send({ code: testCode });

      const updatedUser = await User.findById(mockUserInstance._id);
      expect(updatedUser.isEmailVerified).toBe(true);
      expect(updatedUser.verificationCode).toBeNull();
      expect(updatedUser.verificationAttempts).toBe(0);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'Email verified successfully');
      expect(response.body.user).toHaveProperty('isEmailVerified', true);
      expect(response.body.user).toHaveProperty('_id', mockUserInstance._id.toString());
    });

    it('should return 400 if verification code is incorrect', async () => {
      const response = await request(app)
        .post('/api/user/validation')
        .set('Authorization', `Bearer ${token}`)
        .send({ code: 'wrongCode' });

      const updatedUser = await User.findById(mockUserInstance._id);
      expect(updatedUser.verificationAttempts).toBe(1);
      expect(updatedUser.isEmailVerified).toBe(false);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message', 'Invalid or expired verification code.');
    });

    it('should return 400 if max verification attempts exceeded', async () => {
      await User.findByIdAndUpdate(mockUserInstance._id, { verificationAttempts: mockUserInstance.maxVerificationAttempts });

      const response = await request(app)
        .post('/api/user/validation')
        .set('Authorization', `Bearer ${token}`)
        .send({ code: testCode });

      const updatedUser = await User.findById(mockUserInstance._id);
      expect(updatedUser.verificationAttempts).toBe(mockUserInstance.maxVerificationAttempts);
      expect(updatedUser.isEmailVerified).toBe(false);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message', 'Maximum verification attempts reached. Please request a new code.');
    });

     it('should return 400 if user email is already verified', async () => {
      await User.findByIdAndUpdate(mockUserInstance._id, { isEmailVerified: true });

      const response = await request(app)
        .post('/api/user/validation')
        .set('Authorization', `Bearer ${token}`)
        .send({ code: 'anyCode' });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message', 'Email is already verified.');
    });
  });

  // Test para loginUser
  describe('POST /api/user/login', () => {
    let hashedPassword;
    let verifiedUser;

    beforeEach(async () => {
        await User.deleteMany({});

        authService.hashPassword.mockResolvedValue('hashedPassword123');
        hashedPassword = await authService.hashPassword('correctPassword');
        verifiedUser = await User.create({
            name: 'Login User',
            surname: 'Test',
            email: 'login@example.com',
            password: hashedPassword,
            isEmailVerified: true,
            role: 'user',
        });
        authService.comparePassword.mockResolvedValue(true);
        authService.generateToken.mockImplementation((payload) => `mockTokenFor-${payload.id || payload._id}`);
    });

    it('should return 400 for validation errors (e.g., missing email or password)', async () => {
      const response = await request(app)
        .post('/api/user/login')
        .send({ email: 'test@example.com' });
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('success', false);
      expect(response.body.data.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ msg: 'Password cannot be empty.' })
        ])
      );
    });

    it('should return 401 if user not found', async () => {
      const response = await request(app)
        .post('/api/user/login')
        .send({ email: 'nonexistent@example.com', password: 'password123' });
      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('message', 'Invalid credentials');
    });

    it('should return 400 if email not verified', async () => {
      const unverifiedUser = await User.create({
          name: 'Unverified User',
          surname: 'Test',
          email: 'unverified@example.com',
          password: hashedPassword,
          isEmailVerified: false,
          role: 'user',
      });

      const response = await request(app)
        .post('/api/user/login')
        .send({ email: 'unverified@example.com', password: 'correctPassword' });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message', 'Email not verified. Please verify your email before logging in.');
    });

    it('should return 401 if password does not match', async () => {
      authService.comparePassword.mockResolvedValueOnce(false);

      const response = await request(app)
        .post('/api/user/login')
        .send({ email: 'login@example.com', password: 'wrongPassword' });

      expect(authService.comparePassword).toHaveBeenCalledWith('wrongPassword', hashedPassword);
      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('message', 'Invalid credentials');
    });

    it('should login successfully and return 200 with token and user data', async () => {
      const response = await request(app)
        .post('/api/user/login')
        .send({ email: 'login@example.com', password: 'correctPassword' });

      expect(authService.comparePassword).toHaveBeenCalledWith('correctPassword', hashedPassword);
      expect(authService.generateToken).toHaveBeenCalledWith(expect.objectContaining({ id: verifiedUser._id.toString() }));
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('token', `mockTokenFor-${verifiedUser._id.toString()}`);
      expect(response.body.user).toEqual(expect.objectContaining({
        _id: verifiedUser._id.toString(),
        name: 'Login User',
        email: 'login@example.com',
        isEmailVerified: true,
        role: 'user'
      }));
    });
  });

  // Test para getCurrentUser (GET /api/user)
  describe('GET /api/user', () => {
    let token;
    let testUser;

    beforeEach(async () => {
        await User.deleteMany({});
        testUser = await User.create({
            name: 'Current User',
            surname: 'Test',
            email: 'current@example.com',
            password: 'hashedPasswordForTests',
            isEmailVerified: true,
            role: 'user',
        });
        token = authService.generateToken({ id: testUser._id.toString(), email: testUser.email, role: testUser.role });
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

      expect(User.findById).toHaveBeenCalledWith(testUser._id.toString());
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
        name: testUser.name,
        email: testUser.email,
        isEmailVerified: testUser.isEmailVerified,
        role: testUser.role
      }));
      expect(response.body).not.toHaveProperty('password');
    });
  });

  // Test para updatePersonalData (PUT /api/user)
  describe('PUT /api/user', () => {
    let token;
    let testUser;

    beforeEach(async () => {
        await User.deleteMany({});
        testUser = await User.create({
            name: 'Old Name',
            surname: 'Old Surname',
            email: 'update@example.com',
            password: 'hashedPasswordForTests',
            isEmailVerified: true,
            role: 'user',
            phone: '123456789'
        });
        token = authService.generateToken({ id: testUser._id.toString(), email: testUser.email, role: testUser.role });
    });

    it('should return 401 if no token is provided', async () => {
      const response = await request(app)
        .put('/api/user')
        .send({ name: 'New Name' });
      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('message', 'No token, authorization denied');
    });

    it('should return 400 for validation errors (e.g., invalid data)', async () => {
      const response = await request(app)
        .put('/api/user')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: '' });
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('success', false);
      expect(response.body.data.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ msg: 'name cannot be empty.' })
        ])
      );
    });

    it('should return 404 if user not found', async () => {
      User.findById.mockResolvedValueOnce(null);
      const response = await request(app)
        .put('/api/user')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Updated Name' });

      expect(User.findById).toHaveBeenCalledWith(testUser._id.toString());
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('message', 'User not found');
    });

    it('should update personal data successfully and return 200', async () => {
      const updateData = { name: 'New Updated Name', phone: '987654321', surname: 'New Surname' };

      const response = await request(app)
        .put('/api/user')
        .set('Authorization', `Bearer ${token}`)
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'Personal data updated successfully');

      const updatedUserInDb = await User.findById(testUser._id);
      expect(updatedUserInDb.name).toBe(updateData.name);
      expect(updatedUserInDb.phone).toBe(updateData.phone);
      expect(updatedUserInDb.surname).toBe(updateData.surname);

      expect(response.body.user).toEqual(expect.objectContaining({
        _id: testUser._id.toString(),
        name: updateData.name,
        email: testUser.email,
        phone: updateData.phone,
        surname: updateData.surname
      }));
    });
  });
});
