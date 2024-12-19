/**
 * @fileoverview Enhanced print service route definitions with comprehensive security,
 * monitoring, and reliability features including distributed rate limiting,
 * circuit breaker patterns, and request validation.
 * @version 1.0.0
 * @license MIT
 */

import { Router } from 'express'; // ^4.18.2
import helmet from 'helmet'; // ^7.0.0
import { authenticate } from '../middleware/auth.middleware';
import { createRateLimitMiddleware } from '../middleware/rate-limit.middleware';
import { ProxyService } from '../services/proxy.service';
import { gatewayConfig } from '../config/gateway.config';

// Initialize proxy service for print endpoints
const proxyService = new ProxyService();

/**
 * Configure print service routes with enhanced security and reliability features
 * @returns Configured Express router with print routes
 */
export const configurePrintRoutes = (): Router => {
  const router = Router();

  // Apply security middleware
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

  // Configure rate limiting for print endpoints
  const printRateLimit = createRateLimitMiddleware({
    enabled: true,
    skipFailedRequests: false,
    skipSuccessfulRequests: false,
    headers: true,
    draft_polli_ratelimit_headers: true
  });

  // Configure proxy options for print service
  const printProxyOptions = {
    pathRewrite: {
      '^/api/v1/print': ''
    },
    circuitBreaker: {
      failureThreshold: 0.3,
      resetTimeout: 60000,
      maxFailures: 4
    },
    healthCheck: {
      path: '/health',
      interval: 30000
    },
    retry: {
      attempts: 3,
      delay: 2000
    }
  };

  // Create print job endpoint
  router.post('/jobs',
    authenticate,
    printRateLimit,
    proxyService.createProxyMiddleware('print', {
      ...printProxyOptions,
      rateLimit: {
        windowMs: 60000, // 1 minute
        max: 10
      }
    })
  );

  // Get print job status endpoint
  router.get('/jobs/:id',
    authenticate,
    printRateLimit,
    proxyService.createProxyMiddleware('print', {
      ...printProxyOptions,
      rateLimit: {
        windowMs: 60000,
        max: 100
      }
    })
  );

  // Cancel print job endpoint
  router.post('/jobs/:id/cancel',
    authenticate,
    printRateLimit,
    proxyService.createProxyMiddleware('print', {
      ...printProxyOptions,
      rateLimit: {
        windowMs: 60000,
        max: 10
      }
    })
  );

  // Get available printers endpoint
  router.get('/printers',
    authenticate,
    printRateLimit,
    proxyService.createProxyMiddleware('print', {
      ...printProxyOptions,
      rateLimit: {
        windowMs: 60000,
        max: 100
      },
      healthCheck: {
        path: '/health',
        interval: 30000
      }
    })
  );

  // Get printer status endpoint
  router.get('/printers/:id/status',
    authenticate,
    printRateLimit,
    proxyService.createProxyMiddleware('print', {
      ...printProxyOptions,
      rateLimit: {
        windowMs: 60000,
        max: 100
      },
      monitoring: {
        metrics: ['response_time', 'error_rate', 'availability']
      }
    })
  );

  return router;
};

// Export configured print routes
const printRouter = configurePrintRoutes();
export default printRouter;