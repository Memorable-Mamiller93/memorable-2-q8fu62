/**
 * @fileoverview Password utility functions for secure authentication operations
 * @version 1.0.0
 * @package bcrypt ^5.1.0
 */

import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { authConfig } from '../config/auth.config';

// Types for enhanced type safety and documentation
interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

interface ResetToken {
  token: string;
  expiresAt: Date;
  version: string;
}

// Constants
const SALT_ROUNDS = 12;
const RESET_TOKEN_BYTES = 32;
const PASSWORD_VERSION = '1';
const TOKEN_EXPIRY_HOURS = 24;

/**
 * Securely hashes a password using bcrypt with configurable salt rounds
 * @param {string} password - The plain text password to hash
 * @returns {Promise<string>} A promise that resolves to the hashed password
 * @throws {Error} If password is invalid or hashing fails
 */
export async function hashPassword(password: string): Promise<string> {
  if (!password) {
    throw new Error('Password is required');
  }

  try {
    // Generate a cryptographically secure salt
    const salt = await bcrypt.genSalt(SALT_ROUNDS);
    
    // Hash the password with the generated salt
    const hash = await bcrypt.hash(password, salt);

    // Validate the hash format
    if (!hash.startsWith('$2b$')) {
      throw new Error('Invalid hash format');
    }

    return hash;
  } catch (error) {
    // Sanitize error message to prevent information leakage
    throw new Error('Password hashing failed');
  }
}

/**
 * Securely compares a plain text password with a hashed password using constant-time comparison
 * @param {string} plainPassword - The plain text password to compare
 * @param {string} hashedPassword - The hashed password to compare against
 * @returns {Promise<boolean>} A promise that resolves to the comparison result
 * @throws {Error} If comparison fails or inputs are invalid
 */
export async function comparePasswords(
  plainPassword: string,
  hashedPassword: string
): Promise<boolean> {
  if (!plainPassword || !hashedPassword) {
    throw new Error('Both password and hash are required');
  }

  try {
    // Use bcrypt's constant-time comparison
    return await bcrypt.compare(plainPassword, hashedPassword);
  } catch (error) {
    // Sanitize error message to prevent timing attacks
    throw new Error('Password comparison failed');
  }
}

/**
 * Validates password strength against configured security policies
 * @param {string} password - The password to validate
 * @returns {ValidationResult} Detailed validation result with specific policy checks
 */
export function validatePasswordStrength(password: string): ValidationResult {
  const result: ValidationResult = {
    isValid: true,
    errors: [],
  };

  const {
    passwordMinLength,
    requireSpecialChars,
    requireNumbers,
    requireUppercase,
    requireLowercase,
  } = authConfig.security;

  // Check minimum length
  if (password.length < passwordMinLength) {
    result.errors.push(`Password must be at least ${passwordMinLength} characters long`);
  }

  // Check for uppercase letters if required
  if (requireUppercase && !/[A-Z]/.test(password)) {
    result.errors.push('Password must contain at least one uppercase letter');
  }

  // Check for lowercase letters if required
  if (requireLowercase && !/[a-z]/.test(password)) {
    result.errors.push('Password must contain at least one lowercase letter');
  }

  // Check for numbers if required
  if (requireNumbers && !/\d/.test(password)) {
    result.errors.push('Password must contain at least one number');
  }

  // Check for special characters if required
  if (requireSpecialChars && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    result.errors.push('Password must contain at least one special character');
  }

  // Check for common patterns
  if (/(.)\1{2,}/.test(password)) {
    result.errors.push('Password cannot contain repeating characters');
  }

  if (/^(password|admin|user|12345)/i.test(password)) {
    result.errors.push('Password contains common patterns');
  }

  result.isValid = result.errors.length === 0;
  return result;
}

/**
 * Generates a cryptographically secure reset token with metadata
 * @returns {ResetToken} Secure token with expiration and version information
 */
export function generateResetToken(): ResetToken {
  try {
    // Generate cryptographically secure random bytes
    const tokenBytes = crypto.randomBytes(RESET_TOKEN_BYTES);
    const token = tokenBytes.toString('base64url');

    // Calculate expiration time
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + TOKEN_EXPIRY_HOURS);

    return {
      token,
      expiresAt,
      version: PASSWORD_VERSION,
    };
  } catch (error) {
    throw new Error('Failed to generate reset token');
  }
}

// Type exports for external use
export type { ValidationResult, ResetToken };