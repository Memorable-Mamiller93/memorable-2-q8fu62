/**
 * @fileoverview AI service route configuration for story and illustration generation
 * @version 1.0.0
 * @license MIT
 */

import express, { Request, Response, NextFunction } from 'express'; // ^4.18.2
import { createProxyMiddleware } from 'http-proxy-middleware'; // ^2.0.6
import { StatusCodes } from 'http-status-codes'; // ^2.2.0
import CircuitBreaker from 'opossum'; // ^6.0.0

import { authenticate } from '../middleware/auth.middleware';
import { createRateLimitMiddleware } from '../middleware/rate-limit.middleware';
import { gatewayConfig } from '../config/gateway.config';
import { createErrorResponse, sendResponse } from '../utils/response.utils';

// Initialize router
const router = express.Router();

// AI service configuration from gateway config
const aiServiceConfig = gatewayConfig.services.ai;

// Rate limit configurations for AI endpoints
const AI_RATE_LIMITS = {
  generateStory: {
    windowMs: 60000, // 1 minute
    max: 5,
    message: 'Too many story generation requests. Please try again later.'
  },
  generateIllustration: {
    windowMs: 60000, // 1 minute
    max: 5,
    message: 'Too many illustration generation requests. Please try again later.'
  }
};

// Circuit breaker configuration
const circuitBreaker = new CircuitBreaker(async (req: Request) => {
  const proxyMiddleware = createProxyMiddleware({
    target: aiServiceConfig.url,
    changeOrigin: true,
    timeout: aiServiceConfig.timeout,
    pathRewrite: {
      '^/api/v1/generate': ''
    },
    proxyTimeout: aiServiceConfig.timeout,
    onError: (err: Error, req: Request, res: Response) => {
      throw err;
    }
  });
  return new Promise((resolve, reject) => {
    proxyMiddleware(req, req.res as Response, (err: Error) => {
      if (err) reject(err);
      else resolve(true);
    });
  });
}, {
  timeout: aiServiceConfig.timeout,
  errorThresholdPercentage: aiServiceConfig.circuitBreaker?.failureThreshold || 50,
  resetTimeout: aiServiceConfig.circuitBreaker?.resetTimeout || 30000
});

/**
 * Story generation request handler
 * @param req Express request object
 * @param res Express response object
 * @param next Next function
 */
const generateStory = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const startTime = Date.now();

  try {
    await circuitBreaker.fire(req);

    // Send success response with monitoring metadata
    sendResponse(res, {
      success: true,
      data: res.locals.data,
      error: null,
      metadata: {
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        processingTime: Date.now() - startTime,
        region: process.env.AWS_REGION || 'us-east-1'
      }
    }, StatusCodes.OK);
  } catch (error) {
    const errorResponse = createErrorResponse(
      error as Error,
      StatusCodes.SERVICE_UNAVAILABLE,
      'https://api.memorable.com/errors/ai-generation',
      req.path,
      {
        retryable: true,
        code: 'AI_SERVICE_ERROR',
        logLevel: 'error'
      }
    );
    sendResponse(res, errorResponse, StatusCodes.SERVICE_UNAVAILABLE);
  }
};

/**
 * Illustration generation request handler
 * @param req Express request object
 * @param res Express response object
 * @param next Next function
 */
const generateIllustration = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const startTime = Date.now();

  try {
    await circuitBreaker.fire(req);

    // Send success response with monitoring metadata
    sendResponse(res, {
      success: true,
      data: res.locals.data,
      error: null,
      metadata: {
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        processingTime: Date.now() - startTime,
        region: process.env.AWS_REGION || 'us-east-1'
      }
    }, StatusCodes.OK);
  } catch (error) {
    const errorResponse = createErrorResponse(
      error as Error,
      StatusCodes.SERVICE_UNAVAILABLE,
      'https://api.memorable.com/errors/ai-generation',
      req.path,
      {
        retryable: true,
        code: 'AI_SERVICE_ERROR',
        logLevel: 'error'
      }
    );
    sendResponse(res, errorResponse, StatusCodes.SERVICE_UNAVAILABLE);
  }
};

// Configure routes with authentication, rate limiting, and circuit breaker
router.post('/generate/story',
  authenticate,
  createRateLimitMiddleware({
    enabled: true,
    skipFailedRequests: false,
    skipSuccessfulRequests: false,
    headers: true,
    draft_polli_ratelimit_headers: true
  }),
  circuitBreaker.middleware,
  generateStory
);

router.post('/generate/illustration',
  authenticate,
  createRateLimitMiddleware({
    enabled: true,
    skipFailedRequests: false,
    skipSuccessfulRequests: false,
    headers: true,
    draft_polli_ratelimit_headers: true
  }),
  circuitBreaker.middleware,
  generateIllustration
);

// Monitor circuit breaker events
circuitBreaker.on('open', () => {
  console.error('AI Service Circuit Breaker: OPEN');
});

circuitBreaker.on('halfOpen', () => {
  console.info('AI Service Circuit Breaker: HALF-OPEN');
});

circuitBreaker.on('close', () => {
  console.info('AI Service Circuit Breaker: CLOSED');
});

export default router;