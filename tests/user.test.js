const request = require('supertest');
const app = require('../server'); // Import your Express app
const User = require('../models/User');
const authService = require('../services/authService');
const handleEmail = require('../utils/handleEmail');
// Remove express-validator mock as validation will be tested via HTTP requests
// const { validationResult } = require('express-validator');
const { ApiError } = require('../middleware/handleError');

jest.mock('../models/User');
jest.mock('../services/authService'); // Keep for functions like generateToken, hashPassword, etc.
jest.mock('../utils/handleEmail'); // Keep for sendVerificationEmail
// jest.mock('express-validator'); // Remove this mock

describe('User API Endpoints', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  // Test for registerUser
  describe('POST /api/users/register', () => {
    it('should return 400 if validation errors exist (e.g., missing email)', async () => {
      // Arrange - express-validator will handle this, no need to mock validationResult
      // Act
      const response = await request(app)
        .post('/api/users/register')
        .send({ password: 'password123' }); // Missing email
      // Assert
      expect(response.status).toBe(400);
      // expect(response.body.errors).toBeInstanceOf(Array); // Check for an errors array
      // More specific error checking can be added if needed, e.g., which field failed
    });

    it('should register a new user successfully and return 201', async () => {
      // Arrange
      const userData = { name: 'Test User', email: 'test@example.com', password: 'password123' };
      User.findOne.mockResolvedValue(null); // No existing user
      authService.generateVerificationCode.mockReturnValue('123456');
      authService.hashPassword.mockResolvedValue('hashedPassword');
      const saveMock = jest.fn().mockResolvedValue({
        _id: 'mockUserId',
        name: userData.name,
        email: userData.email,
        isEmailVerified: false,
        role: 'user',
        verificationCode: '123456'
      });
      User.prototype.save = saveMock;
      authService.generateToken.mockReturnValue('mockToken');
      handleEmail.sendVerificationEmail.mockResolvedValue();

      // Act
      const response = await request(app)
        .post('/api/users/register')
        .send(userData);

      // Assert
      expect(User.findOne).toHaveBeenCalledWith({ email: userData.email });
      expect(authService.hashPassword).toHaveBeenCalledWith(userData.password);
      expect(saveMock).toHaveBeenCalled();
      expect(handleEmail.sendVerificationEmail).toHaveBeenCalledWith(userData.email, '123456');
      expect(authService.generateToken).toHaveBeenCalledWith(expect.objectContaining({ id: 'mockUserId' }));
      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('message', 'User registered successfully. Please check your email to verify your account.');
      expect(response.body).toHaveProperty('token', 'mockToken');
      expect(response.body.user).toEqual(expect.objectContaining({
        name: userData.name,
        email: userData.email,
        isEmailVerified: false,
        role: 'user'
      }));
    });

    it('should respond 409 if email is already registered and verified', async () => {
      // Arrange
      const userData = { name: 'Test User', email: 'verified@example.com', password: 'password123' };
      User.findOne.mockResolvedValue({
        _id: 'existingUserId',
        email: userData.email,
        isEmailVerified: true
      });

      // Act
      const response = await request(app)
        .post('/api/users/register')
        .send(userData);

      // Assert
      expect(User.findOne).toHaveBeenCalledWith({ email: userData.email });
      expect(response.status).toBe(409);
      expect(response.body).toHaveProperty('message', 'Email is already registered and verified');
    });

    it('should respond 409 if email is registered but not verified, and resend verification', async () => {
      // Arrange
      const userData = { email: 'unverified@example.com', password: 'password123', name: 'Test User' };
      const mockUserInstance = {
        _id: 'existingUnverifiedUserId',
        email: userData.email,
        isEmailVerified: false,
        verificationCode: 'oldCode',
        verificationExpires: new Date(Date.now() - 100000), // Expired or different code
        save: jest.fn().mockResolvedValueThis(), // Mock save on the instance
      };
      User.findOne.mockResolvedValue(mockUserInstance);
      authService.generateVerificationCode.mockReturnValue('newCode123');
      handleEmail.sendVerificationEmail.mockResolvedValue(); // Mock email sending

      // Act
      const response = await request(app)
        .post('/api/users/register')
        .send(userData);

      // Assert
      expect(User.findOne).toHaveBeenCalledWith({ email: userData.email });
      expect(authService.generateVerificationCode).toHaveBeenCalled();
      expect(mockUserInstance.verificationCode).toBe('newCode123');
      expect(mockUserInstance.save).toHaveBeenCalled();
      expect(handleEmail.sendVerificationEmail).toHaveBeenCalledWith(userData.email, 'newCode123');
      expect(response.status).toBe(409);
      expect(response.body).toHaveProperty('message', 'Email is already registered but not verified. A new verification email has been sent.');
    });
  });

  // Test for verifyEmail
  describe('POST /api/users/verify-email', () => {
    let token;
    const mockUser = { _id: 'mockUserId', email: 'test@example.com', role: 'user' };

    beforeAll(async () => {
      // Simulate login or token generation for protected routes
      authService.generateToken.mockReturnValue('mockTokenForVerification');
      token = authService.generateToken(mockUser);
    });

    it('should return 400 for validation errors (e.g., missing code)', async () => {
      const response = await request(app)
        .post('/api/users/verify-email')
        .set('Authorization', `Bearer ${token}`)
        .send({}); // Missing code
      expect(response.status).toBe(400);
      // expect(response.body.errors).toBeInstanceOf(Array);
    });

    it('should return 401 if no token is provided', async () => {
      const response = await request(app)
        .post('/api/users/verify-email')
        .send({ code: '123456' });
      expect(response.status).toBe(401); // Or 403 depending on your auth middleware
    });

    it('should return 404 if user not found (though auth middleware should handle this)', async () => {
      // This case might be tricky if auth middleware already validated the user from token
      // If findById is called explicitly in the controller after auth:
      User.findById.mockResolvedValue(null);
      const response = await request(app)
        .post('/api/users/verify-email')
        .set('Authorization', `Bearer ${token}`) // Assume token is for a user that "disappears"
        .send({ code: '123456' });

      // If your auth middleware fetches the user and req.user is set,
      // and then controller does User.findById(req.user.id), this mock is relevant.
      // Otherwise, if req.user is trusted, this specific 404 might not be hit this way.
      // For now, assuming the controller re-fetches or auth middleware handles it.
      // If auth middleware ensures user exists, this test might always pass auth then fail differently.
      // Let's assume the controller does a User.findById(req.user.id)
      expect(User.findById).toHaveBeenCalledWith('mockUserId'); // from token
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('message', 'User not found');
    });

    it('should verify email successfully and return 200', async () => {
      const userInstance = {
        _id: 'mockUserId',
        isEmailVerified: false,
        verificationCode: '123456',
        verificationAttempts: 0,
        maxVerificationAttempts: 5,
        save: jest.fn().mockResolvedValueThis(),
      };
      User.findById.mockResolvedValue(userInstance);

      const response = await request(app)
        .post('/api/users/verify-email')
        .set('Authorization', `Bearer ${token}`)
        .send({ code: '123456' });

      expect(User.findById).toHaveBeenCalledWith('mockUserId');
      expect(userInstance.isEmailVerified).toBe(true);
      expect(userInstance.verificationCode).toBeNull();
      expect(userInstance.save).toHaveBeenCalled();
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'Email verified successfully');
      expect(response.body.user).toEqual(expect.objectContaining({ isEmailVerified: true }));
    });

    it('should return 400 if verification code is incorrect', async () => {
      const userInstance = {
        _id: 'mockUserId',
        isEmailVerified: false,
        verificationCode: 'correctCode',
        verificationAttempts: 0,
        maxVerificationAttempts: 5,
        save: jest.fn().mockResolvedValueThis(),
      };
      User.findById.mockResolvedValue(userInstance);

      const response = await request(app)
        .post('/api/users/verify-email')
        .set('Authorization', `Bearer ${token}`)
        .send({ code: 'wrongCode' });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message', 'Invalid or expired verification code.');
      expect(userInstance.verificationAttempts).toBe(1);
      expect(userInstance.save).toHaveBeenCalled();
    });

    it('should return 400 if max verification attempts exceeded', async () => {
      const userInstance = {
        _id: 'mockUserId',
        isEmailVerified: false,
        verificationCode: 'correctCode',
        verificationAttempts: 5, // Max attempts reached
        maxVerificationAttempts: 5,
        save: jest.fn().mockResolvedValueThis(),
      };
      User.findById.mockResolvedValue(userInstance);

      const response = await request(app)
        .post('/api/users/verify-email')
        .set('Authorization', `Bearer ${token}`)
        .send({ code: 'correctCode' }); // Even with correct code

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message', 'Maximum verification attempts reached. Please request a new code.');
    });

     it('should return 400 if user email is already verified', async () => {
      const userInstance = {
        _id: 'mockUserId',
        isEmailVerified: true, // Already verified
        verificationCode: null,
        save: jest.fn().mockResolvedValueThis(),
      };
      User.findById.mockResolvedValue(userInstance);

      const response = await request(app)
        .post('/api/users/verify-email')
        .set('Authorization', `Bearer ${token}`)
        .send({ code: 'anyCode' });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message', 'Email is already verified.');
    });
  });

  // Test for loginUser
  describe('POST /api/users/login', () => {
    it('should return 400 for validation errors (e.g., missing email or password)', async () => {
      const response = await request(app)
        .post('/api/users/login')
        .send({ email: 'test@example.com' }); // Missing password
      expect(response.status).toBe(400);
      // expect(response.body.errors).toBeInstanceOf(Array);
    });

    it('should return 401 if user not found', async () => {
      User.findOne.mockResolvedValue(null);
      const response = await request(app)
        .post('/api/users/login')
        .send({ email: 'nonexistent@example.com', password: 'password123' });
      expect(User.findOne).toHaveBeenCalledWith({ email: 'nonexistent@example.com' });
      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('message', 'Invalid credentials');
    });

    it('should return 400 if email not verified', async () => {
      User.findOne.mockResolvedValue({
        _id: 'unverifiedUserId',
        email: 'unverified@example.com',
        password: 'hashedPassword',
        isEmailVerified: false
      });
      authService.comparePassword.mockResolvedValue(true); // Assume password is correct

      const response = await request(app)
        .post('/api/users/login')
        .send({ email: 'unverified@example.com', password: 'password123' });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message', 'Email not verified. Please verify your email before logging in.');
    });

    it('should return 401 if password does not match', async () => {
      User.findOne.mockResolvedValue({
        _id: 'userId',
        email: 'test@example.com',
        password: 'hashedPassword',
        isEmailVerified: true,
      });
      authService.comparePassword.mockResolvedValue(false); // Password mismatch

      const response = await request(app)
        .post('/api/users/login')
        .send({ email: 'test@example.com', password: 'wrongPassword' });

      expect(authService.comparePassword).toHaveBeenCalledWith('wrongPassword', 'hashedPassword');
      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('message', 'Invalid credentials');
    });

    it('should login successfully and return 200 with token and user data', async () => {
      const mockUser = {
        _id: 'loggedInUserId',
        name: 'Logged In User',
        email: 'login@example.com',
        password: 'correctHashedPassword',
        isEmailVerified: true,
        role: 'user',
        // Add other fields that your toJSON or transform method might exclude or include
        toJSON: function() { // Simulate Mongoose toJSON if you use it
          return { _id: this._id, name: this.name, email: this.email, role: this.role, isEmailVerified: this.isEmailVerified };
        }
      };
      User.findOne.mockResolvedValue(mockUser);
      authService.comparePassword.mockResolvedValue(true);
      authService.generateToken.mockReturnValue('mockLoginToken');

      const response = await request(app)
        .post('/api/users/login')
        .send({ email: 'login@example.com', password: 'correctPassword' });

      expect(User.findOne).toHaveBeenCalledWith({ email: 'login@example.com' });
      expect(authService.comparePassword).toHaveBeenCalledWith('correctPassword', 'correctHashedPassword');
      expect(authService.generateToken).toHaveBeenCalledWith(expect.objectContaining({ id: 'loggedInUserId' }));
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('token', 'mockLoginToken');
      expect(response.body.user).toEqual({
        _id: 'loggedInUserId',
        name: 'Logged In User',
        email: 'login@example.com',
        isEmailVerified: true,
        role: 'user'
      });
    });
  });

  // Test for getCurrentUser
  describe('GET /api/users/me', () => {
    let token;
    const mockUserPayload = { _id: 'currentUserId', email: 'current@example.com', role: 'user' };

    beforeAll(() => {
      authService.generateToken.mockImplementation((payload) => `mockTokenFor-${payload._id}`);
      token = authService.generateToken(mockUserPayload);
    });

    it('should return 401 if no token is provided', async () => {
      const response = await request(app).get('/api/users/me');
      expect(response.status).toBe(401);
    });

    it('should return 404 if user from token not found in DB', async () => {
      // User.findById.mockResolvedValue(null); // This is correct
      // To ensure the select method is also chainable if used:
      User.findById.mockReturnValue({
        select: jest.fn().mockResolvedValue(null)
      });


      const response = await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${token}`);

      expect(User.findById).toHaveBeenCalledWith('currentUserId');
      expect(User.findById().select).toHaveBeenCalledWith('-password -verificationCode -resetPasswordToken -resetPasswordExpires -verificationExpires -verificationAttempts');
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('message', 'User not found');
    });

    it('should return current user data (200)', async () => {
      const dbUser = {
        _id: 'currentUserId',
        name: 'Current User',
        email: 'current@example.com',
        isEmailVerified: true,
        role: 'user'
        // No password or sensitive fields
      };
      // User.findById.mockResolvedValue(dbUser); // If no .select() is used or it's part of the mock
      User.findById.mockReturnValue({
        select: jest.fn().mockResolvedValue(dbUser)
      });


      const response = await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${token}`);

      expect(User.findById).toHaveBeenCalledWith('currentUserId');
      expect(User.findById().select).toHaveBeenCalledWith('-password -verificationCode -resetPasswordToken -resetPasswordExpires -verificationExpires -verificationAttempts');
      expect(response.status).toBe(200);
      expect(response.body).toEqual(dbUser);
    });
  });

  // Test for updatePersonalData
  describe('PUT /api/users/me/personal-data', () => {
    let token;
    const mockUserId = 'updateUserId';
    const userPayloadForToken = { _id: mockUserId, email: 'update@example.com', role: 'user' };

    beforeAll(() => {
      authService.generateToken.mockImplementation((payload) => `mockTokenFor-${payload._id}`);
      token = authService.generateToken(userPayloadForToken);
    });

    it('should return 401 if no token is provided', async () => {
      const response = await request(app)
        .put('/api/users/me/personal-data')
        .send({ name: 'New Name' });
      expect(response.status).toBe(401);
    });

    it('should return 400 for validation errors (e.g., invalid data)', async () => {
      // Example: sending an empty name if name is required and has min length
      const response = await request(app)
        .put('/api/users/me/personal-data')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: '' }); // Assuming name validation fails for empty string
      expect(response.status).toBe(400);
      // expect(response.body.errors).toBeInstanceOf(Array);
    });

    it('should return 404 if user not found', async () => {
      User.findById.mockResolvedValue(null);
      const response = await request(app)
        .put('/api/users/me/personal-data')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Updated Name' });
      expect(User.findById).toHaveBeenCalledWith(mockUserId);
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('message', 'User not found');
    });

    it('should update personal data successfully and return 200', async () => {
      const initialUser = {
        _id: mockUserId,
        name: 'Old Name',
        email: 'update@example.com',
        // other fields...
        save: jest.fn().mockResolvedValueThis(), // Mock save on the instance
        toJSON: function() { // Simulate Mongoose toJSON
          return { _id: this._id, name: this.name, email: this.email };
        }
      };
      User.findById.mockResolvedValue(initialUser);
      const updateData = { name: 'New Updated Name', phone: '1234567890' };

      const response = await request(app)
        .put('/api/users/me/personal-data')
        .set('Authorization', `Bearer ${token}`)
        .send(updateData);

      expect(User.findById).toHaveBeenCalledWith(mockUserId);
      expect(initialUser.name).toBe(updateData.name);
      expect(initialUser.phone).toBe(updateData.phone); // Assuming phone is a valid field to update
      expect(initialUser.save).toHaveBeenCalled();
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'Personal data updated successfully');
      expect(response.body.user).toEqual(expect.objectContaining({
        name: updateData.name,
        // email: initialUser.email, // Email shouldn't change here
        // phone: updateData.phone // if phone is returned
      }));
    });
  });
});
