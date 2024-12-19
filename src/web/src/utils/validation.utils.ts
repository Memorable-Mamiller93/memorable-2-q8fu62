// @version 1.0.0
// External dependencies
import { z } from 'zod'; // v3.22.0
import DOMPurify from 'dompurify'; // v3.0.5
import validator from 'validator'; // v13.11.0

// Internal type imports
import type { User } from '../types/user.types';
import type { Book } from '../types/book.types';
import type { ShippingInfo } from '../types/order.types';

/**
 * Validation security levels for different types of data
 */
export enum ValidationSecurityLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high'
}

/**
 * Performance metrics for validation operations
 */
interface ValidationMetrics {
  startTime: number;
  endTime: number;
  duration: number;
  memoryUsage: number;
}

/**
 * Form field validation states
 */
export interface FormFieldState {
  status: 'valid' | 'invalid' | 'required' | 'typing';
  dirty: boolean;
  touched: boolean;
  validationTime: number;
  errorCount: number;
}

/**
 * Enhanced validation result interface
 */
export interface ValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
  fieldStates: Record<string, FormFieldState>;
  securityLevel: ValidationSecurityLevel;
  performanceMetrics: ValidationMetrics;
}

/**
 * Configuration constants for validation
 */
const VALIDATION_CONFIGS = {
  maxAttempts: 5,
  timeWindow: 60000, // 1 minute
  cacheExpiry: 300000, // 5 minutes
  securityLevels: ['low', 'medium', 'high'] as const,
  logLevels: ['info', 'warn', 'error'] as const,
  patterns: {
    email: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
    password: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{12,}$/,
    phone: /^\+?[1-9]\d{1,14}$/,
    postalCode: /^[A-Z0-9]{3,10}$/i,
  }
} as const;

/**
 * Utility class for validation operations
 */
export class ValidationUtils {
  private static attempts = new Map<string, number>();
  private static cache = new Map<string, ValidationResult>();

  /**
   * Initializes validation metrics tracking
   */
  private static initMetrics(): ValidationMetrics {
    return {
      startTime: performance.now(),
      endTime: 0,
      duration: 0,
      memoryUsage: process.memoryUsage().heapUsed
    };
  }

  /**
   * Completes validation metrics tracking
   */
  private static completeMetrics(metrics: ValidationMetrics): ValidationMetrics {
    metrics.endTime = performance.now();
    metrics.duration = metrics.endTime - metrics.startTime;
    return metrics;
  }

  /**
   * Enhanced email validation with security checks
   */
  public static validateEmail(email: string): ValidationResult {
    const metrics = this.initMetrics();
    const fieldStates: Record<string, FormFieldState> = {};

    // Sanitize input
    const sanitizedEmail = DOMPurify.sanitize(email.trim().toLowerCase());

    // Check rate limiting
    const attemptKey = `email_${sanitizedEmail}`;
    const attempts = this.attempts.get(attemptKey) || 0;
    if (attempts >= VALIDATION_CONFIGS.maxAttempts) {
      return {
        isValid: false,
        errors: { email: 'Too many validation attempts. Please try again later.' },
        fieldStates: {
          email: {
            status: 'invalid',
            dirty: true,
            touched: true,
            validationTime: metrics.duration,
            errorCount: 1
          }
        },
        securityLevel: ValidationSecurityLevel.HIGH,
        performanceMetrics: this.completeMetrics(metrics)
      };
    }

    // Update attempts
    this.attempts.set(attemptKey, attempts + 1);
    setTimeout(() => this.attempts.delete(attemptKey), VALIDATION_CONFIGS.timeWindow);

    // Validate email format
    const emailSchema = z.string().email().min(5).max(255);
    const result = emailSchema.safeParse(sanitizedEmail);

    if (!result.success) {
      return {
        isValid: false,
        errors: { email: 'Please enter a valid email address.' },
        fieldStates: {
          email: {
            status: 'invalid',
            dirty: true,
            touched: true,
            validationTime: metrics.duration,
            errorCount: 1
          }
        },
        securityLevel: ValidationSecurityLevel.HIGH,
        performanceMetrics: this.completeMetrics(metrics)
      };
    }

    // Additional security checks
    if (!validator.isEmail(sanitizedEmail)) {
      return {
        isValid: false,
        errors: { email: 'Invalid email format.' },
        fieldStates: {
          email: {
            status: 'invalid',
            dirty: true,
            touched: true,
            validationTime: metrics.duration,
            errorCount: 1
          }
        },
        securityLevel: ValidationSecurityLevel.HIGH,
        performanceMetrics: this.completeMetrics(metrics)
      };
    }

    return {
      isValid: true,
      errors: {},
      fieldStates: {
        email: {
          status: 'valid',
          dirty: true,
          touched: true,
          validationTime: metrics.duration,
          errorCount: 0
        }
      },
      securityLevel: ValidationSecurityLevel.HIGH,
      performanceMetrics: this.completeMetrics(metrics)
    };
  }

