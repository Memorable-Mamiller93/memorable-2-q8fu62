// @package dotenv ^16.3.1
import dotenv from 'dotenv';
import { config } from 'dotenv';

// Initialize environment variables
config();

// Interfaces for type safety and documentation
interface JWTConfig {
  secret: string;
  refreshSecret: string;
  accessExpiresIn: number;
  refreshExpiresIn: number;
  algorithm: string;
  issuer: string;
  audience: string;
  allowedAlgorithms: string[];
  validateIssuer: boolean;
  validateAudience: boolean;
  clockTolerance: number;
}

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  enableDynamicBlocking: boolean;
  blockDuration: number;
}

interface SecurityConfig {
  maxLoginAttempts: number;
  lockoutDuration: number;
  enableMFA: boolean;
  passwordMinLength: number;
  requireSpecialChars: boolean;
  requireNumbers: boolean;
  requireUppercase: boolean;
  requireLowercase: boolean;
  passwordExpiryDays: number;
  maxPasswordHistory: number;
  rateLimit: RateLimitConfig;
}

interface SessionConfig {
  rolling: boolean;
  inactivityTimeout: number;
  singleSession: boolean;
  allowedOrigins: string[];
  secureCookie: boolean;
  cookieDomain: string;
  cookiePath: string;
  sameSite: boolean;
  sessionAbsoluteTimeout: number;
}

interface AuthConfig {
  jwt: JWTConfig;
  security: SecurityConfig;
  session: SessionConfig;
}

/**
 * Validates the authentication configuration against security best practices
 * @param config - The authentication configuration to validate
 * @returns boolean indicating if the configuration is valid
 */
const validateConfig = (config: AuthConfig): boolean => {
  // JWT validation
  if (config.jwt.secret.length < 32 || config.jwt.refreshSecret.length < 32) {
    throw new Error('JWT secrets must be at least 32 characters long');
  }

  if (!['RS256', 'RS384', 'RS512'].includes(config.jwt.algorithm)) {
    throw new Error('JWT algorithm must be RS256, RS384, or RS512');
  }

  if (config.jwt.accessExpiresIn > 900) { // 15 minutes in seconds
    throw new Error('Access token expiry must not exceed 15 minutes');
  }

  if (config.jwt.refreshExpiresIn > 604800) { // 7 days in seconds
    throw new Error('Refresh token expiry must not exceed 7 days');
  }

  // Security validation
  if (config.security.passwordMinLength < 12) {
    throw new Error('Minimum password length must be at least 12 characters');
  }

  if (config.security.maxLoginAttempts < 3) {
    throw new Error('Maximum login attempts must be at least 3');
  }

  if (config.security.rateLimit.windowMs < 60000) { // 1 minute
    throw new Error('Rate limit window must be at least 1 minute');
  }

  // Session validation
  if (config.session.inactivityTimeout > 3600) { // 1 hour
    throw new Error('Session inactivity timeout must not exceed 1 hour');
  }

  if (!config.session.secureCookie) {
    throw new Error('Secure cookie must be enabled in production');
  }

  return true;
};

/**
 * Loads and validates the authentication configuration from environment variables
 * @returns Validated AuthConfig object
 */
const loadAuthConfig = (): AuthConfig => {
  const config: AuthConfig = {
    jwt: {
      secret: process.env.JWT_SECRET || '',
      refreshSecret: process.env.JWT_REFRESH_SECRET || '',
      accessExpiresIn: parseInt(process.env.JWT_ACCESS_EXPIRES || '900', 10), // 15 minutes
      refreshExpiresIn: parseInt(process.env.JWT_REFRESH_EXPIRES || '604800', 10), // 7 days
      algorithm: process.env.JWT_ALGORITHM || 'RS256',
      issuer: process.env.JWT_ISSUER || 'memorable-auth',
      audience: process.env.JWT_AUDIENCE || 'memorable-api',
      allowedAlgorithms: ['RS256', 'RS384', 'RS512'],
      validateIssuer: true,
      validateAudience: true,
      clockTolerance: parseInt(process.env.JWT_CLOCK_TOLERANCE || '30', 10), // 30 seconds
    },
    security: {
      maxLoginAttempts: parseInt(process.env.MAX_LOGIN_ATTEMPTS || '5', 10),
      lockoutDuration: parseInt(process.env.LOCKOUT_DURATION || '1800', 10), // 30 minutes
      enableMFA: process.env.ENABLE_MFA === 'true',
      passwordMinLength: parseInt(process.env.PASSWORD_MIN_LENGTH || '12', 10),
      requireSpecialChars: process.env.REQUIRE_SPECIAL_CHARS !== 'false',
      requireNumbers: process.env.REQUIRE_NUMBERS !== 'false',
      requireUppercase: process.env.REQUIRE_UPPERCASE !== 'false',
      requireLowercase: process.env.REQUIRE_LOWERCASE !== 'false',
      passwordExpiryDays: parseInt(process.env.PASSWORD_EXPIRY_DAYS || '90', 10),
      maxPasswordHistory: parseInt(process.env.MAX_PASSWORD_HISTORY || '5', 10),
      rateLimit: {
        windowMs: parseInt(process.env.RATE_LIMIT_WINDOW || '900000', 10), // 15 minutes
        maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
        enableDynamicBlocking: true,
        blockDuration: 3600000, // 1 hour
      },
    },
    session: {
      rolling: process.env.SESSION_ROLLING === 'true',
      inactivityTimeout: parseInt(process.env.SESSION_INACTIVITY_TIMEOUT || '1800', 10), // 30 minutes
      sessionAbsoluteTimeout: parseInt(process.env.SESSION_ABSOLUTE_TIMEOUT || '28800', 10), // 8 hours
      singleSession: process.env.SINGLE_SESSION === 'true',
      allowedOrigins: (process.env.ALLOWED_ORIGINS || '').split(',').filter(Boolean),
      secureCookie: process.env.COOKIE_SECURE !== 'false',
      cookieDomain: process.env.COOKIE_DOMAIN || '',
      cookiePath: process.env.COOKIE_PATH || '/',
      sameSite: true,
    },
  };

  // Validate the configuration
  validateConfig(config);

  return config;
};

// Create and validate the authentication configuration
const authConfig: AuthConfig = loadAuthConfig();

// Export the configuration and interfaces
export {
  authConfig,
  AuthConfig,
  JWTConfig,
  SecurityConfig,
  SessionConfig,
  RateLimitConfig,
};

// Default export for convenience
export default authConfig;