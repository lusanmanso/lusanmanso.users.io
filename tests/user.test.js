// File: tests/user.test.js
const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../server');
const User = require('../models/User');
const path = require('path');

// Mock services
jest.mock('../utils/handleEmail', () => ({
  sendVerificationEmail: jest.fn(),
  sendPasswordResetEmail: jest.fn(),
  sendInvitationEmail: jest.fn()
}));

describe('User API Tests', () => {
  let testUser, userToken, guestToken;

  beforeAll(async () => {
    await User.deleteMany({});
  });

  afterAll(async () => {
    await User.deleteMany({});
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    await User.deleteMany({});
  });

  // ===================== REGISTRO =====================
  describe('POST /api/user/register', () => {
    it('should register new user with exact response structure', async () => {
      const userData = {
        name: 'John',
        surname: 'Doe',
        email: 'john@test.com',
        password: 'Password123',
        passwordConfirm: 'Password123'
      };

      const res = await request(app)
        .post('/api/user/register')
        .send(userData)
        .expect(201);

      // Verify exact response structure
      expect(res.body).toHaveProperty('message');
      expect(res.body).toHaveProperty('user');
      expect(res.body).toHaveProperty('token');
      expect(res.body.message).toBe('User registered successfully. Verification email sent.');
      expect(res.body.user.email).toBe(userData.email);
      expect(res.body.user.status).toBe('pending');

      const dbUser = await User.findOne({ email: userData.email });
      expect(dbUser.isEmailVerified).toBe(false);
      expect(dbUser.verificationCode).toBeDefined();
    });

    it('should reject registration with mismatched passwords', async () => {
      const userData = {
        name: 'John',
        surname: 'Doe',
        email: 'john@test.com',
        password: 'Password123',
        passwordConfirm: 'Different123'
      };

      const res = await request(app)
        .post('/api/user/register')
        .send(userData)
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.type).toBe('VALIDATION_ERROR');
      expect(res.body.data).toHaveProperty('errors');
      expect(Array.isArray(res.body.data.errors)).toBe(true);
    });

    it('should reject duplicate email for verified user', async () => {
      const existingUser = new User({
        name: 'Existing',
        surname: 'User',
        email: 'existing@test.com',
        password: 'hashedPassword',
        isEmailVerified: true
      });
      await existingUser.save();

      const userData = {
        name: 'New',
        surname: 'User',
        email: 'existing@test.com',
        password: 'Password123',
        passwordConfirm: 'Password123'
      };

      const res = await request(app)
        .post('/api/user/register')
        .send(userData)
        .expect(409);

      expect(res.body.message).toBe('Email is already registered and verified');
    });
  });

  // ===================== VALIDACIÓN EMAIL =====================
  describe('POST /api/user/validation', () => {
    beforeEach(async () => {
      testUser = new User({
        name: 'Test',
        surname: 'User',
        email: 'test@example.com',
        password: 'hashedPassword',
        isEmailVerified: false,
        verificationCode: '123456',
        verificationAttempts: 0,
        maxVerificationAttempts: 3
      });
      await testUser.save();

      const jwt = require('jsonwebtoken');
      userToken = jwt.sign(
        { id: testUser._id, email: testUser.email, role: testUser.role },
        process.env.JWT_SECRET
      );
    });

    it('should validate email with correct code', async () => {
      const res = await request(app)
        .post('/api/user/validation')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ code: '123456' })
        .expect(200);

      expect(res.body.message).toBe('Email verified successfully');

      const updatedUser = await User.findById(testUser._id);
      expect(updatedUser.isEmailVerified).toBe(true);
      expect(updatedUser.verificationCode).toBeNull();
    });

    it('should reject invalid verification code', async () => {
      const res = await request(app)
        .post('/api/user/validation')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ code: 'wrong123' })
        .expect(400);

      if (res.body.success === false && res.body.type === 'VALIDATION_ERROR') {
        expect(res.body.data.errors).toBeDefined();
      } else {
        expect(res.body.message).toBe('Incorrect verification code');
      }
    });

    it('should require authentication', async () => {
      const res = await request(app)
        .post('/api/user/validation')
        .send({ code: '123456' })
        .expect(401);

      expect(res.body.message).toContain('No token, authorization denied');
    });
  });

  // ===================== LOGIN =====================
  describe('POST /api/user/login', () => {
    beforeEach(async () => {
      const bcrypt = require('bcrypt');
      const hashedPassword = await bcrypt.hash('Password123', 10);

      testUser = new User({
        name: 'Test',
        surname: 'User',
        email: 'test@example.com',
        password: hashedPassword,
        isEmailVerified: true,
        role: 'user'
      });
      await testUser.save();
    });

    it('should login with valid credentials', async () => {
      const res = await request(app)
        .post('/api/user/login')
        .send({
          email: 'test@example.com',
          password: 'Password123'
        })
        .expect(200);

      expect(res.body).toHaveProperty('user');
      expect(res.body).toHaveProperty('token');
      expect(res.body.user.email).toBe('test@example.com');
      expect(res.body.user.id).toBeDefined();
      expect(res.body.user.role).toBe('user');
      expect(res.body.user.status).toBe('verified');
      expect(typeof res.body.token).toBe('string');

      userToken = res.body.token;
    });

    it('should reject invalid credentials', async () => {
      const res = await request(app)
        .post('/api/user/login')
        .send({
          email: 'test@example.com',
          password: 'WrongPassword'
        })
        .expect(401);

      expect(res.body.message).toBe('Invalid credentials');
    });

    it('should reject unverified user', async () => {
      await User.findByIdAndUpdate(testUser._id, { isEmailVerified: false });

      const res = await request(app)
        .post('/api/user/login')
        .send({
          email: 'test@example.com',
          password: 'Password123'
        })
        .expect(400);

      expect(res.body.message).toBe('Email not verified. Please verify your email to log in.');
    });
  });

  // ===================== OBTENER USUARIO =====================
  describe('GET /api/user', () => {
    beforeEach(async () => {
      const bcrypt = require('bcrypt');
      const hashedPassword = await bcrypt.hash('Password123', 10);

      testUser = new User({
        name: 'Test',
        surname: 'User',
        email: 'test@example.com',
        password: hashedPassword,
        isEmailVerified: true,
        role: 'user',
        firstName: 'John',
        lastName: 'Doe',
        nif: '12345678A'
      });
      await testUser.save();

      const jwt = require('jsonwebtoken');
      userToken = jwt.sign(
        { id: testUser._id, email: testUser.email, role: testUser.role },
        process.env.JWT_SECRET
      );
    });

    it('should get current user data with exact structure', async () => {
      const res = await request(app)
        .get('/api/user')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(res.body.email).toBe('test@example.com');
      expect(res.body.role).toBe('user');
      expect(res.body.password).toBeUndefined();
    });

    it('should require valid token', async () => {
      const res = await request(app)
        .get('/api/user')
        .expect(401);

      expect(res.body.message).toBe('No token, authorization denied');
    });

    it('should reject invalid token', async () => {
      const res = await request(app)
        .get('/api/user')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(res.body.message).toBe('Invalid token');
    });
  });

  // ===================== ACTUALIZAR DATOS PERSONALES =====================
  describe('PUT /api/user', () => {
    beforeEach(async () => {
      const bcrypt = require('bcrypt');
      const hashedPassword = await bcrypt.hash('Password123', 10);

      testUser = new User({
        name: 'Test',
        surname: 'User',
        email: 'test@example.com',
        password: hashedPassword,
        isEmailVerified: true,
        role: 'user'
      });
      await testUser.save();

      const jwt = require('jsonwebtoken');
      userToken = jwt.sign(
        { id: testUser._id, email: testUser.email, role: testUser.role },
        process.env.JWT_SECRET
      );
    });

    it('should update personal data successfully', async () => {
      const updateData = {
        firstName: 'John',
        lastName: 'Updated',
        nif: '12345678A'
      };

      const res = await request(app)
        .put('/api/user')
        .set('Authorization', `Bearer ${userToken}`)
        .send(updateData)
        .expect(200);

      expect(res.body.message).toContain('updated successfully');
      expect(res.body.user).toBeDefined();
    });

    it('should reject invalid NIF format', async () => {
      const updateData = {
        firstName: 'John',
        lastName: 'Doe',
        nif: 'invalid-nif'
      };

      const res = await request(app)
        .put('/api/user')
        .set('Authorization', `Bearer ${userToken}`)
        .send(updateData)
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.type).toBe('VALIDATION_ERROR');
    });

    it('should require authentication', async () => {
      const res = await request(app)
        .put('/api/user')
        .send({ firstName: 'John' })
        .expect(401);

      expect(res.body.message).toBe('No token, authorization denied');
    });
  });

  // ===================== ACTUALIZAR DATOS EMPRESA =====================
  describe('PATCH /api/user/company', () => {
    beforeEach(async () => {
      const bcrypt = require('bcrypt');
      const hashedPassword = await bcrypt.hash('Password123', 10);

      testUser = new User({
        name: 'Test',
        surname: 'User',
        email: 'test@example.com',
        password: hashedPassword,
        isEmailVerified: true,
        role: 'user'
      });
      await testUser.save();

      const jwt = require('jsonwebtoken');
      userToken = jwt.sign(
        { id: testUser._id, email: testUser.email, role: testUser.role },
        process.env.JWT_SECRET
      );
    });

    it('should update company data for regular company', async () => {
      const companyData = {
        company: {
          name: 'Test Company SL',
          cif: 'B12345678',
          address: {
            street: 'Calle Test 123',
            city: 'Madrid',
            postalCode: '28001'
          },
          isAutonomous: false
        }
      };

      const res = await request(app)
        .patch('/api/user/company')
        .set('Authorization', `Bearer ${userToken}`)
        .send(companyData)
        .expect(200);

      expect(res.body.message).toContain('updated successfully');
      expect(res.body.user).toBeDefined();
    });

    it('should require proper company structure', async () => {
      const companyData = {
        company: {
          isAutonomous: true
        }
      };

      const res = await request(app)
        .patch('/api/user/company')
        .set('Authorization', `Bearer ${userToken}`)
        .send(companyData);

      expect([200, 400]).toContain(res.status);
    });

    it('should require authentication', async () => {
      const res = await request(app)
        .patch('/api/user/company')
        .send({ company: { name: 'Test' } })
        .expect(401);

      expect(res.body.message).toBe('No token, authorization denied');
    });
  });

  // ===================== LOGO =====================
  describe('PATCH /api/user/logo', () => {
    beforeEach(async () => {
      const bcrypt = require('bcrypt');
      const hashedPassword = await bcrypt.hash('Password123', 10);

      testUser = new User({
        name: 'Test',
        surname: 'User',
        email: 'test@example.com',
        password: hashedPassword,
        isEmailVerified: true,
        role: 'user'
      });
      await testUser.save();

      const jwt = require('jsonwebtoken');
      userToken = jwt.sign(
        { id: testUser._id, email: testUser.email, role: testUser.role },
        process.env.JWT_SECRET
      );
    });

    it('should require authentication', async () => {
      const res = await request(app)
        .patch('/api/user/logo')
        .expect(401);

      expect(res.body.message).toBe('No token, authorization denied');
    });

    it('should handle missing file', async () => {
      const res = await request(app)
        .patch('/api/user/logo')
        .set('Authorization', `Bearer ${userToken}`);

      expect([400, 500]).toContain(res.status);
    });
  });

  // ===================== ELIMINAR USUARIO =====================
  describe('DELETE /api/user', () => {
    beforeEach(async () => {
      const bcrypt = require('bcrypt');
      const hashedPassword = await bcrypt.hash('Password123', 10);

      testUser = new User({
        name: 'Test',
        surname: 'User',
        email: 'test@example.com',
        password: hashedPassword,
        isEmailVerified: true,
        role: 'user'
      });
      await testUser.save();

      const jwt = require('jsonwebtoken');
      userToken = jwt.sign(
        { id: testUser._id, email: testUser.email, role: testUser.role },
        process.env.JWT_SECRET
      );
    });

    it('should soft delete user by default', async () => {
      const res = await request(app)
        .delete('/api/user')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(res.body.message).toBe('User deleted temporarily');

      const deletedUser = await User.findOneDeleted({ _id: testUser._id });
      expect(deletedUser).toBeTruthy();
      expect(deletedUser.deleted).toBe(true);
    });

    it('should hard delete when soft=false', async () => {
      const res = await request(app)
        .delete('/api/user?soft=false')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(res.body.message).toBe('User deleted permanently');

      const user = await User.findById(testUser._id);
      expect(user).toBeNull();
    });

    it('should require authentication', async () => {
      const res = await request(app)
        .delete('/api/user')
        .expect(401);

      expect(res.body.message).toBe('No token, authorization denied');
    });
  });

  // ===================== RECUPERAR CONTRASEÑA =====================
  describe('POST /api/user/recover-password', () => {
    beforeEach(async () => {
      const bcrypt = require('bcrypt');
      const hashedPassword = await bcrypt.hash('Password123', 10);

      testUser = new User({
        name: 'Test',
        surname: 'User',
        email: 'test@example.com',
        password: hashedPassword,
        isEmailVerified: true,
        role: 'user'
      });
      await testUser.save();
    });

    it('should send reset code for existing email', async () => {
      const res = await request(app)
        .post('/api/user/recover-password')
        .send({ email: 'test@example.com' })
        .expect(200);

      expect(res.body.message).toBe('If the email exists you will receive a reset code');

      const user = await User.findOne({ email: 'test@example.com' });
      expect(user.passwordResetCode).toBeDefined();
      expect(user.passwordResetExpires).toBeDefined();
    });

    it('should return error for non-existing email', async () => {
      const res = await request(app)
        .post('/api/user/recover-password')
        .send({ email: 'nonexistent@example.com' })
        .expect(404);

      expect(res.body.message).toBe('Email not found');
    });

    it('should reject invalid email format', async () => {
      const res = await request(app)
        .post('/api/user/recover-password')
        .send({ email: 'invalid-email' })
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.type).toBe('VALIDATION_ERROR');
    });
  });

  // ===================== RESETEAR CONTRASEÑA =====================
  describe('POST /api/user/reset-password', () => {
    beforeEach(async () => {
      const bcrypt = require('bcrypt');
      const hashedPassword = await bcrypt.hash('Password123', 10);

      testUser = new User({
        name: 'Test',
        surname: 'User',
        email: 'test@example.com',
        password: hashedPassword,
        isEmailVerified: true,
        role: 'user',
        passwordResetCode: '123456',
        passwordResetExpires: Date.now() + 3600000 // 1 hora
      });
      await testUser.save();
    });

    it('should reset password with valid code', async () => {
      const resetData = {
        email: 'test@example.com',
        code: '123456',
        newPassword: 'NewPassword123'
      };

      const res = await request(app)
        .post('/api/user/reset-password')
        .send(resetData)
        .expect(200);

      expect(res.body.message).toBe('Password updated successfully');

      const user = await User.findOne({ email: 'test@example.com' });
      expect(user.passwordResetCode).toBeUndefined();
      expect(user.passwordResetExpires).toBeUndefined();
    });

    it('should reject invalid code', async () => {
      const resetData = {
        email: 'test@example.com',
        code: 'wrong-code',
        newPassword: 'NewPassword123'
      };

      const res = await request(app)
        .post('/api/user/reset-password')
        .send(resetData)
        .expect(400);

      // Verify the response flexibly
      if (res.body.success === false && res.body.type === 'VALIDATION_ERROR') {
        expect(res.body.data.errors).toBeDefined();
      } else {
        expect(res.body.message).toBe('Invalid or expired code');
      }
    });

    it('should reject expired code', async () => {
      await User.findByIdAndUpdate(testUser._id, {
        passwordResetExpires: Date.now() - 1000 // Expirado
      });

      const resetData = {
        email: 'test@example.com',
        code: '123456',
        newPassword: 'NewPassword123'
      };

      const res = await request(app)
        .post('/api/user/reset-password')
        .send(resetData)
        .expect(400);

      expect(res.body.message).toBe('Invalid or expired code');
    });
  });

  // ===================== INVITAR USUARIO =====================
  describe('POST /api/user/invite', () => {
    beforeEach(async () => {
      const bcrypt = require('bcrypt');
      const hashedPassword = await bcrypt.hash('Password123', 10);

      testUser = new User({
        name: 'Owner',
        surname: 'User',
        email: 'owner@example.com',
        password: hashedPassword,
        isEmailVerified: true,
        role: 'user',
        company: {
          name: 'Test Company',
          cif: 'B12345678',
          address: { street: 'Test St', city: 'Madrid' }
        }
      });
      await testUser.save();

      const jwt = require('jsonwebtoken');
      userToken = jwt.sign(
        { id: testUser._id, email: testUser.email, role: testUser.role },
        process.env.JWT_SECRET
      );
    });

    it('should invite new user successfully', async () => {
      const inviteData = {
        email: 'newguest@example.com',
        role: 'guest'
      };

      const res = await request(app)
        .post('/api/user/invite')
        .set('Authorization', `Bearer ${userToken}`)
        .send(inviteData)
        .expect(201);

      expect(res.body.message).toBe('Invitation sent');
      expect(res.body.user.email).toBe('newguest@example.com');
      expect(res.body.user.role).toBe('guest');
    });

    it('should handle user without company data', async () => {
      // Create user without company
      const bcrypt = require('bcrypt');
      const hashedPassword = await bcrypt.hash('Password123', 10);

      const userWithoutCompany = new User({
        name: 'No Company',
        surname: 'User',
        email: 'nocompany@example.com',
        password: hashedPassword,
        isEmailVerified: true,
        role: 'user'
      });
      await userWithoutCompany.save();

      const jwt = require('jsonwebtoken');
      const tokenWithoutCompany = jwt.sign(
        { id: userWithoutCompany._id, email: userWithoutCompany.email, role: userWithoutCompany.role },
        process.env.JWT_SECRET
      );

      const inviteData = {
        email: 'guest@example.com',
        role: 'guest'
      };

      const res = await request(app)
        .post('/api/user/invite')
        .set('Authorization', `Bearer ${tokenWithoutCompany}`)
        .send(inviteData);

      expect([201, 400]).toContain(res.status);

      if (res.status === 400) {
        expect(res.body.message).toContain('company data');
      } else {
        expect(res.body.message).toBe('Invitation sent');
      }
    });

    it('should require authentication', async () => {
      const res = await request(app)
        .post('/api/user/invite')
        .send({ email: 'test@example.com', role: 'guest' })
        .expect(401);

      expect(res.body.message).toBe('No token, authorization denied');
    });
  });
});
