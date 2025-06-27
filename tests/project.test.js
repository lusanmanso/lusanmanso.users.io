const request = require('supertest');
const app = require('../server');
const Project = require('../models/Project');
const Client = require('../models/Client');
const { ApiError } = require('../middleware/handleError');
const { validationResult } = require('express-validator');

describe('Project API Endpoints', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  // Test for createProject
  describe('POST /api/project', () => {
    it('should return 400 if validation errors exist', async () => {
      // Arrange - express-validator will handle this
      validationResult.mockReturnValue({ isEmpty: () => false, array: () => ['err'] });

      // Act
      const response = await request(app)
        .post('/api/project')
        .set('Authorization', 'Bearer mockToken')
        .set('x-test-user-id', 'mockUserId')
        .send({ name: '', description: '', client: 'invalidClientId' });

      // Assert
      expect(response.status).toBe(400);
      expect(response.body.errors).toBeDefined();
    });

    it('should return 404 if client is not found', async () => {
      // Arrange
      const userId = 'mockUserId';
      const clientId = 'mockClientId';
      validationResult.mockReturnValue({ isEmpty: () => true });
      Client.findOne.mockResolvedValue(null); // Client not found

      // Act
      const response = await request(app)
        .post('/api/project')
        .set('Authorization', 'Bearer mockToken')
        .set('x-test-user-id', userId)
        .send({ name: 'Test Project', description: 'Test Description', client: clientId });

      // Assert
      expect(response.status).toBe(404);
      expect(response.body.message).toContain('Client not found');
    });

    it('should return 409 if project with same name already exists for client', async () => {
      // Arrange
      const userId = 'mockUserId';
      const clientId = 'mockClientId';
      validationResult.mockReturnValue({ isEmpty: () => true });
      Client.findOne.mockResolvedValue({ _id: clientId }); // Client exists
      Project.findOne.mockResolvedValue({ _id: 'existingProjectId' }); // Project already exists

      // Act
      const response = await request(app)
        .post('/api/project')
        .set('Authorization', 'Bearer mockToken')
        .set('x-test-user-id', userId)
        .send({ name: 'Existing Project', description: 'Test Description', client: clientId });

      // Assert
      expect(response.status).toBe(409);
      expect(response.body.message).toContain('already exists');
    });

    it('should create project successfully (201)', async () => {
      // Arrange
      const userId = 'mockUserId';
      const clientId = 'mockClientId';
      const projectData = {
        name: 'New Project',
        description: 'Project Description',
        client: clientId,
        createdBy: userId
      };

      validationResult.mockReturnValue({ isEmpty: () => true });
      Client.findOne.mockResolvedValue({ _id: clientId }); // Client exists
      Project.findOne.mockResolvedValue(null); // No existing project

      const saveMock = jest.fn().mockResolvedValue({ _id: 'newProjectId', ...projectData });
      Project.prototype.save = saveMock;

      Project.findById = jest.fn().mockResolvedValue({
        _id: 'newProjectId',
        ...projectData,
        populate: jest.fn().mockReturnThis(),
        client: { _id: clientId, name: 'Test Client', email: 'client@test.com' }
      });

      // Act
      const response = await request(app)
        .post('/api/project')
        .set('Authorization', 'Bearer mockToken')
        .set('x-test-user-id', userId)
        .send({ name: projectData.name, description: projectData.description, client: clientId });

      // Assert
      expect(response.status).toBe(201);
      expect(response.body.message).toContain('Project created successfully');
      expect(response.body.project).toBeDefined();
    });
  });

  // Test for getProjects
  describe('GET /api/project', () => {
    it('should return all projects for user', async () => {
      // Arrange
      const userId = 'mockUserId';
      const mockProjects = [
        { _id: 'project1', name: 'Project 1', description: 'Description 1' },
        { _id: 'project2', name: 'Project 2', description: 'Description 2' }
      ];

      Project.find = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockResolvedValue(mockProjects)
      });

      // Act
      const response = await request(app)
        .get('/api/project')
        .set('Authorization', 'Bearer mockToken')
        .set('x-test-user-id', userId);

      // Assert
      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(2);
      expect(Project.find).toHaveBeenCalledWith({ createdBy: userId, archived: false });
    });
  });

  // Test for getProjectById
  describe('GET /api/project/:id', () => {
    it('should return 404 if project not found', async () => {
      // Arrange
      const userId = 'mockUserId';
      const projectId = 'nonExistentProjectId';

      Project.findOne = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        populate: jest.fn().mockResolvedValue(null)
      });

      // Act
      const response = await request(app)
        .get(`/api/project/${projectId}`)
        .set('Authorization', 'Bearer mockToken')
        .set('x-test-user-id', userId);

      // Assert
      expect(response.status).toBe(404);
      expect(response.body.message).toContain('Project not found');
    });

    it('should return project by id', async () => {
      // Arrange
      const userId = 'mockUserId';
      const projectId = 'existingProjectId';
      const mockProject = {
        _id: projectId,
        name: 'Test Project',
        description: 'Test Description',
        client: { _id: 'clientId', name: 'Client Name', email: 'client@test.com' },
        createdBy: { _id: userId, firstName: 'Test', lastName: 'User' }
      };

      Project.findOne = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        populate: jest.fn().mockResolvedValue(mockProject)
      });

      // Act
      const response = await request(app)
        .get(`/api/project/${projectId}`)
        .set('Authorization', 'Bearer mockToken')
        .set('x-test-user-id', userId);

      // Assert
      expect(response.status).toBe(200);
      expect(response.body._id).toBe(projectId);
      expect(response.body.name).toBe('Test Project');
    });
  });

  // Test for updateProject
  describe('PUT /api/project/:id', () => {
    it('should return 400 if validation errors exist', async () => {
      // Arrange
      const userId = 'mockUserId';
      const projectId = 'projectId';
      validationResult.mockReturnValue({ isEmpty: () => false, array: () => ['err'] });

      // Act
      const response = await request(app)
        .put(`/api/project/${projectId}`)
        .set('Authorization', 'Bearer mockToken')
        .set('x-test-user-id', userId)
        .send({ name: '', description: '' });

      // Assert
      expect(response.status).toBe(400);
      expect(response.body.errors).toBeDefined();
    });

    it('should return 404 if project not found', async () => {
      // Arrange
      const userId = 'mockUserId';
      const projectId = 'nonExistentProjectId';
      validationResult.mockReturnValue({ isEmpty: () => true });
      Project.findOne.mockResolvedValue(null);

      // Act
      const response = await request(app)
        .put(`/api/project/${projectId}`)
        .set('Authorization', 'Bearer mockToken')
        .set('x-test-user-id', userId)
        .send({ name: 'Updated Project', description: 'Updated Description' });

      // Assert
      expect(response.status).toBe(404);
      expect(response.body.message).toContain('Project not found');
    });

    it('should update project successfully', async () => {
      // Arrange
      const userId = 'mockUserId';
      const projectId = 'existingProjectId';
      const mockProject = {
        _id: projectId,
        name: 'Old Name',
        description: 'Old Description',
        client: 'oldClientId',
        createdBy: userId,
        save: jest.fn().mockResolvedValue(true)
      };

      validationResult.mockReturnValue({ isEmpty: () => true });
      Project.findOne.mockResolvedValue(mockProject);
      Project.findById = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        populate: jest.fn().mockResolvedValue({
          _id: projectId,
          name: 'Updated Project',
          description: 'Updated Description',
          client: { _id: 'oldClientId', name: 'Client Name' },
          createdBy: { _id: userId }
        })
      });

      // Act
      const response = await request(app)
        .put(`/api/project/${projectId}`)
        .set('Authorization', 'Bearer mockToken')
        .set('x-test-user-id', userId)
        .send({ name: 'Updated Project', description: 'Updated Description' });

      // Assert
      expect(mockProject.save).toHaveBeenCalled();
      expect(response.status).toBe(200);
      expect(response.body.message).toContain('Project updated successfully');
      expect(response.body.project.name).toBe('Updated Project');
    });
  });

  // Test for archiveProject
  describe('PATCH /api/project/archive/:id', () => {
    it('should return 404 if project not found', async () => {
      // Arrange
      const userId = 'mockUserId';
      const projectId = 'nonExistentProjectId';
      Project.findOne.mockResolvedValue(null);

      // Act
      const response = await request(app)
        .patch(`/api/project/archive/${projectId}`)
        .set('Authorization', 'Bearer mockToken')
        .set('x-test-user-id', userId);

      // Assert
      expect(response.status).toBe(404);
      expect(response.body.message).toContain('Project not found');
    });

    it('should archive project successfully', async () => {
      // Arrange
      const userId = 'mockUserId';
      const projectId = 'existingProjectId';
      const mockProject = {
        _id: projectId,
        name: 'Project Name',
        archived: false,
        save: jest.fn().mockResolvedValue(true)
      };

      Project.findOne.mockResolvedValue(mockProject);

      // Act
      const response = await request(app)
        .patch(`/api/project/archive/${projectId}`)
        .set('Authorization', 'Bearer mockToken')
        .set('x-test-user-id', userId);

      // Assert
      expect(mockProject.archived).toBe(true);
      expect(mockProject.save).toHaveBeenCalled();
      expect(response.status).toBe(200);
      expect(response.body.message).toContain('Project archived successfully');
    });
  });
});
