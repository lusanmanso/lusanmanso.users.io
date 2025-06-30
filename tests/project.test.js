// File: tests/project.test.js
const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../server');
const User = require('../models/User');
const Client = require('../models/Client');
const Project = require('../models/Project');

describe('Project API Tests', () => {
  let testUser, userToken, testClient, testProject;

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

    // Create test client
    testClient = new Client({
      name: 'Test Client',
      email: 'client@test.com',
      createdBy: testUser._id,
      archived: false
    });
    await testClient.save();
  }, 10000);

  describe('POST /api/project', () => {
    it('should create a new project successfully', async () => {
      const projectData = {
        name: 'Test Project',
        description: 'A test project description',
        client: testClient._id
      };

      const res = await request(app)
        .post('/api/project')
        .set('Authorization', `Bearer ${userToken}`)
        .send(projectData)
        .expect(201);

      expect(res.body.message).toBe('Project created successfully');
      expect(res.body.project).toBeDefined();
      expect(res.body.project.name).toBe(projectData.name);
      expect(res.body.project.description).toBe(projectData.description);
      expect(res.body.project.client._id).toBe(testClient._id.toString());
      expect(res.body.project.archived).toBe(false);
      expect(res.body.project.createdBy).toBe(testUser._id.toString());
    });

    it('should fail with invalid client ID', async () => {
      const projectData = {
        name: 'Test Project',
        description: 'A test project description',
        client: new mongoose.Types.ObjectId()
      };

      const res = await request(app)
        .post('/api/project')
        .set('Authorization', `Bearer ${userToken}`)
        .send(projectData)
        .expect(404);

      expect(res.body.message).toBe('Client not found or you do not have permission to assign it.');
    });

    it('should fail with empty name', async () => {
      const projectData = {
        name: '',
        description: 'A test project description',
        client: testClient._id
      };

      const res = await request(app)
        .post('/api/project')
        .set('Authorization', `Bearer ${userToken}`)
        .send(projectData)
        .expect(400);

      expect(res.body.message).toBe('Validation errors');
    });

    it('should fail with name too short', async () => {
      const projectData = {
        name: 'Ab',
        description: 'A test project description',
        client: testClient._id
      };

      const res = await request(app)
        .post('/api/project')
        .set('Authorization', `Bearer ${userToken}`)
        .send(projectData)
        .expect(400);

      expect(res.body.message).toBe('Validation errors');
    });

    it('should fail with description too short', async () => {
      const projectData = {
        name: 'Test Project',
        description: 'Short',
        client: testClient._id
      };

      const res = await request(app)
        .post('/api/project')
        .set('Authorization', `Bearer ${userToken}`)
        .send(projectData)
        .expect(400);

      expect(res.body.message).toBe('Validation errors');
    });

    it('should fail with missing client', async () => {
      const projectData = {
        name: 'Test Project',
        description: 'A test project description'
      };

      const res = await request(app)
        .post('/api/project')
        .set('Authorization', `Bearer ${userToken}`)
        .send(projectData)
        .expect(400);

      expect(res.body.message).toBe('Validation errors');
    });

    it('should fail if project name already exists for same client', async () => {
      const projectData = {
        name: 'Duplicate Project',
        description: 'A test project description',
        client: testClient._id
      };

      // Create project first
      await new Project({
        ...projectData,
        createdBy: testUser._id
      }).save();

      const res = await request(app)
        .post('/api/project')
        .set('Authorization', `Bearer ${userToken}`)
        .send(projectData)
        .expect(409);

      expect(res.body.message).toBe('A project with this name already exists for this client.');
    });

    it('should fail without authentication', async () => {
      const projectData = {
        name: 'Test Project',
        description: 'A test project description',
        client: testClient._id
      };

      const res = await request(app)
        .post('/api/project')
        .send(projectData)
        .expect(401);

      expect(res.body.message).toBe('No token, authorization denied');
    });

    it('should fail with invalid token', async () => {
      const projectData = {
        name: 'Test Project',
        description: 'A test project description',
        client: testClient._id
      };

      const res = await request(app)
        .post('/api/project')
        .set('Authorization', 'Bearer invalid-token')
        .send(projectData)
        .expect(401);

      expect(res.body.message).toBe('Invalid token');
    });
  });

  describe('GET /api/project', () => {
    beforeEach(async () => {
      await Project.create([
        { name: 'Active Project 1', description: 'Description 1', client: testClient._id, createdBy: testUser._id, archived: false },
        { name: 'Active Project 2', description: 'Description 2', client: testClient._id, createdBy: testUser._id, archived: false },
        { name: 'Archived Project', description: 'Description 3', client: testClient._id, createdBy: testUser._id, archived: true }
      ]);
    });

    it('should get all active projects successfully', async () => {
      const res = await request(app)
        .get('/api/project')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(2); // Only active projects
      expect(res.body.every(project => !project.archived)).toBe(true);
      expect(res.body.every(project => project.createdBy === testUser._id.toString())).toBe(true);
      expect(res.body.every(project => project.client)).toBeDefined();
    });

    it('should return empty array when no active projects', async () => {
      // Archive all projects
      await Project.updateMany({ createdBy: testUser._id }, { archived: true });

      const res = await request(app)
        .get('/api/project')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(0);
    });

    it('should not return other users projects', async () => {
      // Create another user's project
      const otherUser = new User({
        name: 'Other', surname: 'User', email: 'other@test.com',
        password: await require('bcrypt').hash('Pass123', 10), isEmailVerified: true
      });
      await otherUser.save();

      const otherClient = new Client({
        name: 'Other Client',
        email: 'other@client.com',
        createdBy: otherUser._id,
        archived: false
      });
      await otherClient.save();

      await new Project({
        name: 'Other User Project',
        description: 'Other description',
        client: otherClient._id,
        createdBy: otherUser._id,
        archived: false
      }).save();

      const res = await request(app)
        .get('/api/project')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(res.body.length).toBe(2); // Still only user's projects
      expect(res.body.every(project => project.createdBy === testUser._id.toString())).toBe(true);
    });

    it('should fail without authentication', async () => {
      const res = await request(app)
        .get('/api/project')
        .expect(401);

      expect(res.body.message).toBe('No token, authorization denied');
    });

    it('should fail with invalid token', async () => {
      const res = await request(app)
        .get('/api/project')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(res.body.message).toBe('Invalid token');
    });
  });

  describe('GET /api/project/archived', () => {
    beforeEach(async () => {
      await Project.create([
        { name: 'Active Project', description: 'Description 1', client: testClient._id, createdBy: testUser._id, archived: false },
        { name: 'Archived Project 1', description: 'Description 2', client: testClient._id, createdBy: testUser._id, archived: true },
        { name: 'Archived Project 2', description: 'Description 3', client: testClient._id, createdBy: testUser._id, archived: true }
      ]);
    });

    it('should get all archived projects successfully', async () => {
      const res = await request(app)
        .get('/api/project/archived')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(2); // Only archived projects
      expect(res.body.every(project => project.archived)).toBe(true);
      expect(res.body.every(project => project.createdBy === testUser._id.toString())).toBe(true);
    });

    it('should return empty array when no archived projects', async () => {
      // Make all projects active
      await Project.updateMany({ createdBy: testUser._id }, { archived: false });

      const res = await request(app)
        .get('/api/project/archived')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(0);
    });

    it('should fail without authentication', async () => {
      const res = await request(app)
        .get('/api/project/archived')
        .expect(401);

      expect(res.body.message).toBe('No token, authorization denied');
    });
  });

  describe('GET /api/project/:id', () => {
    beforeEach(async () => {
      testProject = await new Project({
        name: 'Test Project',
        description: 'Test description',
        client: testClient._id,
        createdBy: testUser._id,
        archived: false
      }).save();
    });

    it('should get project by valid ID successfully', async () => {
      const res = await request(app)
        .get(`/api/project/${testProject._id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(res.body._id).toBe(testProject._id.toString());
      expect(res.body.name).toBe('Test Project');
      expect(res.body.description).toBe('Test description');
      expect(res.body.client._id).toBe(testClient._id.toString());
      expect(res.body.createdBy).toBeDefined();
      expect(res.body.archived).toBe(false);
    });

    it('should fail with invalid ObjectId format', async () => {
      const res = await request(app)
        .get('/api/project/invalid-id')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(400);

      expect(res.body.message).toBe('Invalid project ID format');
    });

    it('should fail with non-existent project ID', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .get(`/api/project/${nonExistentId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(404);

      expect(res.body.message).toBe('Project not found or you do not have permission to view it');
    });

    it('should fail accessing other users project', async () => {
      // Create another user's project
      const otherUser = new User({
        name: 'Other', surname: 'User', email: 'other@test.com',
        password: await require('bcrypt').hash('Pass123', 10), isEmailVerified: true
      });
      await otherUser.save();

      const otherProject = await new Project({
        name: 'Other Project',
        description: 'Other description',
        client: testClient._id,
        createdBy: otherUser._id,
        archived: false
      }).save();

      const res = await request(app)
        .get(`/api/project/${otherProject._id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(404);

      expect(res.body.message).toBe('Project not found or you do not have permission to view it');
    });

    it('should fail without authentication', async () => {
      const res = await request(app)
        .get(`/api/project/${testProject._id}`)
        .expect(401);

      expect(res.body.message).toBe('No token, authorization denied');
    });
  });

  describe('PUT /api/project/:id', () => {
    beforeEach(async () => {
      testProject = await new Project({
        name: 'Original Project',
        description: 'Original description',
        client: testClient._id,
        createdBy: testUser._id,
        archived: false
      }).save();
    });

    it('should update project successfully', async () => {
      const updateData = {
        name: 'Updated Project',
        description: 'Updated description',
        client: testClient._id
      };

      const res = await request(app)
        .put(`/api/project/${testProject._id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send(updateData)
        .expect(200);

      expect(res.body.message).toBe('Project updated successfully');
      expect(res.body.project.name).toBe(updateData.name);
      expect(res.body.project.description).toBe(updateData.description);
      expect(res.body.project._id).toBe(testProject._id.toString());
    });

    it('should fail with invalid ObjectId format', async () => {
      const updateData = {
        name: 'Updated Project',
        description: 'Updated description',
        client: testClient._id
      };

      const res = await request(app)
        .put('/api/project/invalid-id')
        .set('Authorization', `Bearer ${userToken}`)
        .send(updateData)
        .expect(400);

      expect(res.body.message).toBe('Invalid project ID format');
    });

    it('should fail with non-existent project ID', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();
      const updateData = {
        name: 'Updated Project',
        description: 'Updated description',
        client: testClient._id
      };

      const res = await request(app)
        .put(`/api/project/${nonExistentId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send(updateData)
        .expect(404);

      expect(res.body.message).toBe('Project not found or you do not have permission to update it');
    });

    it('should fail with empty name', async () => {
      const updateData = {
        name: '',
        description: 'Updated description',
        client: testClient._id
      };

      const res = await request(app)
        .put(`/api/project/${testProject._id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send(updateData)
        .expect(400);

      expect(res.body.message).toBe('Validation errors');
    });

    it('should fail with invalid client ID', async () => {
      const updateData = {
        name: 'Updated Project',
        description: 'Updated description',
        client: new mongoose.Types.ObjectId()
      };

      const res = await request(app)
        .put(`/api/project/${testProject._id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send(updateData)
        .expect(404);

      expect(res.body.message).toBe('New client not found or you do not have permission to assign it.');
    });

    it('should fail with duplicate name for same client', async () => {
      // Create another project with different name
      await new Project({
        name: 'Existing Project',
        description: 'Description',
        client: testClient._id,
        createdBy: testUser._id
      }).save();

      const updateData = {
        name: 'Existing Project', // Try to use existing name
        description: 'Updated description',
        client: testClient._id
      };

      const res = await request(app)
        .put(`/api/project/${testProject._id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send(updateData)
        .expect(409);

      expect(res.body.message).toBe('Another project with this name already exists for this client.');
    });

    it('should fail without authentication', async () => {
      const updateData = {
        name: 'Updated Project',
        description: 'Updated description',
        client: testClient._id
      };

      const res = await request(app)
        .put(`/api/project/${testProject._id}`)
        .send(updateData)
        .expect(401);

      expect(res.body.message).toBe('No token, authorization denied');
    });
  });

  describe('PATCH /api/project/archive/:id', () => {
    beforeEach(async () => {
      testProject = await new Project({
        name: 'Active Project',
        description: 'Active description',
        client: testClient._id,
        createdBy: testUser._id,
        archived: false
      }).save();
    });

    it('should archive project successfully', async () => {
      const res = await request(app)
        .patch(`/api/project/archive/${testProject._id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(res.body.message).toBe('Project archived successfully');
    });

    it('should fail with invalid ObjectId format', async () => {
      const res = await request(app)
        .patch('/api/project/archive/invalid-id')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(400);

      expect(res.body.message).toBe('Invalid project ID format');
    });

    it('should fail with non-existent project ID', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .patch(`/api/project/archive/${nonExistentId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(404);

      expect(res.body.message).toBe('Project not found or you do not have permission to archive it');
    });

    it('should return 200 when archiving already archived project', async () => {
      await Project.findByIdAndUpdate(testProject._id, { archived: true });

      const res = await request(app)
        .patch(`/api/project/archive/${testProject._id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(res.body.message).toBe('Project is already archived');
    });

    it('should fail without authentication', async () => {
      const res = await request(app)
        .patch(`/api/project/archive/${testProject._id}`)
        .expect(401);

      expect(res.body.message).toBe('No token, authorization denied');
    });
  });

  describe('PATCH /api/project/recover/:id', () => {
    beforeEach(async () => {
      testProject = await new Project({
        name: 'Archived Project',
        description: 'Archived description',
        client: testClient._id,
        createdBy: testUser._id,
        archived: true
      }).save();
    });

    it('should recover archived project successfully', async () => {
      const res = await request(app)
        .patch(`/api/project/recover/${testProject._id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(res.body.message).toBe('Project recovered successfully');
      expect(res.body.project.archived).toBe(false);
      expect(res.body.project._id).toBe(testProject._id.toString());
    });

    it('should fail with invalid ObjectId format', async () => {
      const res = await request(app)
        .patch('/api/project/recover/invalid-id')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(400);

      expect(res.body.message).toBe('Invalid project ID format');
    });

    it('should fail with non-existent project ID', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .patch(`/api/project/recover/${nonExistentId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(404);

      expect(res.body.message).toBe('Project not found or you do not have permission');
    });

    it('should fail recovering already active project', async () => {
      await Project.findByIdAndUpdate(testProject._id, { archived: false });

      const res = await request(app)
        .patch(`/api/project/recover/${testProject._id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(400);

      expect(res.body.message).toBe('Project is not archived');
    });

    it('should fail without authentication', async () => {
      const res = await request(app)
        .patch(`/api/project/recover/${testProject._id}`)
        .expect(401);

      expect(res.body.message).toBe('No token, authorization denied');
    });
  });

  describe('DELETE /api/project/:id', () => {
    beforeEach(async () => {
      testProject = await new Project({
        name: 'Project to Delete',
        description: 'Description to delete',
        client: testClient._id,
        createdBy: testUser._id,
        archived: false
      }).save();
    });

    it('should delete project successfully', async () => {
      const res = await request(app)
        .delete(`/api/project/${testProject._id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(res.body.message).toBe('Project deleted permanently');

      // Verify project is completely removed
      const deletedProject = await Project.findById(testProject._id);
      expect(deletedProject).toBeNull();
    });

    it('should fail with invalid ObjectId format', async () => {
      const res = await request(app)
        .delete('/api/project/invalid-id')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(400);

      expect(res.body.message).toBe('Invalid project ID format');
    });

    it('should fail with non-existent project ID', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .delete(`/api/project/${nonExistentId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(404);

      expect(res.body.message).toBe('Project not found or you do not have permission to delete it');
    });

    it('should fail deleting other users project', async () => {
      // Create another user's project
      const otherUser = new User({
        name: 'Other', surname: 'User', email: 'other@test.com',
        password: await require('bcrypt').hash('Pass123', 10), isEmailVerified: true
      });
      await otherUser.save();

      const otherProject = await new Project({
        name: 'Other Project',
        description: 'Other description',
        client: testClient._id,
        createdBy: otherUser._id,
        archived: false
      }).save();

      const res = await request(app)
        .delete(`/api/project/${otherProject._id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(404);

      expect(res.body.message).toBe('Project not found or you do not have permission to delete it');
    });

    it('should fail without authentication', async () => {
      const res = await request(app)
        .delete(`/api/project/${testProject._id}`)
        .expect(401);

      expect(res.body.message).toBe('No token, authorization denied');
    });
  });
});
