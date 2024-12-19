// External imports with versions
import { MongoMemoryServer } from 'mongodb-memory-server'; // @version ^8.0.0
import { faker } from '@faker-js/faker'; // @version ^8.0.0
import supertest from 'supertest'; // @version ^6.3.3
import bcrypt from 'bcrypt'; // @version ^5.1.0

// Internal imports
import { User } from '../src/models/user.model';
import { UserController } from '../src/controllers/user.controller';
import { hashPassword } from '../src/utils/password.utils';
import { pool } from '../src/config/database.config';

// Test constants
const TEST_USER = {
  email: 'test@example.com',
  password: 'Test123!@#$',
  firstName: 'Test',
  lastName: 'User',
  role: 'user' as const,
  preferences: {
    language: 'en',
    notifications: true
  }
};

const MOCK_JWT = 'mock.jwt.token';

describe('User Model Tests', () => {
  let mongoServer: MongoMemoryServer;
  let testUser: User;

  beforeAll(async () => {
    // Set up in-memory database
    mongoServer = await MongoMemoryServer.create();
    process.env.DATABASE_URL = mongoServer.getUri();
  });

  beforeEach(async () => {
    // Clear database and create test user
    await pool.query('DELETE FROM users');
    testUser = await User.create(TEST_USER);
  });

  afterAll(async () => {
    await mongoServer.stop();
    await pool.end();
  });

  describe('User Creation', () => {
    it('should create a user with valid data', async () => {
      const userData = {
        email: faker.internet.email(),
        password: 'ValidPass123!@#',
        firstName: faker.person.firstName(),
        lastName: faker.person.lastName(),
        role: 'user' as const
      };

      const user = await User.create(userData);
      expect(user).toBeDefined();
      expect(user.id).toBeDefined();
      expect(user.email).toBe(userData.email);
      expect(await bcrypt.compare(userData.password, user.password)).toBe(true);
    });

    it('should reject user creation with invalid email', async () => {
      const invalidData = { ...TEST_USER, email: 'invalid-email' };
      await expect(User.create(invalidData)).rejects.toThrow();
    });

    it('should reject weak passwords', async () => {
      const weakPassData = { ...TEST_USER, password: 'weak' };
      await expect(User.create(weakPassData)).rejects.toThrow();
    });

    it('should enforce unique email constraint', async () => {
      await expect(User.create(TEST_USER)).rejects.toThrow();
    });
  });

  describe('Password Management', () => {
    it('should store password history', async () => {
      const newPassword = 'NewPass123!@#';
      await testUser.update({ password: newPassword });
      expect(testUser.previousPasswords.length).toBeGreaterThan(0);
    });

    it('should prevent password reuse', async () => {
      const oldPassword = testUser.password;
      await testUser.update({ password: 'TempPass123!@#' });
      await expect(
        testUser.update({ password: oldPassword })
      ).rejects.toThrow();
    });

    it('should validate password strength requirements', async () => {
      const weakPasswords = [
        'short',
        'nouppercase123!',
        'NOLOWERCASE123!',
        'NoSpecialChars123',
        'No1Numbers!!!'
      ];

      for (const password of weakPasswords) {
        await expect(
          testUser.update({ password })
        ).rejects.toThrow();
      }
    });
  });

  describe('Profile Management', () => {
    it('should update user profile', async () => {
      const updateData = {
        firstName: faker.person.firstName(),
        lastName: faker.person.lastName(),
        preferences: { theme: 'dark' }
      };

      const updated = await testUser.update(updateData);
      expect(updated.firstName).toBe(updateData.firstName);
      expect(updated.lastName).toBe(updateData.lastName);
      expect(updated.preferences.theme).toBe('dark');
    });

    it('should track profile changes in activity log', async () => {
      const beforeCount = testUser.activityLog.length;
      await testUser.update({ firstName: 'NewName' });
      expect(testUser.activityLog.length).toBe(beforeCount + 1);
      expect(testUser.activityLog[testUser.activityLog.length - 1].action)
        .toContain('profile_update');
    });
  });

  describe('Security and Compliance', () => {
    it('should handle account lockout after failed attempts', async () => {
      const attempts = 5;
      for (let i = 0; i < attempts; i++) {
        await testUser.update({ loginAttempts: i + 1 });
      }
      expect(testUser.lockoutUntil).toBeDefined();
      expect(testUser.loginAttempts).toBe(attempts);
    });

    it('should track consent status changes', async () => {
      await testUser.update({
        consentStatus: 'granted',
        consentDate: new Date()
      });
      expect(testUser.consentStatus).toBe('granted');
      expect(testUser.consentDate).toBeDefined();
    });

    it('should handle GDPR data export', async () => {
      const exportedData = await testUser.exportUserData();
      expect(exportedData).toHaveProperty('personalData');
      expect(exportedData).toHaveProperty('activityLog');
      expect(exportedData.personalData).not.toHaveProperty('password');
    });
  });
});

