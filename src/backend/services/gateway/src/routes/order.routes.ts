/**
 * @fileoverview Order routes for API Gateway with enhanced security and monitoring
 * @version 1.0.0
 * @license MIT
 */

import express, { Router, Request, Response, NextFunction } from 'express'; // ^4.18.2
import { createProxyMiddleware } from 'http-proxy-middleware'; // ^2.0.6
import { StatusCodes } from 'http-status-codes'; // ^2.0.0
import CircuitBreaker from 'opossum'; // ^7.1.0

import { authenticate } from '../middleware/auth.middleware';
import { createRateLimitMiddleware } from '../middleware/rate-limit.middleware';
import { gatewayConfig } from '../config/gateway.config';
import { createErrorResponse } from '../utils/response.utils';

// Constants
const ORDER_SERVICE_PATH = '/api/v1/orders';

// Rate limit configurations per endpoint
const orderRateLimits = {
  create: {
    windowMs: 60000, // 1 minute
    max: 10,
    store: 'redis'
  },
  get: {
    windowMs: 60000,
    max: 100,
    store: 'redis'
  },
  update: {
    windowMs: 60000,
    max: 30,
    store: 'redis'
  }
};

/**
 * Configures enhanced proxy middleware for order service with resilience patterns
 * @param config Service configuration
 * @returns Configured proxy middleware
 */
const setupOrderProxy = (config: typeof gatewayConfig.services.order) => {
  // Circuit breaker configuration
  const breaker = new CircuitBreaker(
    async (req: Request) => {
      const proxy = createProxyMiddleware({
        target: config.url,
        changeOrigin: true,
        pathRewrite: {
          [`^${ORDER_SERVICE_PATH}`]: ''
        },
        proxyTimeout: config.timeout,
        onError: (err: Error, req: Request, res: Response) => {
          const error = createErrorResponse(
            err,
            StatusCodes.BAD_GATEWAY,
            'https://api.memorable.com/errors/proxy-error',
            req.path,
            {
              retryable: true,
              code: 'PROXY_ERROR',
              logLevel: 'error'
            }
          );
          res.status(StatusCodes.BAD_GATEWAY).json(error);
        },
        onProxyRes: (proxyRes: any, req: Request, res: Response) => {
          // Add conversion tracking headers for order creation
          if (req.method === 'POST') {
            res.setHeader('X-Conversion-ID', req.headers['x-request-id'] || '');
            res.setHeader('X-Conversion-Type', 'order_created');
          }
        }
      });
      return proxy;
    },
    {
      timeout: config.timeout,
      errorThresholdPercentage: 50,
      resetTimeout: 30000
    }
  );

  // Circuit breaker event handlers
  breaker.on('open', () => {
    console.error(`Circuit breaker opened for order service at ${config.url}`);
  });

  breaker.on('halfOpen', () => {
    console.info(`Circuit breaker half-opened for order service at ${config.url}`);
  });

  breaker.on('close', () => {
    console.info(`Circuit breaker closed for order service at ${config.url}`);
  });

  return breaker;
};

/**
 * Creates and configures the order routes with enhanced security and monitoring
 * @returns Configured Express router
 */
const createOrderRouter = (): Router => {
  const router = express.Router();
  const orderService = gatewayConfig.services.order;
  const orderProxy = setupOrderProxy(orderService);

  // Enhanced rate limiting middleware
  const createOrderRateLimit = createRateLimitMiddleware({
    enabled: true,
    skipFailedRequests: false,
    skipSuccessfulRequests: false,
    headers: true,
    draft_polli_ratelimit_headers: true
  });

  // Create order endpoint with enhanced security
  router.post(
    ORDER_SERVICE_PATH,
    authenticate,
    createOrderRateLimit,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        // Add PCI compliance headers
        res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
        res.setHeader('Content-Security-Policy', "default-src 'self'");

        // Sanitize request body
        const sanitizedBody = {
          ...req.body,
          paymentInfo: undefined // Remove sensitive payment data
        };
        req.body = sanitizedBody;

        await orderProxy.fire(req, res, next);
      } catch (error) {
        next(error);
      }
    }
  );

  // Get order details endpoint
  router.get(
    `${ORDER_SERVICE_PATH}/:id`,
    authenticate,
    createRateLimitMiddleware({
      enabled: true,
      skipFailedRequests: false,
      headers: true,
      draft_polli_ratelimit_headers: true
    }),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        await orderProxy.fire(req, res, next);
      } catch (error) {
        next(error);
      }
    }
  );

  // Update order endpoint
  router.put(
    `${ORDER_SERVICE_PATH}/:id`,
    authenticate,
    createRateLimitMiddleware({
      enabled: true,
      skipFailedRequests: false,
      headers: true,
      draft_polli_ratelimit_headers: true
    }),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        // Add audit logging headers
        req.headers['x-audit-action'] = 'order_update';
        req.headers['x-audit-user'] = (req as any).user?.id;

        await orderProxy.fire(req, res, next);
      } catch (error) {
        next(error);
      }
    }
  );

  // List orders endpoint
  router.get(
    ORDER_SERVICE_PATH,
    authenticate,
    createRateLimitMiddleware({
      enabled: true,
      skipFailedRequests: false,
      headers: true,
      draft_polli_ratelimit_headers: true
    }),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        await orderProxy.fire(req, res, next);
      } catch (error) {
        next(error);
      }
    }
  );

  return router;
};

// Export configured router
export const orderRouter = createOrderRouter();