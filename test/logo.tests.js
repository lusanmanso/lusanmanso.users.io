const request = require('supertest');
const app = require('../server');
const User = require('../models/User');
const fs = require('fs');
const path = require('path');

jest.mock('../models/User');
jest.mock('fs');
jest.mock('path');

describe('Logo API Endpoints', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  // Test for uploadLogo
  describe('POST /api/user/logo', () => {
    it('should return 400 if no file is uploaded', async () => {
      // Arrange
      const userId = 'mockUserId';
      // Act
      const response = await request(app)
        .post('/api/user/logo')
        .set('Authorization', `Bearer mockToken`)
        // No file attached
        .set('x-test-user-id', userId); // Mock auth middleware for testing

      // Assert
      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Not file uploaded');
    });

    it('should return 404 if user is not found', async () => {
      // Arrange
      const userId = 'mockUserId';
      User.findById.mockResolvedValue(null); // User not found
      const mockFile = {
        filename: 'test-logo.png',
        path: '/tmp/test-logo.png'
      };
      
      // Act
      const response = await request(app)
        .post('/api/user/logo')
        .set('Authorization', `Bearer mockToken`)
        .set('x-test-user-id', userId)
        .attach('logo', Buffer.from('mock-image'), 'test-logo.png'); // Mock file upload
      
      // Assert
      expect(response.status).toBe(404);
      expect(response.body.message).toContain('User not found');
      expect(fs.unlinkSync).toHaveBeenCalledWith(expect.any(String));
    });

    it('should delete old logo if one exists and upload new logo', async () => {
      // Arrange
      const userId = 'mockUserId';
      const oldLogo = {
        url: 'http://example.com/old-logo.png',
        filename: 'old-logo.png'
      };
      const user = {
        _id: userId,
        logo: oldLogo,
        save: jest.fn().mockResolvedValue(true)
      };
      User.findById.mockResolvedValue(user);
      path.join.mockReturnValue('/mock/path/to/old-logo.png');
      fs.existsSync.mockReturnValue(true);
      fs.unlinkSync.mockImplementation(() => {});
      
      // Act
      const response = await request(app)
        .post('/api/user/logo')
        .set('Authorization', `Bearer mockToken`)
        .set('x-test-user-id', userId)
        .attach('logo', Buffer.from('mock-image'), 'new-logo.png');
      
      // Assert
      expect(fs.existsSync).toHaveBeenCalled();
      expect(fs.unlinkSync).toHaveBeenCalledWith('/mock/path/to/old-logo.png');
      expect(user.save).toHaveBeenCalled();
      expect(response.status).toBe(200);
      expect(response.body.message).toContain('Logo uploaded successfully');
      expect(response.body.logo).toBeDefined();
    });

    it('should upload logo successfully for new user without previous logo', async () => {
      // Arrange
      const userId = 'mockUserId';
      const user = {
        _id: userId,
        logo: null,
        save: jest.fn().mockResolvedValue(true)
      };
      User.findById.mockResolvedValue(user);
      
      // Act
      const response = await request(app)
        .post('/api/user/logo')
        .set('Authorization', `Bearer mockToken`)
        .set('x-test-user-id', userId)
        .attach('logo', Buffer.from('mock-image'), 'new-logo.png');
      
      // Assert
      expect(user.save).toHaveBeenCalled();
      expect(response.status).toBe(200);
      expect(response.body.message).toContain('Logo uploaded successfully');
      expect(response.body.logo).toBeDefined();
      expect(response.body.logo.url).toBeDefined();
      expect(response.body.logo.filename).toBeDefined();
    });

    it('should handle server error gracefully', async () => {
      // Arrange
      const userId = 'mockUserId';
      User.findById.mockRejectedValue(new Error('Database error'));
      
      // Act
      const response = await request(app)
        .post('/api/user/logo')
        .set('Authorization', `Bearer mockToken`)
        .set('x-test-user-id', userId)
        .attach('logo', Buffer.from('mock-image'), 'logo.png');
      
      // Assert
      expect(response.status).toBe(500);
      expect(response.body.message).toContain('Server error');
    });
  });
});
