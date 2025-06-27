// File: tests/user.test.js
const request = require('supertest');
const app = require('../server'); // Import the Express app
const mongoose = require('mongoose');
const User = require('../models/User');
const authService = require('../services/authService');
const handleEmail = require('../utils/handleEmail');

// Import config for the test DB URL
const config = require('../config/config');

// Mocks for external services so tests focus on API logic
// DON'T MOCK MONGOOSE MODELS
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
  // Connect to test database before all tests
  beforeAll(async () => {
    const mongoURI_test = process.env.MONGODB_URI_TEST || 'mongodb://localhost:27017/test_db_your_app';
    await mongoose.connect(mongoURI_test, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
  });

  // Clean user collection before each test to ensure independence
  beforeEach(async () => {
    await User.deleteMany({});
    // Reset jest.fn() mocks so each test has clean mocks
    jest.clearAllMocks();
    // Common mocks for authService if needed globally
    authService.hashPassword.mockResolvedValue('hashedPasswordForTests');
    authService.generateVerificationCode.mockReturnValue('123456');
    authService.comparePassword.mockResolvedValue(true);
    authService.generateToken.mockImplementation((payload) => `mockTokenFor-${payload.id || payload._id}`);
  });

  // Close database connection after all tests
  afterAll(async () => {
    await mongoose.connection.close();
  });

  // -- Test for registerUser --
  describe('POST /api/user/register', () => {
    it('should return 400 if validation errors exist (e.g., missing email or passwordConfirm)', async () => {
      // Act
      const response = await request(app)
        .post('/api/user/register')
        .send({ name: 'Test', surname: 'User', email: 'invalid@example.com', password: 'Password123' });

      // Assert
      expect(response.status).toBe(400); // This should be 400 because of the validator
      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('type', 'VALIDATION_ERROR');
      expect(response.body.data.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ msg: 'Password confirmation is required.' })
        ])
      );
    });

    it('should register a new user successfully and return 201', async () => {
      // Arrange
      const userData = { name: 'Test', surname: 'User', email: 'test@example.com', password: 'Password123', passwordConfirm: 'Password123' };

      // Act
      const res = await request(app)
        .post('/api/user/register')
        .send(userData);

      // Assert
      expect(res.statusCode).toEqual(201);
      expect(res.body).toHaveProperty('message', 'User registered successfully. Verification email sent.');
      expect(res.body).toHaveProperty('user');
      expect(res.body.user).toHaveProperty('email', 'test@example.com');
      expect(res.body.user).not.toHaveProperty('password'); // Password should not be returned

      // Verify that mocked services were called
      expect(authService.hashPassword).toHaveBeenCalledWith('Password123');
      expect(authService.generateVerificationCode).toHaveBeenCalled();
      expect(handleEmail.sendVerificationEmail).toHaveBeenCalledWith('test@example.com', '123456');

      // Verify that user was saved in real DB
      const userInDb = await User.findOne({ email: 'test@example.com' });
      expect(userInDb).not.toBeNull();
      expect(userInDb.isEmailVerified).toBe(false);
      expect(userInDb.verificationCode).toBe('123456');
    });

    it('should return 409 if email already exists and is verified', async () => {
      // Arrange: Create a real user already verified in test DB
      await User.create({
        name: 'Existing',
        surname: 'User',
        email: 'existing@example.com',
        password: 'HashedPasswordActual', // Real hashed password
        isEmailVerified: true,
        verificationCode: '789012'
      });

      // Act
      const res = await request(app)
        .post('/api/user/register')
        .send({
          name: 'New',
          surname: 'Person',
          email: 'existing@example.com',
          password: 'NewPassword123',
          passwordConfirm: 'NewPassword123'
        });

      // Assert
      expect(res.statusCode).toEqual(409);
      expect(res.body).toHaveProperty('message', 'Email is already registered and verified');
      // Verify that email was NOT attempted to be sent
      expect(handleEmail.sendVerificationEmail).not.toHaveBeenCalled();
    });

    it('should overwrite user if email exists but is not verified, and return 201', async () => {
      // Arrange: Create a real existing user but NOT verified
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

      // Act
      const res = await request(app)
        .post('/api/user/register')
        .send({
          name: 'New',
          surname: 'User',
          email: 'unverified@example.com',
          password: 'NewPassword123',
          passwordConfirm: 'NewPassword123'
        });

      // Assert
      expect(res.statusCode).toEqual(201);
      expect(res.body).toHaveProperty('message', 'User registered successfully. Verification email sent.');

      // Verify that old user was deleted and a new one created with same email
      const newCount = await User.countDocuments({ email: 'unverified@example.com' });
      expect(newCount).toBe(1); // There should only be one user with that email
      const updatedUser = await User.findOne({ email: 'unverified@example.com' });

      expect(updatedUser.name).toBe('New'); // Name should be from the new registration
      expect(updatedUser.isEmailVerified).toBe(false); // Still unverified
      expect(updatedUser.verificationCode).toBe('123456'); // New code (from default mock)
      expect(updatedUser._id.toString()).not.toBe(oldUser._id.toString()); // Should be a new document ID
      expect(handleEmail.sendVerificationEmail).toHaveBeenCalledWith('unverified@example.com', '123456');
    });
  });

  // Test for verifyEmail
  describe('POST /api/user/validation', () => {
    let token;
    let mockUserInstance; // We'll use a real Mongoose instance
    const testEmail = 'verify@example.com';
    const testCode = '123456';

    // Before each test in this suite, create an unverified user and a token for it
    beforeEach(async () => {
      // Reset mocks before creating user, to avoid id conflicts
      jest.clearAllMocks();
      // Common mocks for authService if needed globally
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
        verificationExpires: new Date(Date.now() + 3600000), // Valid for 1 hour
        verificationAttempts: 0,
        maxVerificationAttempts: 5,
      });

      token = authService.generateToken({ id: mockUserInstance._id.toString(), email: mockUserInstance.email, role: 'user' });
    });

    it('should return 400 for validation errors (e.g., missing code)', async () => {
      const response = await request(app)
        .post('/api/user/validation')
        .set('Authorization', `Bearer ${token}`)
        .send({}); // Missing code

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

      // Verify that we attempted to search for user with token ID
      expect(User.findById).toHaveBeenCalledWith(mockUserInstance._id.toString());
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('message', 'User not found');
    });

    it('should verify email successfully and return 200', async () => {
      const response = await request(app)
        .post('/api/user/validation')
        .set('Authorization', `Bearer ${token}`)
        .send({ code: testCode });

      // Get user from DB to verify their real state
      const updatedUser = await User.findById(mockUserInstance._id);
      expect(updatedUser.isEmailVerified).toBe(true);
      expect(updatedUser.verificationCode).toBeNull(); // Code should be null after verification
      expect(updatedUser.verificationAttempts).toBe(0); // Attempts reset

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

      const updatedUser = await User.findById(mockUserInstance._id); // User is updated to see attempts
      expect(updatedUser.verificationAttempts).toBe(1); // Attempt should increment
      expect(updatedUser.isEmailVerified).toBe(false); // Not verified

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message', 'Invalid or expired verification code.');
    });

    it('should return 400 if max verification attempts exceeded', async () => {
      // Configure user to have already reached max attempts
      await User.findByIdAndUpdate(mockUserInstance._id, { verificationAttempts: mockUserInstance.maxVerificationAttempts });

      const response = await request(app)
        .post('/api/user/validation')
        .set('Authorization', `Bearer ${token}`)
        .send({ code: testCode });

      const updatedUser = await User.findById(mockUserInstance._id);
      expect(updatedUser.verificationAttempts).toBe(mockUserInstance.maxVerificationAttempts); // Attempts don't change if already exceeded
      expect(updatedUser.isEmailVerified).toBe(false); // Not verified

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message', 'Maximum verification attempts reached. Please request a new code.');
    });

     it('should return 400 if user email is already verified', async () => {
      // Configure user to already be verified
      await User.findByIdAndUpdate(mockUserInstance._id, { isEmailVerified: true });

      const response = await request(app)
        .post('/api/user/validation')
        .set('Authorization', `Bearer ${token}`)
        .send({ code: 'anyCode' });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message', 'Email is already verified.');
    });
  });

  // Test for loginUser
  describe('POST /api/user/login', () => {
    let hashedPassword;
    let verifiedUser;

    beforeEach(async () => {
        await User.deleteMany({}); // Clean before each login test

        // Create a verified user for successful login tests
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
        authService.comparePassword.mockResolvedValue(true); // Default mock for password comparison
        authService.generateToken.mockImplementation((payload) => `mockTokenFor-${payload.id || payload._id}`); // Ensure consistency with ObjectId
    });

    it('should return 400 for validation errors (e.g., missing email or password)', async () => {
      const response = await request(app)
        .post('/api/user/login')
        .send({ email: 'test@example.com' }); // Missing password
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('success', false);
      expect(response.body.data.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ msg: 'Password cannot be empty.' })
        ])
      );
    });

    it('should return 401 if user not found', async () => {
      // if there are no subsequent findOne calls in this test.
      // If your controller does User.findOne, and finds nothing, it returns 401.
      const response = await request(app)
        .post('/api/user/login')
        .send({ email: 'nonexistent@example.com', password: 'password123' });
      // You don't need expect(User.findOne).toHaveBeenCalledWith... if we're not mocking User directly
      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('message', 'Invalid credentials');
    });

    it('should return 400 if email not verified', async () => {
      // Create an unverified user for this test
      const unverifiedUser = await User.create({
          name: 'Unverified User',
          surname: 'Test',
          email: 'unverified@example.com',
          password: hashedPassword, // Use hashed password from beforeEach
          isEmailVerified: false,
          role: 'user',
      });
      // We don't need to mock User.findOne if we're creating the user directly in the DB.
      // The controller will search for it and find it.

      const response = await request(app)
        .post('/api/user/login')
        .send({ email: 'unverified@example.com', password: 'correctPassword' }); // Use correct password

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message', 'Email not verified. Please verify your email before logging in.');
    });

    it('should return 401 if password does not match', async () => {
      authService.comparePassword.mockResolvedValueOnce(false); // Only for this test

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

      // Verify that the id sent to generateToken is the real id of the created user
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

  // Test for getCurrentUser (GET /api/user)
  describe('GET /api/user', () => {
    let token;
    let testUser; // Real user instance

    beforeEach(async () => {
        await User.deleteMany({});
        testUser = await User.create({
            name: 'Current User',
            surname: 'Test',
            email: 'current@example.com',
            password: 'hashedPasswordForTests', // Password hashed by mock in global beforeEach
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
        .get('/api/user') // CORRECTION: Path to /api/user
        .set('Authorization', `Bearer ${token}`);

      expect(User.findById).toHaveBeenCalledWith(testUser._id.toString());
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('message', 'User not found');
    });

    it('should return current user data (200)', async () => {
      // In this test, user is already created in beforeEach, so User.findById will find it.
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
      expect(response.body).not.toHaveProperty('password'); // Make sure password is not exposed
    });
  });

  // Test for updatePersonalData (PUT /api/user)
  describe('PUT /api/user', () => {
    let token;
    let testUser;

    beforeEach(async () => {
        await User.deleteMany({});
        testUser = await User.create({
            name: 'Old Name',
            surname: 'Old Surname',
            email: 'update@example.com',
            password: 'hashedPasswordForTests', // Password hashed by mock
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
        .send({ name: '' }); // Empty name
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('success', false);
      expect(response.body.data.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ msg: 'name cannot be empty.' }) // Error message from your validator
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

      // Verify directly from database
      const updatedUserInDb = await User.findById(testUser._id);
      expect(updatedUserInDb.name).toBe(updateData.name);
      expect(updatedUserInDb.phone).toBe(updateData.phone);
      expect(updatedUserInDb.surname).toBe(updateData.surname);

      expect(response.body.user).toEqual(expect.objectContaining({
        _id: testUser._id.toString(),
        name: updateData.name,
        email: testUser.email, // Email doesn't change in this endpoint
        phone: updateData.phone,
        surname: updateData.surname
      }));
    });
  });
});
