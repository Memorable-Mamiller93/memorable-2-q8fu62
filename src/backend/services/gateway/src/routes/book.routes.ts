/**
 * @fileoverview Book routes configuration for API Gateway
 * @version 1.0.0
 * @license MIT
 */

import { Router, Request, Response, NextFunction } from 'express'; // ^4.18.2
import { StatusCodes } from 'http-status-codes'; // ^2.2.0
import helmet from 'helmet'; // ^7.0.0
import { RateLimiterRedis } from 'rate-limiter-flexible'; // ^2.4.1

import { validateJWT, checkRole } from '../middleware/auth.middleware';
import { ProxyService } from '../services/proxy.service';
import { gatewayConfig } from '../config/gateway.config';
import { createErrorResponse } from '../utils/response.utils';
import { defaultRateLimit, endpointRateLimits, createRedisStore } from '../config/rate-limit.config';

// Initialize services
const proxyService = new ProxyService();
const router = Router();

/**
 * Book request validation middleware
 */
const validateBookData = (req: Request, res: Response, next: NextFunction) => {
  const { title, theme, metadata } = req.body;

  if (!title || typeof title !== 'string' || title.length < 3) {
    return res.status(StatusCodes.BAD_REQUEST).json(
      createErrorResponse(
        new Error('Invalid book title'),
        StatusCodes.BAD_REQUEST,
        'https://api.memorable.com/errors/validation',
        req.path,
        {
          code: 'INVALID_TITLE',
          retryable: false
        }
      )
    );
  }

  if (!theme || typeof theme !== 'string') {
    return res.status(StatusCodes.BAD_REQUEST).json(
      createErrorResponse(
        new Error('Invalid theme selection'),
        StatusCodes.BAD_REQUEST,
        'https://api.memorable.com/errors/validation',
        req.path,
        {
          code: 'INVALID_THEME',
          retryable: false
        }
      )
    );
  }

  next();
};

/**
 * Configure route security
 */
router.use(helmet({
  contentSecurityPolicy: true,
  crossOriginEmbedderPolicy: true,
  crossOriginOpenerPolicy: true,
  crossOriginResourcePolicy: true,
  dnsPrefetchControl: true,
  frameguard: true,
  hidePoweredBy: true,
  hsts: true,
  ieNoOpen: true,
  noSniff: true,
  originAgentCluster: true,
  permittedCrossDomainPolicies: true,
  referrerPolicy: true,
  xssFilter: true
}));

// Configure rate limiting
const bookRateLimiter = new RateLimiterRedis({
  storeClient: createRedisStore(),
  points: endpointRateLimits.find(limit => limit.path === '/api/v1/books')?.config.max || defaultRateLimit.max,
  duration: endpointRateLimits.find(limit => limit.path === '/api/v1/books')?.config.windowMs || defaultRateLimit.windowMs,
  keyPrefix: 'rl:book:'
});

/**
 * Rate limiting middleware
 */
const rateLimitMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await bookRateLimiter.consume(req.ip);
    next();
  } catch (error) {
    return res.status(StatusCodes.TOO_MANY_REQUESTS).json(
      createErrorResponse(
        new Error('Rate limit exceeded'),
        StatusCodes.TOO_MANY_REQUESTS,
        'https://api.memorable.com/errors/rate-limit',
        req.path,
        {
          code: 'RATE_LIMIT_EXCEEDED',
          retryable: true
        }
      )
    );
  }
};

/**
 * Book Routes
 */

// GET /api/v1/books - Get all books for authenticated user
router.get(
  '/books',
  validateJWT,
  rateLimitMiddleware,
  proxyService.createProxyMiddleware('book', {
    pathRewrite: {
      '^/api/v1/books': '/books'
    },
    proxyTimeout: gatewayConfig.services.book.timeout,
    retry: gatewayConfig.services.book.retry,
    circuitBreaker: gatewayConfig.services.book.circuitBreaker
  })
);

// GET /api/v1/books/:id - Get specific book by ID
router.get(
  '/books/:id',
  validateJWT,
  rateLimitMiddleware,
  proxyService.createProxyMiddleware('book', {
    pathRewrite: {
      '^/api/v1/books': '/books'
    },
    proxyTimeout: gatewayConfig.services.book.timeout,
    retry: gatewayConfig.services.book.retry,
    circuitBreaker: gatewayConfig.services.book.circuitBreaker
  })
);

// POST /api/v1/books - Create new book
router.post(
  '/books',
  validateJWT,
  checkRole(['user', 'premium']),
  rateLimitMiddleware,
  validateBookData,
  proxyService.createProxyMiddleware('book', {
    pathRewrite: {
      '^/api/v1/books': '/books'
    },
    proxyTimeout: gatewayConfig.services.book.timeout,
    retry: gatewayConfig.services.book.retry,
    circuitBreaker: gatewayConfig.services.book.circuitBreaker
  })
);

// PUT /api/v1/books/:id - Update existing book
router.put(
  '/books/:id',
  validateJWT,
  checkRole(['user', 'premium']),
  rateLimitMiddleware,
  validateBookData,
  proxyService.createProxyMiddleware('book', {
    pathRewrite: {
      '^/api/v1/books': '/books'
    },
    proxyTimeout: gatewayConfig.services.book.timeout,
    retry: gatewayConfig.services.book.retry,
    circuitBreaker: gatewayConfig.services.book.circuitBreaker
  })
);

// DELETE /api/v1/books/:id - Delete book
router.delete(
  '/books/:id',
  validateJWT,
  checkRole(['user', 'premium']),
  rateLimitMiddleware,
  proxyService.createProxyMiddleware('book', {
    pathRewrite: {
      '^/api/v1/books': '/books'
    },
    proxyTimeout: gatewayConfig.services.book.timeout,
    retry: gatewayConfig.services.book.retry,
    circuitBreaker: gatewayConfig.services.book.circuitBreaker
  })
);

// Health check endpoint
router.get('/health', (req: Request, res: Response) => {
  res.status(StatusCodes.OK).json({
    status: 'healthy',
    service: 'book-routes',
    timestamp: new Date().toISOString()
  });
});

export default router;