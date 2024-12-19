/**
 * @fileoverview Rate limiting configuration for API Gateway
 * @version 1.0.0
 * @license MIT
 * 
 * Implements token bucket algorithm with distributed Redis storage for rate limiting.
 * Provides granular endpoint-specific rate limits with enhanced monitoring capabilities.
 */

import Redis, { RedisOptions, ClusterOptions } from 'ioredis'; // ^5.3.2
import RedisStore from 'rate-limit-redis'; // ^3.0.0
import { Request, Response } from 'express';

/**
 * Enhanced interface for rate limit configuration with additional control parameters
 */
export interface RateLimitConfig {
  windowMs: number;
  max: number;
  message: string;
  standardHeaders: boolean;
  legacyHeaders: boolean;
  skipFailedRequests: boolean;
  keyGenerator?: (req: Request) => string;
  handler?: (req: Request, res: Response) => void;
}

/**
 * Interface for endpoint-specific rate limit rules with enhanced matching
 */
export interface EndpointRateLimit {
  path: string;
  method: string[];
  config: RateLimitConfig;
  skipIfAuthenticated?: boolean;
}

/**
 * Default rate limiting configuration applied to all endpoints
 * unless overridden by specific rules
 */
export const defaultRateLimit: RateLimitConfig = {
  windowMs: 60 * 1000, // 1 minute window
  max: 100, // 100 requests per window
  message: 'Rate limit exceeded. Please try again in {window} minutes',
  standardHeaders: true, // Return rate limit info in headers
  legacyHeaders: false, // Disable legacy X-RateLimit headers
  skipFailedRequests: false, // Count failed requests against limit
  keyGenerator: (req: Request): string => {
    // Use IP + User ID if authenticated, otherwise just IP
    const ip = req.ip || req.connection.remoteAddress || '';
    const userId = (req as any).user?.id || '';
    return `${ip}-${userId}`;
  }
};

/**
 * Endpoint-specific rate limit configurations
 * Implements granular control over different API operations
 */
export const endpointRateLimits: EndpointRateLimit[] = [
  {
    path: '/api/v1/books',
    method: ['POST'],
    config: {
      windowMs: 60 * 1000,
      max: 10,
      message: 'Book creation rate limit exceeded. Please wait before creating more books',
      standardHeaders: true,
      legacyHeaders: false,
      skipFailedRequests: false
    }
  },
  {
    path: '/api/v1/generate/story',
    method: ['POST'],
    config: {
      windowMs: 60 * 1000,
      max: 5,
      message: 'Story generation limit reached. Please try again later',
      standardHeaders: true,
      legacyHeaders: false,
      skipFailedRequests: false
    }
  },
  {
    path: '/api/v1/generate/illustration',
    method: ['POST'],
    config: {
      windowMs: 60 * 1000,
      max: 5,
      message: 'Illustration generation limit reached. Please try again later',
      standardHeaders: true,
      legacyHeaders: false,
      skipFailedRequests: false
    }
  }
];

/**
 * Creates and configures Redis store with enhanced error handling and clustering support
 * @param options Redis connection options
 * @returns Configured Redis store instance with retry logic
 */
export const createRedisStore = (options?: RedisOptions | ClusterOptions): RedisStore => {
  const redisConfig: RedisOptions = {
    host: process.env.REDIS_HOST || 'localhost',
    port: Number(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD,
    retryStrategy: (times: number) => {
      // Exponential backoff with max 30s delay
      const delay = Math.min(times * 50, 30000);
      return delay;
    },
    enableReadyCheck: true,
    maxRetriesPerRequest: 3,
    ...options
  };

  // Initialize Redis client based on cluster mode
  const client = process.env.REDIS_CLUSTER_MODE === 'true'
    ? new Redis.Cluster([redisConfig])
    : new Redis(redisConfig);

  // Error handling and monitoring
  client.on('error', (err) => {
    console.error('Redis Store Error:', err);
  });

  client.on('connect', () => {
    console.info('Redis Store Connected');
  });

  // Create and configure Redis store
  const store = new RedisStore({
    client,
    prefix: process.env.REDIS_KEY_PREFIX || 'rl:', // Rate limit key prefix
    resetExpiryOnChange: true, // Reset TTL when count changes
    sendCommand: (...args: any[]) => client.call(...args)
  });

  return store;
};

/**
 * Helper function to determine if request matches rate limit rule
 * @param req Express request object
 * @param rule EndpointRateLimit rule to check
 * @returns boolean indicating if request matches rule
 */
export const matchesRule = (req: Request, rule: EndpointRateLimit): boolean => {
  const pathMatches = req.path.startsWith(rule.path);
  const methodMatches = rule.method.includes(req.method);
  const authenticationCheck = rule.skipIfAuthenticated ? !(req as any).user : true;
  
  return pathMatches && methodMatches && authenticationCheck;
};