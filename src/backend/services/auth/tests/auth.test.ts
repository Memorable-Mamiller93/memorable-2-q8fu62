// External imports with versions
import { jest } from '@jest/globals'; // @version ^29.5.0
import request from 'supertest'; // @version ^6.3.3
import httpStatus from 'http-status'; // @version ^1.6.2

// Internal imports
import { AuthController } from '../src/controllers/auth.controller';
import { AuthService } from '../src/services/auth.service';
import { TokenService } from '../src/services/token.service';
import { validatePasswordStrength } from '../src/utils/password.utils';
import { authConfig } from '../src/config/auth.config';

// Mock services
jest.mock('../src/services/auth.service');
jest.mock('../src/services/token.service');
jest.mock('../src/utils/audit.logger');
jest.mock('../src/utils/rate.limiter');

describe('AuthController', () => {
  let authController: AuthController;
  let mockAuthService: jest.Mocked<AuthService>;
  let mockTokenService: jest.Mocked<TokenService>;
  let mockRequest: any;
  let mockResponse: any;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Initialize mocks
    mockAuthService = {
      register: jest.fn(),
      login: jest.fn(),
      refreshToken: jest.fn(),
      resetPassword: jest.fn(),
      deleteAccount: jest.fn(),
    } as any;

    mockTokenService = {
      generateTokens: jest.fn(),
      verifyToken: jest.fn(),
      refreshAccessToken: jest.fn(),
    } as any;

    // Mock request object
    mockRequest = {
      ip: '127.0.0.1',
      headers: {
        'user-agent': 'test-agent',
        'x-device-fingerprint': 'test-fingerprint',
      },
      secure: true,
      cookies: {},
    };

    // Mock response object
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      cookie: jest.fn(),
      clearCookie: jest.fn(),
      set: jest.fn(),
    };

    // Initialize controller
    authController = new AuthController(mockAuthService, jest.fn() as any);
  });

  describe('Registration Tests', () => {
    it('should enforce password strength requirements', async () => {
      const weakPassword = {
        email: 'test@example.com',
        password: 'weak',
        firstName: 'Test',
        lastName: 'User',
        gdprConsent: true,
      };

      await authController.register(weakPassword, mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(httpStatus.BAD_REQUEST);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Invalid password',
          details: expect.any(Array),
        })
      );
    });

    it('should require GDPR consent for registration', async () => {
      const registrationData = {
        email: 'test@example.com',
        password: 'StrongPass123!',
        firstName: 'Test',
        lastName: 'User',
        gdprConsent: false,
      };

      await authController.register(registrationData, mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(httpStatus.BAD_REQUEST);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'GDPR consent is required',
      });
    });

    it('should validate security headers during registration', async () => {
      const insecureRequest = {
        ...mockRequest,
        secure: false,
      };

      await authController.register(
        {
          email: 'test@example.com',
          password: 'StrongPass123!',
          firstName: 'Test',
          lastName: 'User',
          gdprConsent: true,
        },
        insecureRequest,
        mockResponse
      );

      expect(mockResponse.status).toHaveBeenCalledWith(httpStatus.BAD_REQUEST);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'HTTPS is required',
      });
    });
  });

  describe('Login Tests', () => {
    it('should implement progressive rate limiting', async () => {
      const loginData = {
        email: 'test@example.com',
        password: 'WrongPass123!',
        deviceInfo: {
          fingerprint: 'test-fingerprint',
          userAgent: 'test-agent',
          ipAddress: '127.0.0.1',
        },
      };

      // Simulate multiple failed login attempts
      for (let i = 0; i < authConfig.security.maxLoginAttempts + 1; i++) {
        mockAuthService.login.mockRejectedValueOnce(new Error('Invalid credentials'));
        await authController.login(loginData, mockRequest, mockResponse);
      }

      expect(mockResponse.status).toHaveBeenLastCalledWith(httpStatus.TOO_MANY_REQUESTS);
      expect(mockResponse.json).toHaveBeenLastCalledWith(
        expect.objectContaining({
          error: expect.stringContaining('locked'),
        })
      );
    });

    it('should set secure session cookies on successful login', async () => {
      const loginData = {
        email: 'test@example.com',
        password: 'ValidPass123!',
        deviceInfo: {
          fingerprint: 'test-fingerprint',
          userAgent: 'test-agent',
          ipAddress: '127.0.0.1',
        },
      };

      mockAuthService.login.mockResolvedValueOnce({
        user: { id: '1', email: 'test@example.com' },
        tokens: {
          accessToken: 'access-token',
          refreshToken: 'refresh-token',
          expiresIn: 900,
        },
      });

      await authController.login(loginData, mockRequest, mockResponse);

      expect(mockResponse.cookie).toHaveBeenCalledWith(
        'refreshToken',
        'refresh-token',
        expect.objectContaining({
          httpOnly: true,
          secure: true,
          sameSite: 'strict',
        })
      );
    });
  });

  describe('Token Refresh Tests', () => {
    it('should detect refresh token reuse', async () => {
      mockRequest.cookies.refreshToken = 'used-refresh-token';
      mockTokenService.verifyToken.mockRejectedValueOnce(new Error('Token reuse detected'));

      await authController.refreshToken(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(httpStatus.UNAUTHORIZED);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.stringContaining('token'),
        })
      );
    });

    it('should issue new tokens on valid refresh', async () => {
      mockRequest.cookies.refreshToken = 'valid-refresh-token';
      mockAuthService.refreshToken.mockResolvedValueOnce({
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
        expiresIn: 900,
      });

      await authController.refreshToken(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(httpStatus.OK);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          accessToken: 'new-access-token',
        })
      );
    });
  });

  describe('Password Reset Tests', () => {
    it('should validate new password strength', async () => {
      const resetData = {
        email: 'test@example.com',
        token: 'valid-reset-token',
        newPassword: 'weak',
      };

      await authController.resetPassword(resetData, mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(httpStatus.BAD_REQUEST);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Invalid password',
        })
      );
    });

    it('should enforce rate limiting on password reset attempts', async () => {
      const resetData = {
        email: 'test@example.com',
        token: 'valid-reset-token',
        newPassword: 'StrongPass123!',
      };

      // Simulate multiple reset attempts
      for (let i = 0; i < 4; i++) {
        await authController.resetPassword(resetData, mockRequest, mockResponse);
      }

      expect(mockResponse.status).toHaveBeenLastCalledWith(httpStatus.TOO_MANY_REQUESTS);
    });
  });

  describe('Account Deletion Tests', () => {
    it('should require authentication for account deletion', async () => {
      mockRequest.user = undefined;

      await authController.deleteAccount(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(httpStatus.UNAUTHORIZED);
    });

    it('should clear all session data on successful deletion', async () => {
      mockRequest.user = { id: '1' };
      mockAuthService.deleteAccount.mockResolvedValueOnce(true);

      await authController.deleteAccount(mockRequest, mockResponse);

      expect(mockResponse.clearCookie).toHaveBeenCalledWith('refreshToken');
      expect(mockResponse.status).toHaveBeenCalledWith(httpStatus.OK);
    });
  });

  describe('Security Headers Tests', () => {
    it('should set security headers on all responses', async () => {
      const loginData = {
        email: 'test@example.com',
        password: 'ValidPass123!',
        deviceInfo: {},
      };

      await authController.login(loginData, mockRequest, mockResponse);

      expect(mockResponse.set).toHaveBeenCalledWith(
        expect.objectContaining({
          'Strict-Transport-Security': expect.any(String),
          'X-Content-Type-Options': 'nosniff',
          'X-Frame-Options': 'DENY',
          'X-XSS-Protection': expect.any(String),
          'Content-Security-Policy': expect.any(String),
        })
      );
    });
  });
});