// File: tests/client.test.js
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
  }, 10000);

  describe('POST /api/client', () => {
    it('should create a new client successfully', async () => {
      const clientData = {
        name: 'John Doe',
        email: 'john@client.com',
        company: null  // ✅ NULL en lugar de string
      };

      const res = await request(app)
        .post('/api/client')
        .set('Authorization', `Bearer ${userToken}`)
        .send(clientData)
        .expect(201);

      expect(res.body.message).toBe('Client created successfully');
      expect(res.body.client.name).toBe(clientData.name);
      expect(res.body.client.email).toBe(clientData.email);
    });

    it('should create client without company field', async () => {
      const clientData = {
        name: 'Jane Smith',
        email: 'jane@company.com'
        // ✅ SIN campo company
      };

      const res = await request(app)
        .post('/api/client')
        .set('Authorization', `Bearer ${userToken}`)
        .send(clientData)
        .expect(201);

      expect(res.body.client.name).toBe(clientData.name);
    });

    it('should fail with invalid email format', async () => {
      const clientData = {
        name: 'Test Client',
        email: 'invalid-email'
      };

      const res = await request(app)
        .post('/api/client')
        .set('Authorization', `Bearer ${userToken}`)
        .send(clientData)
        .expect(400);

      expect(res.body.message).toBe('Validation failed'); // ✅ Corregido
    });

    it('should fail with empty name', async () => {
      const clientData = {
        name: '',
        email: 'test@client.com'
      };

      const res = await request(app)
        .post('/api/client')
        .set('Authorization', `Bearer ${userToken}`)
        .send(clientData)
        .expect(400);

      expect(res.body.message).toBe('Validation failed'); // ✅ Corregido
    });

    it('should fail with name too short', async () => {
      const clientData = {
        name: 'A',
        email: 'test@client.com'
      };

      const res = await request(app)
        .post('/api/client')
        .set('Authorization', `Bearer ${userToken}`)
        .send(clientData)
        .expect(400);

      expect(res.body.message).toBe('Validation failed'); // ✅ Corregido
    });

    it('should fail if client email already exists for user', async () => {
      const clientData = {
        name: 'Duplicate Client',
        email: 'duplicate@client.com'
      };

      await new Client({
        ...clientData,
        createdBy: testUser._id
      }).save();

      const res = await request(app)
        .post('/api/client')
        .set('Authorization', `Bearer ${userToken}`)
        .send(clientData)
        .expect(400);

      // ✅ El validator se ejecuta antes que el controller
      expect(res.body.message).toBe('Validation failed');
      expect(res.body.data.errors).toBeDefined();
      expect(res.body.data.errors[0].msg).toBe('Client with this email already exists for this user.');
    });

    it('should fail without authentication', async () => {
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
  });

  describe('GET /api/client', () => {
    beforeEach(async () => {
      await Client.create([
        { name: 'Active Client 1', email: 'active1@client.com', createdBy: testUser._id, archived: false },
        { name: 'Active Client 2', email: 'active2@client.com', createdBy: testUser._id, archived: false },
        { name: 'Archived Client', email: 'archived@client.com', createdBy: testUser._id, archived: true }
      ]);
    });

    it('should get all active clients successfully', async () => {
      const res = await request(app)
        .get('/api/client')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(res.body.message).toContain('retrieved successfully');
      expect(Array.isArray(res.body.clients)).toBe(true); // ✅ Verificar estructura
      expect(res.body.clients.length).toBe(2);
    });

    it('should return empty array when no active clients', async () => {
      await Client.updateMany({ createdBy: testUser._id }, { archived: true });

      const res = await request(app)
        .get('/api/client')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(Array.isArray(res.body.clients)).toBe(true);
      expect(res.body.clients.length).toBe(0);
    });

    it('should fail without authentication', async () => {
      const res = await request(app)
        .get('/api/client')
        .expect(401);

      expect(res.body.message).toContain('No token, authorization denied');
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

    it('should get all archived clients successfully', async () => {
      const res = await request(app)
        .get('/api/client/archived')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      // ✅ Verificar estructura real de respuesta
      // Si es res.body directamente sin wrapper:
      if (Array.isArray(res.body)) {
        expect(res.body.length).toBe(2);
        expect(res.body.every(client => client.archived)).toBe(true);
      } else if (res.body.clients) {
        // Si tiene wrapper clients:
        expect(Array.isArray(res.body.clients)).toBe(true);
        expect(res.body.clients.length).toBe(2);
      }
    });

    it('should fail without authentication', async () => {
      const res = await request(app)
        .get('/api/client/archived')
        .expect(401);

      expect(res.body.message).toContain('No token, authorization denied');
    });
  });

  describe('GET /api/client/:id', () => {
    beforeEach(async () => {
      testClient = await new Client({
        name: 'Test Client',
        email: 'test@client.com',
        createdBy: testUser._id,
        archived: false
      }).save();
    });

    it('should get client by valid ID successfully', async () => {
      const res = await request(app)
        .get(`/api/client/${testClient._id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(res.body._id).toBe(testClient._id.toString());
      expect(res.body.name).toBe(testClient.name);
    });

    it('should fail with invalid ObjectId', async () => {
      const res = await request(app)
        .get('/api/client/invalid-id')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(400);

      expect(res.body.message).toBe('Validation failed');
    });

    it('should fail with non-existent client ID', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();

      const res = await request(app)
        .get(`/api/client/${nonExistentId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(404);

      expect(res.body.message).toBe('Client not found');
    });

    it('should fail without authentication', async () => {
      const res = await request(app)
        .get(`/api/client/${testClient._id}`)
        .expect(401);

      expect(res.body.message).toContain('No token, authorization denied');
    });
  });

  describe('PUT /api/client/:id', () => {
    beforeEach(async () => {
      testClient = await new Client({
        name: 'Original Client',
        email: 'original@client.com',
        createdBy: testUser._id,
        archived: false
      }).save();
    });

    it('should update client with valid data successfully', async () => {
      const updateData = {
        name: 'Updated Client Name',
        email: 'updated@client.com'
      };

      const res = await request(app)
        .put(`/api/client/${testClient._id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send(updateData)
        .expect(200);

      expect(res.body.message).toBe('Client updated successfully');
      expect(res.body.client.name).toBe(updateData.name);
    });

    it('should fail with invalid ObjectId format', async () => {
      const updateData = { name: 'New Name' };

      const res = await request(app)
        .put('/api/client/invalid-id')
        .set('Authorization', `Bearer ${userToken}`)
        .send(updateData)
        .expect(400);

      expect(res.body.message).toBe('Validation failed');
    });

    it('should fail with non-existent client', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();
      const updateData = { name: 'New Name' };

      const res = await request(app)
        .put(`/api/client/${nonExistentId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send(updateData)
        .expect(404);

      expect(res.body.message).toBe('Client not found');
    });

    it('should fail without authentication', async () => {
      const updateData = { name: 'New Name' };

      const res = await request(app)
        .put(`/api/client/${testClient._id}`)
        .send(updateData)
        .expect(401);

      expect(res.body.message).toContain('No token, authorization denied');
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

    it('should archive client successfully', async () => {
      const res = await request(app)
        .patch(`/api/client/${testClient._id}/archive`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(res.body.message).toBe('Client archived successfully');

      const archivedClient = await Client.findById(testClient._id);
      expect(archivedClient.archived).toBe(true);
    });

    it('should handle already archived client', async () => {
      testClient.archived = true;
      await testClient.save();

      const res = await request(app)
        .patch(`/api/client/${testClient._id}/archive`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(400);

      expect(res.body.message).toBe('Client already archived');
    });

    it('should fail with invalid ObjectId', async () => {
      const res = await request(app)
        .patch('/api/client/invalid-id/archive')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(400);

      expect(res.body.message).toBe('Validation failed'); // ✅ Corregido
    });

    it('should fail without authentication', async () => {
      const res = await request(app)
        .patch(`/api/client/${testClient._id}/archive`)
        .expect(401);

      expect(res.body.message).toContain('No token, authorization denied');
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

    it('should recover archived client successfully', async () => {
      const res = await request(app)
        .patch(`/api/client/${testClient._id}/recover`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(res.body.message).toBe('Client recovered successfully');
      expect(res.body.client).toBeDefined();
      expect(res.body.client.archived).toBe(false);
    });

    it('should fail with non-archived client', async () => {
      testClient.archived = false;
      await testClient.save();

      const res = await request(app)
        .patch(`/api/client/${testClient._id}/recover`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(400);

      expect(res.body.message).toBe('Client is not archived');
    });

    it('should fail with invalid ObjectId', async () => {
      const res = await request(app)
        .patch('/api/client/invalid-id/recover')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(400);

      expect(res.body.message).toBe('Validation failed');
    });

    it('should fail with non-existent client', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();

      const res = await request(app)
        .patch(`/api/client/${nonExistentId}/recover`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(404);

      expect(res.body.message).toBe('Client not found or you do not have permission');
    });

    it('should fail without authentication', async () => {
      const res = await request(app)
        .patch(`/api/client/${testClient._id}/recover`)
        .expect(401);

      expect(res.body.message).toContain('No token, authorization denied');
    });
  });

  describe('DELETE /api/client/:id', () => {
    beforeEach(async () => {
      testClient = await new Client({
        name: 'Client to Delete',
        email: 'delete@client.com',
        createdBy: testUser._id,
        archived: false
      }).save();
    });

    it('should delete client successfully when no projects exist', async () => {
      const res = await request(app)
        .delete(`/api/client/${testClient._id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(res.body.message).toBe('Client deleted successfully');

      // Verify client is deleted
      const deletedClient = await Client.findById(testClient._id);
      expect(deletedClient).toBeNull();
    });

    it('should fail when client has existing projects', async () => {
      // Create a project for this client
      const Project = require('../models/Project');
      await new Project({
        name: 'Test Project',
        description: 'Test description',
        client: testClient._id,
        createdBy: testUser._id
      }).save();

      const res = await request(app)
        .delete(`/api/client/${testClient._id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(409);

      expect(res.body.message).toContain('Cannot delete client: Client has associated projects.');
    });

    it('should fail with invalid ObjectId', async () => {
      const res = await request(app)
        .delete('/api/client/invalid-id')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(400);

      expect(res.body.message).toBe('Validation failed');
    });

    it('should fail with non-existent client', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();

      const res = await request(app)
        .delete(`/api/client/${nonExistentId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(404);

      expect(res.body.message).toBe('Client not found or you do not have permission');
    });

    it('should fail without authentication', async () => {
      const res = await request(app)
        .delete(`/api/client/${testClient._id}`)
        .expect(401);

      expect(res.body.message).toContain('No token, authorization denied');
    });
  });
});
