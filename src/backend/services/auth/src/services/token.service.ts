// External imports with versions
import jwt from 'jsonwebtoken'; // @version ^9.0.0
import { createClient } from 'redis'; // @version ^4.0.0
import { Logger } from 'winston'; // @version ^3.8.0
import { v4 as uuidv4 } from 'uuid'; // @version ^9.0.0

// Internal imports
import { authConfig } from '../config/auth.config';
import { IUser } from '../models/user.model';

// Interfaces for token handling
export interface TokenPayload {
  id: string;
  email: string;
  role: string;
  iat?: number;
  exp?: number;
  jti: string;
  iss: string;
  aud: string;
}

export interface TokenResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: string;
  jti: string;
}

/**
 * Enhanced service class for handling JWT token operations with security features
 */
export class TokenService {
  private readonly config: typeof authConfig.jwt;
  private readonly redis;
  private readonly logger: Logger;

  constructor(logger: Logger) {
    this.config = authConfig.jwt;
    this.logger = logger;

    // Initialize Redis client for token blacklisting and rate limiting
    this.redis = createClient({
      url: process.env.REDIS_URL,
      socket: {
        tls: process.env.NODE_ENV === 'production',
        rejectUnauthorized: process.env.NODE_ENV === 'production'
      }
    });

    this.redis.connect().catch(err => {
      this.logger.error('Redis connection error:', err);
      throw new Error('Failed to connect to Redis');
    });
  }

  /**
   * Generates secure access and refresh tokens with enhanced payload
   * @param user User information for token generation
   * @returns Promise<TokenResponse> Generated tokens and metadata
   */
  async generateTokens(user: IUser): Promise<TokenResponse> {
    try {
      // Validate user data
      if (!user.id || !user.email || !user.role) {
        throw new Error('Invalid user data for token generation');
      }

      // Generate unique token ID
      const jti = uuidv4();

      // Create base payload with security fields
      const basePayload: TokenPayload = {
        id: user.id,
        email: user.email,
        role: user.role,
        jti,
        iss: this.config.issuer,
        aud: this.config.audience
      };

      // Generate access token
      const accessToken = jwt.sign(
        { ...basePayload },
        this.config.secret,
        {
          algorithm: this.config.algorithm as jwt.Algorithm,
          expiresIn: this.config.accessExpiresIn
        }
      );

      // Generate refresh token
      const refreshToken = jwt.sign(
        { ...basePayload, type: 'refresh' },
        this.config.refreshSecret,
        {
          algorithm: this.config.algorithm as jwt.Algorithm,
          expiresIn: this.config.refreshExpiresIn
        }
      );

      // Store token metadata in Redis for tracking
      await this.redis.setEx(
        `token:${jti}`,
        this.config.accessExpiresIn,
        JSON.stringify({ userId: user.id, type: 'access' })
      );

      // Log token generation event
      this.logger.info('Tokens generated', {
        userId: user.id,
        jti,
        tokenType: 'access+refresh'
      });

      return {
        accessToken,
        refreshToken,
        expiresIn: this.config.accessExpiresIn,
        tokenType: 'Bearer',
        jti
      };
    } catch (error) {
      this.logger.error('Token generation failed:', error);
      throw new Error('Failed to generate tokens');
    }
  }

  /**
   * Verifies token with enhanced security checks
   * @param token Token to verify
   * @param isRefreshToken Boolean indicating if token is refresh token
   * @returns Promise<TokenPayload> Validated token payload
   */
  async verifyToken(token: string, isRefreshToken = false): Promise<TokenPayload> {
    try {
      // Verify token signature and expiration
      const decoded = jwt.verify(
        token,
        isRefreshToken ? this.config.refreshSecret : this.config.secret,
        {
          algorithms: this.config.allowedAlgorithms as jwt.Algorithm[],
          issuer: this.config.validateIssuer ? this.config.issuer : undefined,
          audience: this.config.validateAudience ? this.config.audience : undefined,
          clockTolerance: this.config.clockTolerance
        }
      ) as TokenPayload;

      // Check if token is blacklisted
      const isBlacklisted = await this.redis.get(`blacklist:${decoded.jti}`);
      if (isBlacklisted) {
        throw new Error('Token has been revoked');
      }

      // Rate limiting check
      const rateLimitKey = `ratelimit:${decoded.id}`;
      const requests = await this.redis.incr(rateLimitKey);
      if (requests === 1) {
        await this.redis.expire(rateLimitKey, 60); // 1 minute window
      }
      if (requests > 100) { // 100 requests per minute
        throw new Error('Rate limit exceeded');
      }

      // Log verification event
      this.logger.info('Token verified', {
        userId: decoded.id,
        jti: decoded.jti,
        tokenType: isRefreshToken ? 'refresh' : 'access'
      });

      return decoded;
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        this.logger.warn('Token verification failed:', error);
        throw new Error('Invalid token');
      }
      throw error;
    }
  }

  /**
   * Generates new access token using refresh token
   * @param refreshToken Refresh token for generating new access token
   * @returns Promise<TokenResponse> New token response
   */
  async refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
    try {
      // Verify refresh token
      const decoded = await this.verifyToken(refreshToken, true);

      // Check token reuse
      const tokenKey = `refresh:${decoded.jti}`;
      const isReused = await this.redis.get(tokenKey);
      if (isReused) {
        // Potential token reuse - revoke all tokens
        await this.revokeUserTokens(decoded.id);
        throw new Error('Refresh token reuse detected');
      }

      // Mark refresh token as used
      await this.redis.setEx(tokenKey, this.config.refreshExpiresIn, 'used');

      // Generate new tokens
      const user: IUser = {
        id: decoded.id,
        email: decoded.email,
        role: decoded.role
      } as IUser;

      return this.generateTokens(user);
    } catch (error) {
      this.logger.error('Access token refresh failed:', error);
      throw new Error('Failed to refresh access token');
    }
  }

  /**
   * Revokes all tokens for a user
   * @param userId User ID whose tokens should be revoked
   */
  private async revokeUserTokens(userId: string): Promise<void> {
    try {
      // Get all active tokens for user
      const pattern = `token:*`;
      for await (const key of this.redis.scanIterator({ MATCH: pattern })) {
        const value = await this.redis.get(key);
        if (value) {
          const tokenData = JSON.parse(value);
          if (tokenData.userId === userId) {
            const jti = key.split(':')[1];
            // Add to blacklist
            await this.redis.setEx(`blacklist:${jti}`, 86400, 'revoked'); // 24 hours
            // Remove from active tokens
            await this.redis.del(key);
          }
        }
      }

      this.logger.info('User tokens revoked', { userId });
    } catch (error) {
      this.logger.error('Failed to revoke user tokens:', error);
      throw new Error('Failed to revoke tokens');
    }
  }
}