describe('User Controller Tests', () => {
  let controller: UserController;
  let mockCache: any;
  let mockRequest: any;
  let mockResponse: any;

  beforeEach(() => {
    mockCache = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn()
    };

    mockRequest = {
      user: { id: testUser.id },
      ip: '127.0.0.1',
      headers: { 'user-agent': 'test-agent' }
    };

    mockResponse = {
      json: jest.fn().mockReturnThis(),
      status: jest.fn().mockReturnThis()
    };

    controller = new UserController(mockCache);
  });

  describe('Profile Operations', () => {
    it('should get current user profile', async () => {
      mockCache.get.mockResolvedValue(null);
      await controller.getCurrentUser(mockRequest, mockResponse);
      expect(mockResponse.json).toHaveBeenCalled();
      expect(mockCache.set).toHaveBeenCalled();
    });

    it('should handle profile updates', async () => {
      mockRequest.body = {
        firstName: 'Updated',
        lastName: 'Name',
        preferences: { theme: 'light' }
      };

      await controller.updateProfile(mockRequest, mockResponse);
      expect(mockResponse.json).toHaveBeenCalled();
      expect(mockCache.del).toHaveBeenCalled();
    });

    it('should enforce rate limiting on profile updates', async () => {
      const requests = 6; // Exceeds PROFILE_UPDATE_LIMIT
      const promises = Array(requests).fill(null).map(() =>
        controller.updateProfile(mockRequest, mockResponse)
      );

      await Promise.all(promises);
      expect(mockResponse.status).toHaveBeenCalledWith(429);
    });
  });

  describe('Account Management', () => {
    it('should handle account deactivation', async () => {
      mockRequest.body = { password: TEST_USER.password };
      await controller.deactivateAccount(mockRequest, mockResponse);
      expect(mockResponse.json).toHaveBeenCalled();
      expect(mockCache.del).toHaveBeenCalled();
    });

    it('should require password for deactivation', async () => {
      mockRequest.body = {};
      await controller.deactivateAccount(mockRequest, mockResponse);
      expect(mockResponse.status).toHaveBeenCalledWith(400);
    });

    it('should enforce rate limiting on deactivation', async () => {
      const requests = 4; // Exceeds ACCOUNT_DEACTIVATION_LIMIT
      const promises = Array(requests).fill(null).map(() =>
        controller.deactivateAccount(mockRequest, mockResponse)
      );

      await Promise.all(promises);
      expect(mockResponse.status).toHaveBeenCalledWith(429);
    });
  });

  describe('Security Measures', () => {
    it('should sanitize user response data', async () => {
      mockCache.get.mockResolvedValue(null);
      await controller.getCurrentUser(mockRequest, mockResponse);
      const response = mockResponse.json.mock.calls[0][0];
      expect(response).not.toHaveProperty('password');
      expect(response).not.toHaveProperty('resetPasswordToken');
      expect(response).not.toHaveProperty('verificationToken');
    });

    it('should handle unauthorized access', async () => {
      mockRequest.user = null;
      await controller.getCurrentUser(mockRequest, mockResponse);
      expect(mockResponse.status).toHaveBeenCalledWith(401);
    });

    it('should log security events', async () => {
      const beforeCount = testUser.activityLog.length;
      await controller.getCurrentUser(mockRequest, mockResponse);
      expect(testUser.activityLog.length).toBe(beforeCount + 1);
      expect(testUser.activityLog[testUser.activityLog.length - 1])
        .toHaveProperty('ipAddress');
    });
  });
});