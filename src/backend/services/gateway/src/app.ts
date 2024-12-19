/**
 * @fileoverview API Gateway main application file for the Memorable platform
 * @version 1.0.0
 * @license MIT
 */

import express, { Application, Request, Response, NextFunction } from 'express'; // ^4.18.2
import cors from 'cors'; // ^2.8.5
import helmet from 'helmet'; // ^7.0.0
import compression from 'compression'; // ^1.7.4
import morgan from 'morgan'; // ^1.10.0
import rateLimit from 'express-rate-limit'; // ^6.9.0
import CircuitBreaker from 'opossum'; // ^7.1.0
import { v4 as uuidv4 } from 'uuid'; // ^9.0.0

import { gatewayConfig, validateConfig } from './config/gateway.config';
import { errorHandler, asyncErrorHandler } from './middleware/error.middleware';
import { createRedisStore, endpointRateLimits, matchesRule } from './config/rate-limit.config';
import { createSuccessResponse, sendResponse } from './utils/response.utils';

// Initialize Express application
const app: Application = express();

/**
 * Initializes middleware chain with enhanced security and monitoring features
 */
const initializeMiddleware = (): void => {
  // Request correlation
  app.use((req: Request, _res: Response, next: NextFunction) => {
    req.id = req.headers[process.env.CORRELATION_ID_HEADER || 'x-correlation-id'] as string || uuidv4();
    next();
  });

  // Security middleware
  app.use(helmet({
    contentSecurityPolicy: gatewayConfig.security.headerPolicies.contentSecurityPolicy,
    xssFilter: gatewayConfig.security.headerPolicies.xssProtection,
    noSniff: gatewayConfig.security.headerPolicies.noSniff,
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true
    }
  }));

  // CORS configuration
  app.use(cors(gatewayConfig.cors));

  // Request parsing
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Response compression
  app.use(compression({
    level: gatewayConfig.compression.level,
    threshold: 0,
    filter: (req: Request) => {
      return req.headers['accept-encoding']?.includes('gzip') || false;
    }
  }));

  // Request logging
  app.use(morgan('combined', {
    skip: (req: Request) => req.path === '/health',
    stream: {
      write: (message: string) => {
        console.info(message.trim());
      }
    }
  }));

  // Rate limiting with Redis store
  const redisStore = createRedisStore();
  app.use(rateLimit({
    ...gatewayConfig.rateLimit,
    store: redisStore
  }));

  // Endpoint-specific rate limits
  endpointRateLimits.forEach(rule => {
    app.use(rule.path, (req: Request, res: Response, next: NextFunction) => {
      if (matchesRule(req, rule)) {
        rateLimit(rule.config)(req, res, next);
      } else {
        next();
      }
    });
  });
};

/**
 * Sets up API routes with versioning and service proxies
 */
const setupRoutes = (): void => {
  // Health check endpoint
  app.get('/health', (_req: Request, res: Response) => {
    sendResponse(res, createSuccessResponse({ status: 'healthy' }));
  });

  // API version prefix
  const apiRouter = express.Router();
  app.use('/api/v1', apiRouter);

  // Service routes with circuit breakers
  Object.entries(gatewayConfig.services).forEach(([name, service]) => {
    const breaker = service.circuitBreaker && new CircuitBreaker(async (req: Request) => {
      // Service proxy implementation here
      return Promise.resolve();
    }, {
      timeout: service.timeout,
      errorThresholdPercentage: service.circuitBreaker.failureThreshold * 100,
      resetTimeout: service.circuitBreaker.resetTimeout
    });

    const serviceRouter = express.Router();
    
    // Health check for service
    serviceRouter.get('/health', asyncErrorHandler(async (_req: Request, res: Response) => {
      const health = await breaker?.fire() || { status: 'unknown' };
      sendResponse(res, createSuccessResponse(health));
    }));

    // Mount service router
    apiRouter.use(`/${name}`, serviceRouter);
  });

  // Global error handler
  app.use(errorHandler);
};

/**
 * Starts the Express server with graceful shutdown handling
 */
const startServer = async (): Promise<void> => {
  try {
    // Validate configuration
    validateConfig();

    // Initialize middleware and routes
    initializeMiddleware();
    setupRoutes();

    // Start server
    const server = app.listen(gatewayConfig.port, () => {
      console.info(`API Gateway listening on port ${gatewayConfig.port}`);
    });

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      console.info(`${signal} received, starting graceful shutdown`);
      
      server.close(() => {
        console.info('Server closed');
        process.exit(0);
      });

      // Wait for existing requests to complete
      setTimeout(() => {
        console.error('Could not close connections in time, forcefully shutting down');
        process.exit(1);
      }, process.env.REQUEST_TIMEOUT || 30000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Start server if not in test environment
if (process.env.NODE_ENV !== 'test') {
  startServer();
}

export { app, startServer };