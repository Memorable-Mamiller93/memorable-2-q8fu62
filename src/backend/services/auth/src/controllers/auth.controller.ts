// External imports with versions
import { Request, Response, NextFunction } from 'express'; // @version ^4.18.2
import { Controller, Post, UseGuards, Body } from '@nestjs/common'; // @version ^10.0.0
import { validate } from 'class-validator'; // @version ^0.14.0
import httpStatus from 'http-status'; // @version ^1.6.2
import helmet from 'helmet'; // @version ^7.0.0
import rateLimit from 'express-rate-limit'; // @version ^6.9.0
import { Logger } from 'winston'; // @version ^3.8.0

// Internal imports
import { AuthService } from '../services/auth.service';
import { validatePasswordStrength } from '../utils/password.utils';
import { authConfig } from '../config/auth.config';

// DTOs and Interfaces
interface RegisterDTO {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  gdprConsent: boolean;
  locale: string;
}

interface LoginDTO {
  email: string;
  password: string;
  deviceInfo: {
    fingerprint: string;
    userAgent: string;
    ipAddress: string;
  };
}

interface TokenRefreshDTO {
  refreshToken: string;
}

interface PasswordResetDTO {
  email: string;
  token: string;
  newPassword: string;
}

/**
 * Enhanced authentication controller with comprehensive security features
 * Handles user registration, login, token refresh, and account management
 */
@Controller('/auth')
@UseGuards(RateLimitGuard)
export class AuthController {
  private readonly logger: Logger;
  private readonly rateLimiter: any;

  constructor(
    private readonly authService: AuthService,
    logger: Logger
  ) {
    this.logger = logger;
    this.initializeRateLimiter();
  }

  /**
   * Handles user registration with enhanced security and GDPR compliance
   * @param req Express request object
   * @param res Express response object
   */
  @Post('/register')
  @ValidateBody(RegisterDTO)
  @RateLimit({ windowMs: 60000, max: 5 })
  async register(
    @Body() registerData: RegisterDTO,
    req: Request,
    res: Response
  ): Promise<Response> {
    try {
      // Validate request headers
      this.validateSecurityHeaders(req);

      // Validate password strength
      const passwordValidation = validatePasswordStrength(registerData.password);
      if (!passwordValidation.isValid) {
        return res.status(httpStatus.BAD_REQUEST).json({
          error: 'Invalid password',
          details: passwordValidation.errors
        });
      }

      // Verify GDPR consent
      if (!registerData.gdprConsent) {
        return res.status(httpStatus.BAD_REQUEST).json({
          error: 'GDPR consent is required'
        });
      }

      // Extract device information
      const deviceInfo = {
        fingerprint: req.headers['x-device-fingerprint'] as string,
        userAgent: req.headers['user-agent'] || 'unknown',
        ipAddress: req.ip
      };

      // Register user
      const result = await this.authService.register(registerData, deviceInfo);

      // Set security headers
      this.setSecurityHeaders(res);

      // Return success response
      return res.status(httpStatus.CREATED).json({
        message: 'Registration successful',
        ...result
      });
    } catch (error) {
      this.logger.error('Registration failed:', error);
      return this.handleError(error, res);
    }
  }

