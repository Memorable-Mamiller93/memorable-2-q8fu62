/**
 * @fileoverview Enhanced API Gateway configuration for the Memorable platform
 * @version 1.0.0
 * @license MIT
 * 
 * Implements comprehensive gateway configuration with advanced security,
 * monitoring, and service communication features.
 */

import type { CorsOptions } from 'cors'; // ^2.8.5
import type { HelmetOptions } from 'helmet'; // ^7.0.0
import type { Application } from 'express'; // ^4.18.2
import { defaultRateLimit } from './rate-limit.config';

/**
 * Circuit breaker configuration for service resilience
 */
export interface CircuitBreakerConfig {
  failureThreshold: number;
  resetTimeout: number;
  maxFailures: number;
  monitorInterval: number;
}

/**
 * Enhanced service configuration with comprehensive monitoring and resilience options
 */
export interface ServiceConfig {
  name: string;
  url: string;
  timeout: number;
  healthCheck: string;
  auth: boolean;
  retry?: {
    attempts: number;
    delay: number;
  };
  circuitBreaker?: CircuitBreakerConfig;
  rateLimit?: {
    windowMs: number;
    max: number;
  };
  logging?: {
    level: string;
    format: string;
  };
}

/**
 * Comprehensive gateway configuration interface with enhanced security and monitoring
 */
export interface GatewayConfig {
  port: number;
  cors: CorsOptions;
  rateLimit: typeof defaultRateLimit;
  security: {
    jwtSecret: string;
    accessTokenExpiry: number;
    refreshTokenExpiry: number;
    ipWhitelist?: string[];
    tlsVersion: string;
    headerPolicies: {
      contentSecurityPolicy: boolean;
      xssProtection: boolean;
      noSniff: boolean;
    };
  };
  services: Record<string, ServiceConfig>;
  monitoring: {
    metrics: boolean;
    tracing: boolean;
    logLevel: string;
  };
  discovery: {
    enabled: boolean;
    provider: string;
  };
  compression: {
    enabled: boolean;
    level: number;
  };
}

/**
 * Production-ready gateway configuration with comprehensive security and monitoring
 */
export const gatewayConfig: GatewayConfig = {
  port: Number(process.env.GATEWAY_PORT) || 3000,
  
  // Enhanced CORS configuration with security best practices
  cors: {
    origin: process.env.CLIENT_URL?.split(',') || [],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Request-ID',
      'X-Correlation-ID'
    ],
    credentials: true,
    maxAge: 86400,
    exposedHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining']
  },

  // Rate limiting configuration with Redis store support
  rateLimit: defaultRateLimit,

  // Comprehensive security configuration
  security: {
    jwtSecret: process.env.JWT_SECRET || '',
    accessTokenExpiry: 15 * 60, // 15 minutes
    refreshTokenExpiry: 7 * 24 * 60 * 60, // 7 days
    ipWhitelist: process.env.IP_WHITELIST?.split(','),
    tlsVersion: 'TLSv1.3',
    headerPolicies: {
      contentSecurityPolicy: true,
      xssProtection: true,
      noSniff: true
    }
  },

  // Microservice configurations with resilience patterns
  services: {
    auth: {
      name: 'auth-service',
      url: process.env.AUTH_SERVICE_URL || 'http://auth-service:3001',
      timeout: 5000,
      healthCheck: '/health',
      auth: false,
      retry: {
        attempts: 3,
        delay: 1000
      },
      logging: {
        level: 'info',
        format: 'json'
      }
    },
    book: {
      name: 'book-service',
      url: process.env.BOOK_SERVICE_URL || 'http://book-service:3002',
      timeout: 10000,
      healthCheck: '/health',
      auth: true,
      circuitBreaker: {
        failureThreshold: 0.5,
        resetTimeout: 30000,
        maxFailures: 5,
        monitorInterval: 60000
      },
      logging: {
        level: 'info',
        format: 'json'
      }
    },
    ai: {
      name: 'ai-service',
      url: process.env.AI_SERVICE_URL || 'http://ai-service:3003',
      timeout: 30000,
      healthCheck: '/health',
      auth: true,
      circuitBreaker: {
        failureThreshold: 0.4,
        resetTimeout: 45000,
        maxFailures: 3,
        monitorInterval: 60000
      },
      rateLimit: {
        windowMs: 60000,
        max: 5
      },
      logging: {
        level: 'info',
        format: 'json'
      }
    },
    order: {
      name: 'order-service',
      url: process.env.ORDER_SERVICE_URL || 'http://order-service:3004',
      timeout: 8000,
      healthCheck: '/health',
      auth: true,
      retry: {
        attempts: 2,
        delay: 2000
      },
      logging: {
        level: 'info',
        format: 'json'
      }
    },
    print: {
      name: 'print-service',
      url: process.env.PRINT_SERVICE_URL || 'http://print-service:3005',
      timeout: 15000,
      healthCheck: '/health',
      auth: true,
      circuitBreaker: {
        failureThreshold: 0.3,
        resetTimeout: 60000,
        maxFailures: 4,
        monitorInterval: 120000
      },
      logging: {
        level: 'info',
        format: 'json'
      }
    }
  },

  // Enhanced monitoring configuration
  monitoring: {
    metrics: true,
    tracing: true,
    logLevel: process.env.LOG_LEVEL || 'info'
  },

  // Service discovery configuration
  discovery: {
    enabled: true,
    provider: 'consul'
  },

  // Response compression configuration
  compression: {
    enabled: true,
    level: 6
  }
};

/**
 * Validates the gateway configuration and environment variables
 * @throws Error if configuration is invalid
 */
export const validateConfig = (): void => {
  // Validate required environment variables
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET environment variable is required');
  }

  if (!process.env.CLIENT_URL) {
    throw new Error('CLIENT_URL environment variable is required');
  }

  // Validate service URLs
  Object.entries(gatewayConfig.services).forEach(([name, service]) => {
    if (!service.url) {
      throw new Error(`Service URL for ${name} is required`);
    }

    try {
      new URL(service.url);
    } catch (error) {
      throw new Error(`Invalid URL for service ${name}: ${service.url}`);
    }
  });

  // Validate rate limit configuration
  if (gatewayConfig.rateLimit.windowMs < 0 || gatewayConfig.rateLimit.max < 0) {
    throw new Error('Invalid rate limit configuration');
  }

  // Validate circuit breaker configurations
  Object.entries(gatewayConfig.services).forEach(([name, service]) => {
    if (service.circuitBreaker) {
      const { failureThreshold, resetTimeout, maxFailures, monitorInterval } = service.circuitBreaker;
      if (
        failureThreshold < 0 || failureThreshold > 1 ||
        resetTimeout < 0 ||
        maxFailures < 0 ||
        monitorInterval < 0
      ) {
        throw new Error(`Invalid circuit breaker configuration for service ${name}`);
      }
    }
  });

  // Validate security configuration
  if (gatewayConfig.security.accessTokenExpiry <= 0 || gatewayConfig.security.refreshTokenExpiry <= 0) {
    throw new Error('Invalid token expiry configuration');
  }
};

export default gatewayConfig;