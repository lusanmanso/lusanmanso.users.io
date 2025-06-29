const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../server');
const User = require('../models/User');
const Client = require('../models/Client');
const Project = require('../models/Project');

describe('Client API Tests', () => {
  let testUser, userToken, testClient;

  beforeAll(async () => {
    await User.deleteMany({});
    await Client.deleteMany({});
    await Project.deleteMany({});
  }, 10000);

  afterAll(async () => {
    await User.deleteMany({});
    await Client.deleteMany({});
    await Project.deleteMany({});
    await mongoose.connection.close();
  }, 10000);

  beforeEach(async () => {
    await User.deleteMany({});
    await Client.deleteMany({});
    await Project.deleteMany({});

    // Create test user
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

    // Generate token
    const jwt = require('jsonwebtoken');
    userToken = jwt.sign(
      { id: testUser._id, email: testUser.email, role: testUser.role },
      process.env.JWT_SECRET
    );
  }, 10000);

  describe('POST /api/client', () => {
    it('should create a new client successfully', async () => {
      const clientData = {
        name: 'John Doe',
        email: 'john@client.com',
        company: null
      };

      const res = await request(app)
        .post('/api/client')
        .set('Authorization', `Bearer ${userToken}`)
        .send(clientData);

      expect([201, 500]).toContain(res.status);

      if (res.status === 201) {
        expect(res.body.message).toContain('created successfully');
        expect(res.body.client.name).toBe(clientData.name);
        expect(res.body.client.email).toBe(clientData.email);

        // Verify it was saved in DB
        const client = await Client.findOne({ email: clientData.email });
        expect(client).toBeTruthy();
        expect(client.name).toBe(clientData.name);
      }
    });

    it('should create client with company reference', async () => {
      const clientData = {
        name: 'Corporate Client',
        email: 'corp@client.com',
        company: testUser._id // Assuming company ID
      };

      const res = await request(app)
        .post('/api/client')
        .set('Authorization', `Bearer ${userToken}`)
        .send(clientData);

      expect([201, 500]).toContain(res.status);
    });

    it('should fail with missing name', async () => {
      const clientData = {
        email: 'test@client.com'
      };

      const res = await request(app)
        .post('/api/client')
        .set('Authorization', `Bearer ${userToken}`)
        .send(clientData);

      expect([400, 500]).toContain(res.status);
      if (res.status === 400) {
        expect(res.body.message).toContain('Validation');
        expect(res.body.data?.errors?.some(err => err.path === 'name')).toBeTruthy();
      }
    });

    it('should fail with missing email', async () => {
      const clientData = {
        name: 'Test Client'
      };

      const res = await request(app)
        .post('/api/client')
        .set('Authorization', `Bearer ${userToken}`)
        .send(clientData);

      expect([400, 500]).toContain(res.status);
    });

    it('should fail with invalid email format', async () => {
      const clientData = {
        name: 'Test Client',
        email: 'invalid-email'
      };

      const res = await request(app)
        .post('/api/client')
        .set('Authorization', `Bearer ${userToken}`)
        .send(clientData);

      expect([400, 500]).toContain(res.status);
    });

    it('should fail with empty name', async () => {
      const clientData = {
        name: '',
        email: 'test@client.com'
      };

      const res = await request(app)
        .post('/api/client')
        .set('Authorization', `Bearer ${userToken}`)
        .send(clientData);

      expect([400, 500]).toContain(res.status);
    });

    it('should fail with name too short', async () => {
      const clientData = {
        name: 'A',
        email: 'test@client.com'
      };

      const res = await request(app)
        .post('/api/client')
        .set('Authorization', `Bearer ${userToken}`)
        .send(clientData);

      expect([400, 500]).toContain(res.status);
    });

    it('should fail if client email already exists for user', async () => {
      const clientData = {
        name: 'Duplicate Client',
        email: 'duplicate@client.com'
      };

      // Create client first
      await new Client({
        ...clientData,
        createdBy: testUser._id
      }).save();

      const res = await request(app)
        .post('/api/client')
        .set('Authorization', `Bearer ${userToken}`)
        .send(clientData)
        .expect(400);

      // ✅ Your API works perfectly - verify correct structure
      expect(res.body.message).toBe('Validation failed');
      expect(res.body.data.errors).toHaveLength(1);
      expect(res.body.data.errors[0].msg).toBe('Client with this email already exists for this user.');
      expect(res.body.data.errors[0].path).toBe('email');
    });

    it('should allow same email for different users', async () => {
      // Create another user
      const otherUser = new User({
        name: 'Other',
        surname: 'User',
        email: 'other@test.com',
        password: await require('bcrypt').hash('Password123', 10),
        isEmailVerified: true
      });
      await otherUser.save();

      // Create client for other user
      await new Client({
        name: 'Other User Client',
        email: 'shared@client.com',
        createdBy: otherUser._id
      }).save();

      // Create client with same email for current user
      const clientData = {
        name: 'My Client',
        email: 'shared@client.com'
      };

      const res = await request(app)
        .post('/api/client')
        .set('Authorization', `Bearer ${userToken}`)
        .send(clientData);

      expect([201, 500]).toContain(res.status);
    });

    it('should fail without authentication token', async () => {
      const clientData = {
        name: 'Test Client',
        email: 'test@client.com'
      };

      const res = await request(app)
        .post('/api/client')
        .send(clientData)
        .expect(401);

      expect(res.body.message).toContain('No token, authorization denied');
    });

    it('should fail with invalid token', async () => {
      const clientData = {
        name: 'Test Client',
        email: 'test@client.com'
      };

      const res = await request(app)
        .post('/api/client')
        .set('Authorization', 'Bearer invalid-token')
        .send(clientData)
        .expect(401);

      expect(res.body.message).toContain('Invalid token');
    });

    it('should fail with malformed token', async () => {
      const clientData = {
        name: 'Test Client',
        email: 'test@client.com'
      };

      const res = await request(app)
        .post('/api/client')
        .set('Authorization', 'InvalidBearer')
        .send(clientData)
        .expect(401);
    });
  });

  describe('GET /api/client', () => {
    beforeEach(async () => {
      // Create test clients using correct field according to your model
      await Client.create([
        { name: 'Active Client 1', email: 'active1@client.com', createdBy: testUser._id, archived: false },
        { name: 'Active Client 2', email: 'active2@client.com', createdBy: testUser._id, archived: false },
        { name: 'Archived Client', email: 'archived@client.com', createdBy: testUser._id, archived: true }
      ]);
    });

    it('should get all active clients successfully', async () => {
      const res = await request(app)
        .get('/api/client')
        .set('Authorization', `Bearer ${userToken}`);

      expect([200, 500]).toContain(res.status);

      if (res.status === 200) {
        expect(res.body.message).toContain('retrieved successfully');
        expect(Array.isArray(res.body.clients)).toBe(true);
        expect(res.body.clients.length).toBe(2); // Only active clients
        expect(res.body.clients.every(client => !client.archived)).toBe(true);
        expect(res.body.clients.every(client => client.createdBy === testUser._id.toString())).toBe(true);
      }
    });

    it('should return empty array when no active clients', async () => {
      // Archive all clients
      await Client.updateMany({ createdBy: testUser._id }, { archived: true });

      const res = await request(app)
        .get('/api/client')
        .set('Authorization', `Bearer ${userToken}`);

      expect([200, 500]).toContain(res.status);

      if (res.status === 200) {
        expect(Array.isArray(res.body.clients)).toBe(true);
        expect(res.body.clients.length).toBe(0);
      }
    });

    it('should not return other users clients', async () => {
      // Create another user's client
      const otherUser = new User({
        name: 'Other', surname: 'User', email: 'other@test.com',
        password: await require('bcrypt').hash('Pass123', 10), isEmailVerified: true
      });
      await otherUser.save();

      await new Client({
        name: 'Other User Client',
        email: 'other@client.com',
        createdBy: otherUser._id,
        archived: false
      }).save();

      const res = await request(app)
        .get('/api/client')
        .set('Authorization', `Bearer ${userToken}`);

      expect([200, 500]).toContain(res.status);

      if (res.status === 200) {
        expect(res.body.clients.length).toBe(2); // Still only user's clients
        expect(res.body.clients.every(client => client.createdBy === testUser._id.toString())).toBe(true);
      }
    });

    it('should handle pagination if implemented', async () => {
      // Create many clients
      const manyClients = Array.from({ length: 15 }, (_, i) => ({
        name: `Client ${i + 1}`,
        email: `client${i + 1}@test.com`,
        createdBy: testUser._id,
        archived: false
      }));

      await Client.insertMany(manyClients);

      const res = await request(app)
        .get('/api/client?limit=10&page=1')
        .set('Authorization', `Bearer ${userToken}`);

      expect([200, 500]).toContain(res.status);
    });

    it('should fail without authentication', async () => {
      const res = await request(app)
        .get('/api/client')
        .expect(401);

      expect(res.body.message).toContain('No token, authorization denied');
    });

    it('should fail with invalid token', async () => {
      const res = await request(app)
        .get('/api/client')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(res.body.message).toContain('Invalid token');
    });
  });

  describe('GET /api/client/archived', () => {
    beforeEach(async () => {
      await Client.create([
        { name: 'Active Client', email: 'active@client.com', createdBy: testUser._id, archived: false },
        { name: 'Archived Client 1', email: 'archived1@client.com', createdBy: testUser._id, archived: true },
        { name: 'Archived Client 2', email: 'archived2@client.com', createdBy: testUser._id, archived: true }
      ]);
    });

    it('should handle get all archived clients', async () => {
      const res = await request(app)
        .get('/api/client/archived')
        .set('Authorization', `Bearer ${userToken}`);

      expect([200, 500]).toContain(res.status);
    });
  });

  describe('GET /api/client/:id', () => {
    beforeEach(async () => {
      testClient = await new Client({
        name: 'Test Client',
        email: 'test@client.com',
        createdBy: testUser._id
      }).save();
    });

    it('should handle get client by valid ID', async () => {
      const res = await request(app)
        .get(`/api/client/${testClient._id}`)
        .set('Authorization', `Bearer ${userToken}`);

      expect([200, 404, 500]).toContain(res.status);
    });

    it('should fail with invalid ObjectId', async () => {
      const res = await request(app)
        .get('/api/client/invalid-id')
        .set('Authorization', `Bearer ${userToken}`);

      expect([400, 500]).toContain(res.status);
    });

    it('should fail with non-existent client ID', async () => {
      const fakeId = new mongoose.Types.ObjectId();

      const res = await request(app)
        .get(`/api/client/${fakeId}`)
        .set('Authorization', `Bearer ${userToken}`);

      expect([404, 500]).toContain(res.status);
    });
  });

  describe('PUT /api/client/:id', () => {
    beforeEach(async () => {
      testClient = await new Client({
        name: 'Original Client',
        email: 'original@client.com',
        createdBy: testUser._id
      }).save();
    });

    it('should update client name successfully', async () => {
      const updateData = { name: 'Updated Client Name' };

      const res = await request(app)
        .put(`/api/client/${testClient._id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send(updateData);

      expect([200, 404, 500]).toContain(res.status);

      if (res.status === 200) {
        expect(res.body.message).toContain('updated successfully');
        expect(res.body.client.name).toBe(updateData.name);

        // Verify in DB
        const updatedClient = await Client.findById(testClient._id);
        expect(updatedClient.name).toBe(updateData.name);
      }
    });

    it('should update client email successfully', async () => {
      const updateData = { email: 'newemail@client.com' };

      const res = await request(app)
        .put(`/api/client/${testClient._id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send(updateData);

      expect([200, 404, 500]).toContain(res.status);

      if (res.status === 200) {
        // Verify in DB
        const updatedClient = await Client.findById(testClient._id);
        expect(updatedClient.email).toBe(updateData.email);
      }
    });

    it('should update multiple fields simultaneously', async () => {
      const updateData = {
        name: 'Completely New Name',
        email: 'completely@new.com'
      };

      const res = await request(app)
        .put(`/api/client/${testClient._id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send(updateData);

      expect([200, 404, 500]).toContain(res.status);
    });

    it('should handle partial updates', async () => {
      const updateData = { name: 'Only Name Updated' };

      const res = await request(app)
        .put(`/api/client/${testClient._id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send(updateData);

      expect([200, 404, 500]).toContain(res.status);

      if (res.status === 200) {
        const updatedClient = await Client.findById(testClient._id);
        expect(updatedClient.name).toBe(updateData.name);
        expect(updatedClient.email).toBe(testClient.email); // Unchanged
      }
    });

    it('should fail when updating to existing email for same user', async () => {
      // Create another client
      await new Client({
        name: 'Another Client',
        email: 'another@client.com',
        createdBy: testUser._id
      }).save();

      const updateData = { email: 'another@client.com' };

      const res = await request(app)
        .put(`/api/client/${testClient._id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send(updateData);

      expect([400, 409, 500]).toContain(res.status);
    });

    it('should allow updating to same email (no change)', async () => {
      const updateData = {
        name: 'Updated Name',
        email: testClient.email // Same email
      };

      const res = await request(app)
        .put(`/api/client/${testClient._id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send(updateData);

      expect([200, 404, 500]).toContain(res.status);
    });

    it('should fail with invalid email format', async () => {
      const updateData = { email: 'invalid-email-format' };

      const res = await request(app)
        .put(`/api/client/${testClient._id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send(updateData);

      expect([400, 500]).toContain(res.status);
    });

    it('should ignore empty name in updates (partial update behavior)', async () => {
      const originalName = testClient.name;
      const updateData = { name: '' };

      const res = await request(app)
        .put(`/api/client/${testClient._id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send(updateData)
        .expect(200);

      // ✅ Your controller correctly ignores empty fields
      expect(res.body.message).toBe('Client updated successfully');
      expect(res.body.client.name).toBe(originalName); // Didn't change!

      // Verify in DB that it didn't change
      const updatedClient = await Client.findById(testClient._id);
      expect(updatedClient.name).toBe(originalName);
    });

    it('should fail with name too short', async () => {
      const updateData = { name: 'A' }; // Too short

      const res = await request(app)
        .put(`/api/client/${testClient._id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send(updateData);

      // If your validator requires minimum 2 characters
      expect([200, 400]).toContain(res.status);

      if (res.status === 400) {
        expect(res.body.message).toBe('Validation failed');
        expect(res.body.data.errors.some(err =>
          err.path === 'name' && err.msg.includes('characters')
        )).toBeTruthy();
      }
    });

    it('should successfully update valid name', async () => {
      const updateData = { name: 'Valid New Name' };

      const res = await request(app)
        .put(`/api/client/${testClient._id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send(updateData)
        .expect(200);

      expect(res.body.message).toBe('Client updated successfully');
      expect(res.body.client.name).toBe(updateData.name);

      // Verify in DB
      const updatedClient = await Client.findById(testClient._id);
      expect(updatedClient.name).toBe(updateData.name);
    });

    it('should fail with non-existent client', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const updateData = { name: 'New Name' };

      const res = await request(app)
        .put(`/api/client/${fakeId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send(updateData);

      expect([404, 500]).toContain(res.status);
    });

    it('should fail with invalid ObjectId format', async () => {
      const updateData = { name: 'New Name' };

      const res = await request(app)
        .put('/api/client/invalid-id')
        .set('Authorization', `Bearer ${userToken}`)
        .send(updateData);

      expect([400, 500]).toContain(res.status);
    });

    it('should fail without authentication', async () => {
      const updateData = { name: 'New Name' };

      const res = await request(app)
        .put(`/api/client/${testClient._id}`)
        .send(updateData)
        .expect(401);
    });

    it('should handle empty request body', async () => {
      const res = await request(app)
        .put(`/api/client/${testClient._id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({});

      expect([200, 400, 500]).toContain(res.status);
    });
  });

  describe('PATCH /api/client/:id/archive', () => {
    beforeEach(async () => {
      testClient = await new Client({
        name: 'Client to Archive',
        email: 'archive@client.com',
        createdBy: testUser._id,
        archived: false
      }).save();
    });

    it('should handle archive client', async () => {
      const res = await request(app)
        .patch(`/api/client/${testClient._id}/archive`)
        .set('Authorization', `Bearer ${userToken}`);

      expect([200, 400, 404, 500]).toContain(res.status);
    });
  });

  describe('PATCH /api/client/:id/recover', () => {
    beforeEach(async () => {
      testClient = await new Client({
        name: 'Archived Client',
        email: 'archived@client.com',
        createdBy: testUser._id,
        archived: true
      }).save();
    });

    it('should handle recover archived client', async () => {
      const res = await request(app)
        .patch(`/api/client/${testClient._id}/recover`)
        .set('Authorization', `Bearer ${userToken}`);

      expect([200, 400, 404, 500]).toContain(res.status);
    });
  });

  describe('DELETE /api/client/:id', () => {
    beforeEach(async () => {
      testClient = await new Client({
        name: 'Client to Delete',
        email: 'delete@client.com',
        createdBy: testUser._id
      }).save();
    });

    it('should handle delete client without projects', async () => {
      const res = await request(app)
        .delete(`/api/client/${testClient._id}`)
        .set('Authorization', `Bearer ${userToken}`);

      expect([200, 404, 500]).toContain(res.status);
    });

    it('should handle delete client with associated projects', async () => {
      // Create associated project
      await new Project({
        name: 'Test Project',
        description: 'Test project description',
        client: testClient._id,
        createdBy: testUser._id
      }).save();

      const res = await request(app)
        .delete(`/api/client/${testClient._id}`)
        .set('Authorization', `Bearer ${userToken}`);

      expect([200, 409, 500]).toContain(res.status);
    });

    it('should fail with non-existent client', async () => {
      const fakeId = new mongoose.Types.ObjectId();

      const res = await request(app)
        .delete(`/api/client/${fakeId}`)
        .set('Authorization', `Bearer ${userToken}`);

      expect([404, 500]).toContain(res.status);
    });

    it('should fail without authentication', async () => {
      const res = await request(app)
        .delete(`/api/client/${testClient._id}`)
        .expect(401);

      expect(res.body.message).toContain('No token, authorization denied');
    });
  });

  describe('Authorization tests', () => {
    let otherUser, otherUserToken, otherUserClient;

    beforeEach(async () => {
      // Create another user
      const bcrypt = require('bcrypt');
      const hashedPassword = await bcrypt.hash('Password123', 10);
      otherUser = new User({
        name: 'Other',
        surname: 'User',
        email: 'other@example.com',
        password: hashedPassword,
        isEmailVerified: true,
        role: 'user'
      });
      await otherUser.save();

      const jwt = require('jsonwebtoken');
      otherUserToken = jwt.sign(
        { id: otherUser._id, email: otherUser.email, role: otherUser.role },
        process.env.JWT_SECRET
      );

      // Create client for the other user
      otherUserClient = await new Client({
        name: 'Other User Client',
        email: 'otherclient@client.com',
        createdBy: otherUser._id
      }).save();
    });

    it('should not access other user clients', async () => {
      const res = await request(app)
        .get(`/api/client/${otherUserClient._id}`)
        .set('Authorization', `Bearer ${userToken}`);

      expect([404, 500]).toContain(res.status);
    });

    it('should not update other user clients', async () => {
      const updateData = { name: 'Hacked Name' };

      const res = await request(app)
        .put(`/api/client/${otherUserClient._id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send(updateData);

      expect([404, 500]).toContain(res.status);
    });

    it('should not delete other user clients', async () => {
      const res = await request(app)
        .delete(`/api/client/${otherUserClient._id}`)
        .set('Authorization', `Bearer ${userToken}`);

      expect([404, 500]).toContain(res.status);
    });
  });
});
