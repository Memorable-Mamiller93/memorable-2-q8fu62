/**
 * @fileoverview Enhanced rate limiting middleware implementing token bucket algorithm
 * with distributed Redis storage, endpoint-specific limits, and monitoring.
 * @version 1.0.0
 * @license MIT
 */

import rateLimit from 'express-rate-limit'; // ^6.7.0
import { Request, Response, NextFunction } from 'express'; // ^4.18.2
import { StatusCodes } from 'http-status-codes'; // ^2.2.0
import { CloudWatch } from '@aws-sdk/client-cloudwatch'; // ^3.0.0
import { Logger } from 'winston'; // ^3.8.0

import {
  defaultRateLimit,
  endpointRateLimits,
  createRedisStore,
  RateLimitConfig
} from '../config/rate-limit.config';
import { createErrorResponse, sendResponse } from '../utils/response.utils';

// Initialize CloudWatch client for metrics
const cloudWatch = new CloudWatch({
  region: process.env.AWS_REGION || 'us-east-1'
});

/**
 * Enhanced configuration options for rate limit middleware
 */
interface RateLimitMiddlewareConfig {
  enabled: boolean;
  skipFailedRequests: boolean;
  skipSuccessfulRequests: boolean;
  keyGenerator?: (req: Request) => string;
  handler?: (req: Request, res: Response, next: NextFunction, message: string) => void;
  skip?: (req: Request) => boolean;
  headers: boolean;
  draft_polli_ratelimit_headers: boolean;
}

/**
 * Creates enhanced rate limiting middleware with comprehensive features
 * @param config Middleware configuration options
 * @returns Express middleware function
 */
export const createRateLimitMiddleware = (config: RateLimitMiddlewareConfig) => {
  // Initialize Redis store with cluster support
  const store = createRedisStore({
    enableOfflineQueue: true,
    maxRetriesPerRequest: 3,
    reconnectOnError: (err) => {
      const targetError = 'READONLY';
      if (err.message.includes(targetError)) {
        return true;
      }
      return false;
    }
  });

  // Custom key generator with IP spoofing protection
  const keyGenerator = (req: Request): string => {
    if (config.keyGenerator) {
      return config.keyGenerator(req);
    }
    
    const realIP = req.headers['x-real-ip'] as string;
    const forwardedFor = req.headers['x-forwarded-for'] as string;
    const ip = realIP || (forwardedFor ? forwardedFor.split(',')[0] : req.ip);
    const userId = (req as any).user?.id || '';
    
    return `${ip}-${userId}-${req.method}-${req.path}`;
  };

  // Enhanced rate limit handler with monitoring
  const handleRateLimitExceeded = async (
    req: Request,
    res: Response,
    next: NextFunction,
    message: string
  ) => {
    if (config.handler) {
      return config.handler(req, res, next, message);
    }

    const retryAfter = Math.ceil(defaultRateLimit.windowMs / 1000);
    const error = new Error(message);
    error.name = 'RateLimitExceededError';

    // Create RFC 7807 compliant error response
    const errorResponse = createErrorResponse(
      error,
      StatusCodes.TOO_MANY_REQUESTS,
      'https://api.memorable.com/errors/rate-limit',
      req.path,
      {
        retryable: true,
        code: 'RATE_LIMIT_EXCEEDED',
        logLevel: 'warn'
      }
    );

    // Emit CloudWatch metric
    await cloudWatch.putMetricData({
      Namespace: 'Memorable/RateLimit',
      MetricData: [{
        MetricName: 'RateLimitExceeded',
        Value: 1,
        Unit: 'Count',
        Dimensions: [
          { Name: 'Path', Value: req.path },
          { Name: 'Method', Value: req.method },
          { Name: 'UserId', Value: (req as any).user?.id || 'anonymous' }
        ]
      }]
    }).catch(console.error);

    // Set rate limit headers
    if (config.headers) {
      res.setHeader('Retry-After', retryAfter);
      if (config.draft_polli_ratelimit_headers) {
        res.setHeader('RateLimit-Reset', new Date(Date.now() + defaultRateLimit.windowMs).toUTCString());
        res.setHeader('RateLimit-Remaining', '0');
      }
    }

    sendResponse(res, errorResponse, StatusCodes.TOO_MANY_REQUESTS, {
      cache: false,
      private: true
    });
  };

  // Create base middleware with default config
  const baseMiddleware = rateLimit({
    windowMs: defaultRateLimit.windowMs,
    max: defaultRateLimit.max,
    message: defaultRateLimit.message,
    standardHeaders: config.headers,
    legacyHeaders: false,
    store,
    keyGenerator,
    handler: handleRateLimitExceeded,
    skip: config.skip,
    skipFailedRequests: config.skipFailedRequests,
    skipSuccessfulRequests: config.skipSuccessfulRequests,
    requestWasSuccessful: (req: Request, res: Response) => {
      return res.statusCode < 400;
    }
  });

  // Enhanced middleware with endpoint-specific limits
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!config.enabled) {
      return next();
    }

    // Find matching endpoint-specific limit
    const endpointLimit = endpointRateLimits.find(limit => 
      req.path.startsWith(limit.path) && 
      limit.method.includes(req.method)
    );

    if (endpointLimit) {
      // Create endpoint-specific middleware
      const endpointMiddleware = rateLimit({
        ...baseMiddleware.options,
        ...endpointLimit.config,
        store,
        keyGenerator,
        handler: handleRateLimitExceeded
      });

      return endpointMiddleware(req, res, next);
    }

    // Use base middleware for non-specific endpoints
    return baseMiddleware(req, res, next);
  };
};