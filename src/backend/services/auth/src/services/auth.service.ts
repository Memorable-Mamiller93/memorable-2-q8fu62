// External imports with versions
import { validate } from 'class-validator'; // @version ^0.14.0
import { FingerprintJS } from '@fingerprintjs/fingerprintjs'; // @version ^3.4.0
import { hash, verify } from 'argon2'; // @version ^2.4.1
import zxcvbn from 'zxcvbn'; // @version ^4.4.2
import { Logger } from 'winston'; // @version ^3.8.0

// Internal imports
import { User, IUser } from '../models/user.model';
import { TokenService, TokenResponse } from './token.service';
import { authConfig } from '../config/auth.config';
import { validatePasswordStrength, generateResetToken } from '../utils/password.utils';

// Interfaces for request/response types
interface IRegisterRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  dataRetentionConsent: boolean;
}

interface ILoginRequest {
  email: string;
  password: string;
  deviceInfo: IDeviceInfo;
}

interface IDeviceInfo {
  fingerprint: string;
  userAgent: string;
  ipAddress: string;
}

interface IAuthResponse {
  user: Partial<IUser>;
  tokens: TokenResponse;
  mfaRequired?: boolean;
}

/**
 * Enhanced authentication service with advanced security features
 */
export class AuthService {
  private readonly tokenService: TokenService;
  private readonly logger: Logger;
  private readonly fingerprintJS: any;

  constructor(logger: Logger) {
    this.tokenService = new TokenService(logger);
    this.logger = logger;
    this.fingerprintJS = FingerprintJS.load();

    // Initialize security event listeners
    this.initializeSecurityMonitoring();
  }

  /**
   * Registers a new user with enhanced security checks
   * @param userData User registration data
   * @param deviceInfo Device information for security tracking
   * @returns Promise<IAuthResponse> Authentication response with tokens
   */
  async register(
    userData: IRegisterRequest,
    deviceInfo: IDeviceInfo
  ): Promise<IAuthResponse> {
    try {
      // Validate registration data
      const validationErrors = await validate(userData);
      if (validationErrors.length > 0) {
        throw new Error('Invalid registration data');
      }

      // Enhanced password strength validation
      const passwordStrength = validatePasswordStrength(userData.password);
      if (!passwordStrength.isValid) {
        throw new Error(passwordStrength.errors.join(', '));
      }

      // Additional zxcvbn check for common patterns
      const zxcvbnResult = zxcvbn(userData.password);
      if (zxcvbnResult.score < 3) {
        throw new Error('Password is too weak or commonly used');
      }

      // Check for existing user
      const existingUser = await User.findByEmail(userData.email);
      if (existingUser) {
        throw new Error('Email already registered');
      }

      // Hash password with Argon2id
      const hashedPassword = await hash(userData.password, {
        type: 2, // Argon2id
        memoryCost: 65536, // 64MB
        timeCost: 3,
        parallelism: 4
      });

      // Create verification token
      const verificationToken = generateResetToken();

      // Create new user with security metadata
      const user = await User.create({
        ...userData,
        password: hashedPassword,
        verificationToken: verificationToken.token,
        isActive: true,
        isVerified: false,
        role: 'user',
        loginAttempts: 0,
        lastIpAddress: deviceInfo.ipAddress,
        activityLog: [{
          action: 'REGISTER',
          timestamp: new Date(),
          ipAddress: deviceInfo.ipAddress,
          userAgent: deviceInfo.userAgent
        }],
        preferences: {},
        dataRetentionConsent: userData.dataRetentionConsent
      });

      // Generate authentication tokens
      const tokens = await this.tokenService.generateTokens(user);

      // Log registration event
      this.logger.info('User registered', {
        userId: user.id,
        email: user.email,
        deviceInfo
      });

      return {
        user: this.sanitizeUser(user),
        tokens
      };
    } catch (error) {
      this.logger.error('Registration failed:', error);
      throw error;
    }
  }

  /**
   * Authenticates user with enhanced security checks
   * @param loginData Login credentials
   * @param deviceInfo Device information for security
   * @returns Promise<IAuthResponse> Authentication response
   */
  async login(
    loginData: ILoginRequest,
    deviceInfo: IDeviceInfo
  ): Promise<IAuthResponse> {
    try {
      // Find user by email
      const user = await User.findByEmail(loginData.email);
      if (!user) {
        throw new Error('Invalid credentials');
      }

      // Check account status
      if (!user.isActive) {
        throw new Error('Account is disabled');
      }

      // Check lockout status
      if (user.lockoutUntil && user.lockoutUntil > new Date()) {
        throw new Error('Account is temporarily locked');
      }

      // Verify password with Argon2
      const isValidPassword = await verify(user.password, loginData.password);
      if (!isValidPassword) {
        // Increment login attempts
        user.loginAttempts += 1;
        
        // Check for lockout threshold
        if (user.loginAttempts >= authConfig.security.maxLoginAttempts) {
          user.lockoutUntil = new Date(Date.now() + authConfig.security.lockoutDuration * 1000);
          await user.update({
            loginAttempts: user.loginAttempts,
            lockoutUntil: user.lockoutUntil
          });
          throw new Error('Account locked due to multiple failed attempts');
        }

        await user.update({ loginAttempts: user.loginAttempts });
        throw new Error('Invalid credentials');
      }

      // Reset login attempts on successful login
      user.loginAttempts = 0;
      user.lastLoginAt = new Date();
      user.lastIpAddress = deviceInfo.ipAddress;

      // Add login activity to log
      user.activityLog.push({
        action: 'LOGIN',
        timestamp: new Date(),
        ipAddress: deviceInfo.ipAddress,
        userAgent: deviceInfo.userAgent
      });

      await user.update({
        loginAttempts: 0,
        lastLoginAt: user.lastLoginAt,
        lastIpAddress: user.lastIpAddress,
        activityLog: user.activityLog
      });

      // Generate authentication tokens
      const tokens = await this.tokenService.generateTokens(user);

      // Check if MFA is required
      const mfaRequired = user.mfaEnabled;

      // Log login event
      this.logger.info('User logged in', {
        userId: user.id,
        email: user.email,
        deviceInfo,
        mfaRequired
      });

      return {
        user: this.sanitizeUser(user),
        tokens,
        mfaRequired
      };
    } catch (error) {
      this.logger.error('Login failed:', error);
      throw error;
    }
  }

  /**
   * Initializes security monitoring and event handlers
   */
  private initializeSecurityMonitoring(): void {
    // Monitor for suspicious activities
    this.logger.on('error', (error) => {
      if (error.message.includes('security')) {
        // Handle security-related errors
        this.handleSecurityEvent(error);
      }
    });
  }

  /**
   * Handles security events and triggers appropriate responses
   * @param event Security event to handle
   */
  private async handleSecurityEvent(event: any): Promise<void> {
    try {
      // Log security event
      this.logger.warn('Security event detected', { event });

      // Implement additional security measures based on event type
      if (event.type === 'bruteforce') {
        // Implement additional rate limiting
        // Notify security team
      }
    } catch (error) {
      this.logger.error('Failed to handle security event:', error);
    }
  }

  /**
   * Sanitizes user object for safe external transmission
   * @param user User object to sanitize
   * @returns Sanitized user object
   */
  private sanitizeUser(user: IUser): Partial<IUser> {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      isActive: user.isActive,
      isVerified: user.isVerified,
      mfaEnabled: user.mfaEnabled,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt
    };
  }
}