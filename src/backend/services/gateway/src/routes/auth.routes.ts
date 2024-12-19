/**
 * @fileoverview Authentication routes configuration for API Gateway
 * @version 1.0.0
 * @license MIT
 */

import express, { Request, Response, NextFunction } from 'express'; // ^4.18.2
import rateLimit from 'express-rate-limit'; // ^6.7.0
import cookieParser from 'cookie-parser'; // ^1.4.6
import helmet from 'helmet'; // ^7.0.0
import { body, validationResult } from 'express-validator'; // ^7.0.0
import { createLogger, format, transports } from 'winston'; // ^3.8.2

import { authenticate } from '../middleware/auth.middleware';
import { ProxyService } from '../services/proxy.service';
import { createErrorResponse } from '../utils/response.utils';
import { gatewayConfig } from '../config/gateway.config';

// Initialize logger for auth routes
const logger = createLogger({
  format: format.combine(
    format.timestamp(),
    format.json()
  ),
  transports: [
    new transports.Console(),
    new transports.File({ filename: 'auth-routes.log' })
  ]
});

// Initialize router and proxy service
const router = express.Router();
const proxyService = new ProxyService();

// Rate limiting configurations
const loginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per window
  message: 'Too many login attempts, please try again later',
  standardHeaders: true,
  legacyHeaders: false
});

const registerRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 registration attempts per hour
  message: 'Too many registration attempts, please try again later',
  standardHeaders: true,
  legacyHeaders: false
});

// Request validation middleware
const validateRegistration = [
  body('email').isEmail().normalizeEmail(),
  body('password')
    .isLength({ min: 8 })
    .matches(/^(?=.*[A-Z])(?=.*[a-z])(?=.*[0-9])(?=.*[!@#$%^&*])/)
    .withMessage('Password must meet security requirements'),
  body('name').trim().isLength({ min: 2, max: 50 })
];

const validateLogin = [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 })
];

// Error handling middleware
const handleValidationErrors = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const errorResponse = createErrorResponse(
      new Error('Validation failed'),
      400,
      'https://api.memorable.com/errors/validation',
      req.path,
      {
        code: 'VALIDATION_ERROR',
        errors: errors.array().map(error => ({
          field: error.param,
          message: error.msg,
          code: 'INVALID_INPUT',
          constraint: error.msg,
          value: error.value
        }))
      }
    );
    return res.status(400).json(errorResponse);
  }
  next();
};

// Security middleware
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

router.use(cookieParser(gatewayConfig.security.jwtSecret));

// Authentication routes
router.post('/register',
  registerRateLimit,
  validateRegistration,
  handleValidationErrors,
  proxyService.createProxyMiddleware('auth', {
    pathRewrite: { '^/api/v1/auth': '' }
  })
);

router.post('/login',
  loginRateLimit,
  validateLogin,
  handleValidationErrors,
  proxyService.createProxyMiddleware('auth', {
    pathRewrite: { '^/api/v1/auth': '' }
  })
);

router.post('/logout',
  authenticate,
  proxyService.createProxyMiddleware('auth', {
    pathRewrite: { '^/api/v1/auth': '' }
  })
);

router.post('/refresh-token',
  rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 2 // 2 refresh attempts per minute
  }),
  proxyService.createProxyMiddleware('auth', {
    pathRewrite: { '^/api/v1/auth': '' }
  })
);

router.post('/mfa/setup',
  authenticate,
  proxyService.createProxyMiddleware('auth', {
    pathRewrite: { '^/api/v1/auth': '' }
  })
);

router.post('/mfa/verify',
  loginRateLimit,
  proxyService.createProxyMiddleware('auth', {
    pathRewrite: { '^/api/v1/auth': '' }
  })
);

router.post('/password/reset-request',
  rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3 // 3 reset requests per hour
  }),
  body('email').isEmail().normalizeEmail(),
  handleValidationErrors,
  proxyService.createProxyMiddleware('auth', {
    pathRewrite: { '^/api/v1/auth': '' }
  })
);

router.post('/password/reset',
  rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 2 // 2 reset attempts per hour
  }),
  body('token').isString(),
  body('password')
    .isLength({ min: 8 })
    .matches(/^(?=.*[A-Z])(?=.*[a-z])(?=.*[0-9])(?=.*[!@#$%^&*])/),
  handleValidationErrors,
  proxyService.createProxyMiddleware('auth', {
    pathRewrite: { '^/api/v1/auth': '' }
  })
);

// Health check endpoint
router.get('/health',
  (req: Request, res: Response) => {
    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString()
    });
  }
);

// Error handling for auth routes
router.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  logger.error({
    message: 'Auth route error',
    error: err,
    path: req.path,
    method: req.method,
    timestamp: new Date().toISOString()
  });

  const errorResponse = createErrorResponse(
    err,
    500,
    'https://api.memorable.com/errors/auth',
    req.path,
    {
      retryable: false,
      code: 'AUTH_ERROR',
      logLevel: 'error'
    }
  );

  res.status(500).json(errorResponse);
});

export default router;