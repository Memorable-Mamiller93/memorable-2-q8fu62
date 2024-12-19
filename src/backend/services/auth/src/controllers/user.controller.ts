// External imports with versions
import { Request, Response } from 'express'; // @version ^4.18.2
import { RateLimit } from 'rate-limiter-flexible'; // @version ^2.4.1
import { validate } from 'class-validator'; // @version ^0.14.0
import { Cache } from 'cache-manager'; // @version ^5.2.3

// Internal imports
import { User } from '../models/user.model';
import { validatePasswordStrength } from '../utils/password.utils';
import { authConfig } from '../config/auth.config';

// Constants
const USER_CACHE_TTL = 300; // 5 minutes
const PROFILE_UPDATE_LIMIT = 5; // requests per minute
const ACCOUNT_DEACTIVATION_LIMIT = 3; // requests per hour

/**
 * Interface for profile update request with enhanced validation
 */
interface UpdateProfileRequest {
  firstName?: string;
  lastName?: string;
  email?: string;
  currentPassword?: string;
  newPassword?: string;
  marketingConsent?: boolean;
  preferences?: string[];
}

/**
 * Interface for sanitized user response data
 */
interface UserResponse {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt: Date | null;
  isActive: boolean;
  isVerified: boolean;
  preferences: Record<string, any>;
  marketingConsent: boolean;
}

/**
 * Enhanced UserController with security measures and GDPR compliance
 */
export class UserController {
  private rateLimiter: RateLimit;
  private cache: Cache;

  constructor(cache: Cache) {
    this.cache = cache;
    this.rateLimiter = new RateLimit({
      points: 100,
      duration: 60,
      blockDuration: 3600,
    });
  }

  /**
   * Sanitizes user data for safe external transmission
   * @param user - User instance to sanitize
   * @returns Sanitized user response
   */
  private sanitizeUserResponse(user: User): UserResponse {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      lastLoginAt: user.lastLoginAt,
      isActive: user.isActive,
      isVerified: user.isVerified,
      preferences: user.preferences,
      marketingConsent: user.consentStatus === 'granted',
    };
  }

  /**
   * Retrieves current user's profile with caching
   */
  public async getCurrentUser(req: Request, res: Response): Promise<Response> {
    try {
      // Rate limiting check
      await this.rateLimiter.consume(req.ip);

      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized access' });
      }

      // Check cache first
      const cachedUser = await this.cache.get<UserResponse>(`user:${userId}`);
      if (cachedUser) {
        return res.json(cachedUser);
      }

      // Fetch from database if not cached
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Sanitize and cache response
      const sanitizedUser = this.sanitizeUserResponse(user);
      await this.cache.set(`user:${userId}`, sanitizedUser, USER_CACHE_TTL);

      // Log access for audit trail
      user.activityLog.push({
        action: 'profile_access',
        timestamp: new Date(),
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'] || 'unknown',
      });
      await user.update({});

      return res.json(sanitizedUser);
    } catch (error) {
      console.error('Profile retrieval error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Updates user profile with enhanced security and GDPR compliance
   */
  public async updateProfile(req: Request, res: Response): Promise<Response> {
    try {
      // Rate limiting for profile updates
      const rateLimiter = new RateLimit({
        points: PROFILE_UPDATE_LIMIT,
        duration: 60,
      });
      await rateLimiter.consume(req.ip);

      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized access' });
      }

      const updateData: UpdateProfileRequest = req.body;

      // Validate update data
      const errors = await validate(updateData);
      if (errors.length > 0) {
        return res.status(400).json({ errors });
      }

      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Password change handling
      if (updateData.newPassword) {
        if (!updateData.currentPassword) {
          return res.status(400).json({ error: 'Current password is required' });
        }

        // Validate password strength
        const passwordValidation = validatePasswordStrength(updateData.newPassword);
        if (!passwordValidation.isValid) {
          return res.status(400).json({ errors: passwordValidation.errors });
        }

        // Update password with history tracking
        user.previousPasswords.push(user.password);
        user.password = updateData.newPassword;
      }

      // Update profile data
      if (updateData.firstName) user.firstName = updateData.firstName;
      if (updateData.lastName) user.lastName = updateData.lastName;
      if (updateData.email) user.email = updateData.email;
      if (updateData.preferences) user.preferences = { ...user.preferences, ...updateData.preferences };
      if (typeof updateData.marketingConsent !== 'undefined') {
        user.consentStatus = updateData.marketingConsent ? 'granted' : 'denied';
        user.consentDate = new Date();
      }

      // Log update for audit trail
      user.activityLog.push({
        action: 'profile_update',
        timestamp: new Date(),
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'] || 'unknown',
      });

      // Save updates
      const updatedUser = await user.update({});

      // Clear user cache
      await this.cache.del(`user:${userId}`);

      return res.json(this.sanitizeUserResponse(updatedUser));
    } catch (error) {
      console.error('Profile update error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Deactivates user account with compliance logging
   */
  public async deactivateAccount(req: Request, res: Response): Promise<Response> {
    try {
      // Rate limiting for account deactivation
      const rateLimiter = new RateLimit({
        points: ACCOUNT_DEACTIVATION_LIMIT,
        duration: 3600,
      });
      await rateLimiter.consume(req.ip);

      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized access' });
      }

      const { password } = req.body;
      if (!password) {
        return res.status(400).json({ error: 'Password is required for account deactivation' });
      }

      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Log deactivation for audit trail
      user.activityLog.push({
        action: 'account_deactivation',
        timestamp: new Date(),
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'] || 'unknown',
      });

      // Deactivate account
      user.isActive = false;
      user.deactivatedAt = new Date();
      await user.update({});

      // Clear user cache
      await this.cache.del(`user:${userId}`);

      // Schedule data retention cleanup based on GDPR requirements
      // This will be handled by a separate cleanup service

      return res.json({ message: 'Account deactivated successfully' });
    } catch (error) {
      console.error('Account deactivation error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
}