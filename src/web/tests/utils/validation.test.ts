// @version 1.0.0
// External dependencies
import { describe, it, expect, beforeEach, afterEach } from 'vitest'; // v0.32.0

// Internal imports
import {
  validateEmail,
  validatePassword,
  validateBookTitle,
  validateShippingAddress,
  sanitizeInput,
  ValidationSecurityLevel,
  type ValidationResult,
  type FormFieldState
} from '../../src/utils/validation.utils';

describe('ValidationUtils', () => {
  // Performance tracking setup
  let startTime: number;
  const PERFORMANCE_THRESHOLD = 100; // ms

  beforeEach(() => {
    startTime = performance.now();
  });

  afterEach(() => {
    const endTime = performance.now();
    const duration = endTime - startTime;
    expect(duration).toBeLessThan(PERFORMANCE_THRESHOLD);
  });

  describe('validateEmail', () => {
    it('should validate correct email formats', () => {
      const validEmails = [
        'user@example.com',
        'user.name+tag@domain.co.uk',
        'user@subdomain.domain.com'
      ];

      validEmails.forEach(email => {
        const result = validateEmail(email);
        expect(result.isValid).toBe(true);
        expect(result.errors).toEqual({});
        expect(result.securityLevel).toBe(ValidationSecurityLevel.HIGH);
        expect(result.fieldStates.email.status).toBe('valid');
      });
    });

    it('should reject invalid email formats', () => {
      const invalidEmails = [
        'invalid@email',
        '@domain.com',
        'user@.com',
        'user@domain.',
        'user space@domain.com'
      ];

      invalidEmails.forEach(email => {
        const result = validateEmail(email);
        expect(result.isValid).toBe(false);
        expect(result.errors.email).toBeDefined();
        expect(result.securityLevel).toBe(ValidationSecurityLevel.HIGH);
        expect(result.fieldStates.email.status).toBe('invalid');
      });
    });

    it('should handle disposable email providers', () => {
      const disposableEmails = [
        'user@tempmail.com',
        'test@10minutemail.com'
      ];

      disposableEmails.forEach(email => {
        const result = validateEmail(email);
        expect(result.isValid).toBe(false);
        expect(result.errors.email).toContain('disposable');
      });
    });

    it('should enforce rate limiting', () => {
      const email = 'test@example.com';
      const attempts = 6; // Exceeds max attempts

      for (let i = 0; i < attempts; i++) {
        const result = validateEmail(email);
        if (i >= 5) {
          expect(result.isValid).toBe(false);
          expect(result.errors.email).toContain('Too many validation attempts');
        }
      }
    });
  });

  describe('validatePassword', () => {
    it('should validate NIST-compliant passwords', () => {
      const validPasswords = [
        'StrongP@ssw0rd123',
        'C0mplex!tyIsKey99',
        'Secur3P@ssphrase!'
      ];

      validPasswords.forEach(password => {
        const result = validatePassword(password);
        expect(result.isValid).toBe(true);
        expect(result.errors).toEqual({});
        expect(result.securityLevel).toBe(ValidationSecurityLevel.HIGH);
      });
    });

    it('should reject weak passwords', () => {
      const weakPasswords = [
        'password123',
        'abc123',
        'qwerty',
        '12345678'
      ];

      weakPasswords.forEach(password => {
        const result = validatePassword(password);
        expect(result.isValid).toBe(false);
        expect(result.errors.password).toBeDefined();
      });
    });

    it('should check password complexity requirements', () => {
      const result = validatePassword('SimplePassword');
      expect(result.isValid).toBe(false);
      expect(result.errors.password).toContain('must contain');
    });

    it('should detect common passwords', () => {
      const result = validatePassword('password123');
      expect(result.isValid).toBe(false);
      expect(result.errors.password).toContain('too common');
    });
  });

  describe('validateShippingAddress', () => {
    it('should validate complete shipping addresses', () => {
      const validAddress = {
        address1: '123 Main Street',
        city: 'Springfield',
        state: 'IL',
        postalCode: '62701',
        countryCode: 'US'
      };

      const result = validateShippingAddress(validAddress);
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual({});
      expect(result.securityLevel).toBe(ValidationSecurityLevel.MEDIUM);
    });

    it('should validate international postal codes', () => {
      const internationalAddresses = [
        { postalCode: '75001', countryCode: 'FR' }, // France
        { postalCode: 'SW1A 1AA', countryCode: 'GB' }, // UK
        { postalCode: '100-0001', countryCode: 'JP' } // Japan
      ];

      internationalAddresses.forEach(address => {
        const result = validateShippingAddress(address);
        expect(result.fieldStates.postalCode?.status).toBe('valid');
      });
    });

    it('should reject invalid address formats', () => {
      const invalidAddress = {
        address1: 'a', // Too short
        postalCode: 'invalid'
      };

      const result = validateShippingAddress(invalidAddress);
      expect(result.isValid).toBe(false);
      expect(result.errors.address1).toBeDefined();
      expect(result.errors.postalCode).toBeDefined();
    });
  });

  describe('sanitizeInput', () => {
    it('should sanitize inputs against XSS', () => {
      const maliciousInputs = [
        '<script>alert("xss")</script>',
        'javascript:alert(1)',
        '<img src="x" onerror="alert(1)">'
      ];

      maliciousInputs.forEach(input => {
        const result = sanitizeInput(input);
        expect(result).not.toContain('<script>');
        expect(result).not.toContain('javascript:');
        expect(result).not.toContain('onerror');
      });
    });

    it('should preserve valid HTML entities', () => {
      const input = '&amp; &lt; &gt; &quot;';
      const result = sanitizeInput(input);
      expect(result).toBe(input);
    });

    it('should handle Unicode characters correctly', () => {
      const input = '🚀 Hello 世界';
      const result = sanitizeInput(input);
      expect(result).toBe(input);
    });
  });

  describe('Performance Metrics', () => {
    it('should track validation performance', () => {
      const email = 'test@example.com';
      const result = validateEmail(email);
      
      expect(result.performanceMetrics).toBeDefined();
      expect(result.performanceMetrics.duration).toBeLessThan(PERFORMANCE_THRESHOLD);
      expect(result.performanceMetrics.memoryUsage).toBeGreaterThan(0);
    });

    it('should maintain validation cache efficiency', () => {
      const email = 'test@example.com';
      
      // First validation
      const result1 = validateEmail(email);
      const time1 = result1.performanceMetrics.duration;
      
      // Cached validation
      const result2 = validateEmail(email);
      const time2 = result2.performanceMetrics.duration;
      
      expect(time2).toBeLessThanOrEqual(time1);
    });
  });
});