// External imports with versions
import { Request, Response, NextFunction } from 'express'; // @version ^4.18.2
import { validate, validateOrReject } from 'class-validator'; // @version ^0.14.0
import { plainToClass } from 'class-transformer'; // @version ^0.5.1
import rateLimit from 'express-rate-limit'; // @version ^6.7.0
import sanitizeHtml from 'sanitize-html'; // @version ^2.11.0

// Internal imports
import { authConfig } from '../config/auth.config';
import { IUser } from '../models/user.model';
import { validatePasswordStrength } from '../utils/password.utils';

// Interfaces for validation
interface ValidationError {
  field: string;
  message: string;
  code: string;
  details?: any;
}

// DTOs for request validation
class RegisterRequestDTO {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  confirmPassword: string;
  acceptTerms: boolean;
}

class LoginRequestDTO {
  email: string;
  password: string;
  deviceId?: string;
  rememberMe?: boolean;
}

class PasswordResetDTO {
  token: string;
  newPassword: string;
  confirmPassword: string;
  deviceId?: string;
}

// Rate limiting configuration
const rateLimiter = rateLimit({
  windowMs: authConfig.security.rateLimit.windowMs,
  max: authConfig.security.rateLimit.maxRequests,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      error: 'Too many requests',
      retryAfter: Math.ceil(authConfig.security.rateLimit.windowMs / 1000)
    });
  }
});

// Sanitization options
const sanitizeOptions = {
  allowedTags: [],
  allowedAttributes: {},
  allowedIframeHostnames: []
};

/**
 * Sanitizes input data to prevent XSS and injection attacks
 * @param data Input data to sanitize
 */
const sanitizeInput = (data: any): any => {
  if (typeof data === 'string') {
    return sanitizeHtml(data, sanitizeOptions);
  }
  if (typeof data === 'object' && data !== null) {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(data)) {
      sanitized[key] = sanitizeInput(value);
    }
    return sanitized;
  }
  return data;
};

/**
 * Validates email format and checks against disposable email providers
 * @param email Email to validate
 */
const validateEmail = async (email: string): Promise<ValidationError[]> => {
  const errors: ValidationError[] = [];
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

  if (!emailRegex.test(email)) {
    errors.push({
      field: 'email',
      message: 'Invalid email format',
      code: 'INVALID_EMAIL_FORMAT'
    });
  }

  // Add check for disposable email domains
  const disposableDomains = ['tempmail.com', 'throwaway.com'];
  const domain = email.split('@')[1];
  if (disposableDomains.includes(domain)) {
    errors.push({
      field: 'email',
      message: 'Disposable email addresses are not allowed',
      code: 'DISPOSABLE_EMAIL'
    });
  }

  return errors;
};

/**
 * Enhanced middleware for user registration validation
 */
export const validateRegistration = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Apply rate limiting
    await new Promise((resolve) => rateLimiter(req, res, resolve));

    // Sanitize input
    const sanitizedData = sanitizeInput(req.body);
    const registerData = plainToClass(RegisterRequestDTO, sanitizedData);

    // Validate email
    const emailErrors = await validateEmail(registerData.email);
    if (emailErrors.length > 0) {
      res.status(400).json({ errors: emailErrors });
      return;
    }

    // Validate password strength
    const passwordValidation = validatePasswordStrength(registerData.password);
    if (!passwordValidation.isValid) {
      res.status(400).json({
        errors: passwordValidation.errors.map(error => ({
          field: 'password',
          message: error,
          code: 'PASSWORD_POLICY_VIOLATION'
        }))
      });
      return;
    }

    // Validate password confirmation
    if (registerData.password !== registerData.confirmPassword) {
      res.status(400).json({
        errors: [{
          field: 'confirmPassword',
          message: 'Passwords do not match',
          code: 'PASSWORD_MISMATCH'
        }]
      });
      return;
    }

    // Validate terms acceptance
    if (!registerData.acceptTerms) {
      res.status(400).json({
        errors: [{
          field: 'acceptTerms',
          message: 'Terms must be accepted',
          code: 'TERMS_NOT_ACCEPTED'
        }]
      });
      return;
    }

    // Validate name fields
    const nameRegex = /^[a-zA-Z\s-']{2,50}$/;
    if (!nameRegex.test(registerData.firstName) || !nameRegex.test(registerData.lastName)) {
      res.status(400).json({
        errors: [{
          field: 'name',
          message: 'Name contains invalid characters or length',
          code: 'INVALID_NAME'
        }]
      });
      return;
    }

    next();
  } catch (error) {
    res.status(500).json({
      error: 'Validation failed',
      code: 'VALIDATION_ERROR'
    });
  }
};

/**
 * Enhanced middleware for login request validation
 */
export const validateLogin = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Apply rate limiting
    await new Promise((resolve) => rateLimiter(req, res, resolve));

    // Sanitize input
    const sanitizedData = sanitizeInput(req.body);
    const loginData = plainToClass(LoginRequestDTO, sanitizedData);

    // Validate email
    const emailErrors = await validateEmail(loginData.email);
    if (emailErrors.length > 0) {
      res.status(400).json({ errors: emailErrors });
      return;
    }

    // Validate password presence
    if (!loginData.password || loginData.password.length < 1) {
      res.status(400).json({
        errors: [{
          field: 'password',
          message: 'Password is required',
          code: 'PASSWORD_REQUIRED'
        }]
      });
      return;
    }

    // Validate device ID format if provided
    if (loginData.deviceId && !/^[a-zA-Z0-9-]{36}$/.test(loginData.deviceId)) {
      res.status(400).json({
        errors: [{
          field: 'deviceId',
          message: 'Invalid device ID format',
          code: 'INVALID_DEVICE_ID'
        }]
      });
      return;
    }

    next();
  } catch (error) {
    res.status(500).json({
      error: 'Validation failed',
      code: 'VALIDATION_ERROR'
    });
  }
};

/**
 * Enhanced middleware for password reset validation
 */
export const validatePasswordReset = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Apply rate limiting
    await new Promise((resolve) => rateLimiter(req, res, resolve));

    // Sanitize input
    const sanitizedData = sanitizeInput(req.body);
    const resetData = plainToClass(PasswordResetDTO, sanitizedData);

    // Validate token format
    if (!/^[A-Za-z0-9-_]{64}$/.test(resetData.token)) {
      res.status(400).json({
        errors: [{
          field: 'token',
          message: 'Invalid reset token format',
          code: 'INVALID_TOKEN'
        }]
      });
      return;
    }

    // Validate new password strength
    const passwordValidation = validatePasswordStrength(resetData.newPassword);
    if (!passwordValidation.isValid) {
      res.status(400).json({
        errors: passwordValidation.errors.map(error => ({
          field: 'newPassword',
          message: error,
          code: 'PASSWORD_POLICY_VIOLATION'
        }))
      });
      return;
    }

    // Validate password confirmation
    if (resetData.newPassword !== resetData.confirmPassword) {
      res.status(400).json({
        errors: [{
          field: 'confirmPassword',
          message: 'Passwords do not match',
          code: 'PASSWORD_MISMATCH'
        }]
      });
      return;
    }

    next();
  } catch (error) {
    res.status(500).json({
      error: 'Validation failed',
      code: 'VALIDATION_ERROR'
    });
  }
};