  /**
   * Handles user login with enhanced security measures
   * @param req Express request object
   * @param res Express response object
   */
  @Post('/login')
  @ValidateBody(LoginDTO)
  @RateLimit({ windowMs: 300000, max: 10 })
  async login(
    @Body() loginData: LoginDTO,
    req: Request,
    res: Response
  ): Promise<Response> {
    try {
      // Validate request headers
      this.validateSecurityHeaders(req);

      // Extract device information
      const deviceInfo = {
        fingerprint: req.headers['x-device-fingerprint'] as string,
        userAgent: req.headers['user-agent'] || 'unknown',
        ipAddress: req.ip
      };

      // Attempt login
      const result = await this.authService.login(loginData, deviceInfo);

      // Set security headers
      this.setSecurityHeaders(res);

      // Set secure cookie with refresh token
      if (result.tokens.refreshToken) {
        res.cookie('refreshToken', result.tokens.refreshToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          maxAge: authConfig.jwt.refreshExpiresIn * 1000,
          path: '/auth/refresh'
        });
      }

      return res.status(httpStatus.OK).json({
        message: 'Login successful',
        accessToken: result.tokens.accessToken,
        expiresIn: result.tokens.expiresIn,
        user: result.user
      });
    } catch (error) {
      this.logger.error('Login failed:', error);
      return this.handleError(error, res);
    }
  }

  /**
   * Handles token refresh with security checks
   * @param req Express request object
   * @param res Express response object
   */
  @Post('/refresh')
  @RateLimit({ windowMs: 300000, max: 20 })
  async refreshToken(
    req: Request,
    res: Response
  ): Promise<Response> {
    try {
      // Get refresh token from secure cookie
      const refreshToken = req.cookies.refreshToken;
      if (!refreshToken) {
        return res.status(httpStatus.UNAUTHORIZED).json({
          error: 'Refresh token is required'
        });
      }

      // Refresh tokens
      const result = await this.authService.refreshToken(refreshToken);

      // Update secure cookie
      res.cookie('refreshToken', result.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: authConfig.jwt.refreshExpiresIn * 1000,
        path: '/auth/refresh'
      });

      return res.status(httpStatus.OK).json({
        accessToken: result.accessToken,
        expiresIn: result.expiresIn
      });
    } catch (error) {
      this.logger.error('Token refresh failed:', error);
      return this.handleError(error, res);
    }
  }

  /**
   * Handles password reset with security measures
   * @param req Express request object
   * @param res Express response object
   */
  @Post('/reset-password')
  @ValidateBody(PasswordResetDTO)
  @RateLimit({ windowMs: 3600000, max: 3 })
  async resetPassword(
    @Body() resetData: PasswordResetDTO,
    req: Request,
    res: Response
  ): Promise<Response> {
    try {
      // Validate password strength
      const passwordValidation = validatePasswordStrength(resetData.newPassword);
      if (!passwordValidation.isValid) {
        return res.status(httpStatus.BAD_REQUEST).json({
          error: 'Invalid password',
          details: passwordValidation.errors
        });
      }

      // Reset password
      await this.authService.resetPassword(
        resetData.email,
        resetData.token,
        resetData.newPassword
      );

      return res.status(httpStatus.OK).json({
        message: 'Password reset successful'
      });
    } catch (error) {
      this.logger.error('Password reset failed:', error);
      return this.handleError(error, res);
    }
  }

  /**
   * Handles account deletion with GDPR compliance
   * @param req Express request object
   * @param res Express response object
   */
  @Post('/delete-account')
  @UseGuards(AuthGuard)
  async deleteAccount(
    req: Request,
    res: Response
  ): Promise<Response> {
    try {
      const userId = req.user.id;
      await this.authService.deleteAccount(userId);

      // Clear all cookies
      res.clearCookie('refreshToken');

      return res.status(httpStatus.OK).json({
        message: 'Account deleted successfully'
      });
    } catch (error) {
      this.logger.error('Account deletion failed:', error);
      return this.handleError(error, res);
    }
  }

  /**
   * Initializes rate limiter with dynamic blocking
   */
  private initializeRateLimiter(): void {
    this.rateLimiter = rateLimit({
      windowMs: authConfig.security.rateLimit.windowMs,
      max: authConfig.security.rateLimit.maxRequests,
      standardHeaders: true,
      legacyHeaders: false,
      handler: (req, res) => {
        res.status(httpStatus.TOO_MANY_REQUESTS).json({
          error: 'Too many requests, please try again later'
        });
      }
    });
  }

  /**
   * Sets security headers for responses
   * @param res Express response object
   */
  private setSecurityHeaders(res: Response): void {
    res.set({
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
      'Content-Security-Policy': "default-src 'self'",
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
  }

  /**
   * Validates security-related request headers
   * @param req Express request object
   */
  private validateSecurityHeaders(req: Request): void {
    if (!req.secure && process.env.NODE_ENV === 'production') {
      throw new Error('HTTPS is required');
    }

    if (!req.headers['user-agent']) {
      throw new Error('User agent is required');
    }
  }

  /**
   * Handles errors with appropriate status codes
   * @param error Error object
   * @param res Express response object
   */
  private handleError(error: any, res: Response): Response {
    const errorMessage = error.message || 'Internal server error';
    const statusCode = error.statusCode || httpStatus.INTERNAL_SERVER_ERROR;

    return res.status(statusCode).json({
      error: errorMessage
    });
  }
}