  /**
   * Enhanced password validation following NIST guidelines
   */
  public static validatePassword(password: string): ValidationResult {
    const metrics = this.initMetrics();

    // Sanitize input
    const sanitizedPassword = DOMPurify.sanitize(password);

    // Password schema
    const passwordSchema = z.string()
      .min(12, 'Password must be at least 12 characters long')
      .regex(VALIDATION_CONFIGS.patterns.password, 
        'Password must contain uppercase, lowercase, number, and special character');

    const result = passwordSchema.safeParse(sanitizedPassword);

    if (!result.success) {
      return {
        isValid: false,
        errors: { password: 'Password does not meet security requirements.' },
        fieldStates: {
          password: {
            status: 'invalid',
            dirty: true,
            touched: true,
            validationTime: metrics.duration,
            errorCount: 1
          }
        },
        securityLevel: ValidationSecurityLevel.HIGH,
        performanceMetrics: this.completeMetrics(metrics)
      };
    }

    // Check for common passwords
    if (this.isCommonPassword(sanitizedPassword)) {
      return {
        isValid: false,
        errors: { password: 'This password is too common. Please choose a stronger password.' },
        fieldStates: {
          password: {
            status: 'invalid',
            dirty: true,
            touched: true,
            validationTime: metrics.duration,
            errorCount: 1
          }
        },
        securityLevel: ValidationSecurityLevel.HIGH,
        performanceMetrics: this.completeMetrics(metrics)
      };
    }

    return {
      isValid: true,
      errors: {},
      fieldStates: {
        password: {
          status: 'valid',
          dirty: true,
          touched: true,
          validationTime: metrics.duration,
          errorCount: 0
        }
      },
      securityLevel: ValidationSecurityLevel.HIGH,
      performanceMetrics: this.completeMetrics(metrics)
    };
  }

  /**
   * Validates shipping information
   */
  public static validateShippingInfo(info: Partial<ShippingInfo>): ValidationResult {
    const metrics = this.initMetrics();
    const errors: Record<string, string> = {};
    const fieldStates: Record<string, FormFieldState> = {};

    // Address validation
    if (info.address1) {
      const sanitizedAddress = DOMPurify.sanitize(info.address1);
      if (sanitizedAddress.length < 5 || sanitizedAddress.length > 100) {
        errors.address1 = 'Address must be between 5 and 100 characters.';
        fieldStates.address1 = {
          status: 'invalid',
          dirty: true,
          touched: true,
          validationTime: metrics.duration,
          errorCount: 1
        };
      }
    }

    // Postal code validation
    if (info.postalCode) {
      const sanitizedPostalCode = DOMPurify.sanitize(info.postalCode);
      if (!VALIDATION_CONFIGS.patterns.postalCode.test(sanitizedPostalCode)) {
        errors.postalCode = 'Invalid postal code format.';
        fieldStates.postalCode = {
          status: 'invalid',
          dirty: true,
          touched: true,
          validationTime: metrics.duration,
          errorCount: 1
        };
      }
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors,
      fieldStates,
      securityLevel: ValidationSecurityLevel.MEDIUM,
      performanceMetrics: this.completeMetrics(metrics)
    };
  }

  /**
   * Checks if a password is commonly used (simplified version)
   */
  private static isCommonPassword(password: string): boolean {
    const commonPasswords = [
      'password123',
      'qwerty123456',
      'admin123456',
      '12345678910'
    ];
    return commonPasswords.includes(password.toLowerCase());
  }

  /**
   * Clears validation cache
   */
  public static clearCache(): void {
    this.cache.clear();
    this.attempts.clear();
  }
}

export default ValidationUtils;