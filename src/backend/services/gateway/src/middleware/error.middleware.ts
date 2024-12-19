import { Request, Response, NextFunction } from 'express'; // v4.18.2
import { createLogger, format, transports } from 'winston'; // v3.10.0
import helmet from 'helmet'; // v7.0.0
import compression from 'compression'; // v1.7.4
import { v4 as uuidv4 } from 'uuid'; // v9.0.0
import { 
  createErrorResponse, 
  mapServiceError, 
  sendResponse 
} from '../utils/response.utils';

// Error severity levels for tracking and alerting
export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

// Enhanced error interface with tracking and validation
export interface ServiceError extends Error {
  name: string;
  message: string;
  statusCode?: number;
  type?: string;
  service?: string;
  timestamp?: Date;
  correlationId?: string;
  metadata?: Record<string, unknown>;
  validationErrors?: Array<{ field: string; message: string }>;
  severity?: ErrorSeverity;
  stackTrace?: string;
}

// Configure enterprise-grade logger
const logger = createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: format.combine(
    format.timestamp(),
    format.errors({ stack: true }),
    format.json()
  ),
  defaultMeta: { service: 'api-gateway' },
  transports: [
    new transports.Console(),
    new transports.File({ filename: 'error.log', level: 'error' })
  ]
});

// Error rate limiting configuration
const errorRateLimit = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 errors per windowMs
};

// Error tracking metrics
const errorMetrics = {
  totalErrors: 0,
  errorsByType: new Map<string, number>(),
  errorsByService: new Map<string, number>(),
  lastErrors: new Array<{ timestamp: Date; type: string }>()
};

/**
 * Enterprise-grade error handling middleware
 * Implements RFC 7807 problem details with enhanced logging and monitoring
 */
export const errorHandler = (
  error: Error | ServiceError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Generate correlation ID for error tracking
  const correlationId = error.correlationId || uuidv4();

  // Enhance error context
  const errorContext = {
    correlationId,
    path: req.path,
    method: req.method,
    service: (error as ServiceError).service || 'unknown',
    timestamp: new Date(),
    userId: req.user?.id,
    ip: req.ip,
    userAgent: req.headers['user-agent']
  };

  // Track error metrics
  errorMetrics.totalErrors++;
  errorMetrics.errorsByType.set(
    error.name,
    (errorMetrics.errorsByType.get(error.name) || 0) + 1
  );
  errorMetrics.errorsByService.set(
    errorContext.service,
    (errorMetrics.errorsByService.get(errorContext.service) || 0) + 1
  );
  errorMetrics.lastErrors.push({
    timestamp: errorContext.timestamp,
    type: error.name
  });

  // Check rate limiting
  const clientErrors = errorMetrics.lastErrors.filter(
    e => e.timestamp > new Date(Date.now() - errorRateLimit.windowMs)
  ).length;

  if (clientErrors > errorRateLimit.max) {
    logger.warn({
      message: 'Error rate limit exceeded',
      ...errorContext
    });
    return sendResponse(
      res,
      createErrorResponse(
        new Error('Too many errors'),
        429,
        'https://api.memorable.com/errors/rate-limit',
        req.path,
        { retryable: true }
      ),
      429
    );
  }

  // Map service error to appropriate HTTP status and type
  const { status, type, options } = mapServiceError(error, {
    path: req.path,
    service: errorContext.service
  });

  // Log error with context
  logger.error({
    message: error.message,
    stack: error.stack,
    severity: (error as ServiceError).severity || ErrorSeverity.MEDIUM,
    ...errorContext,
    ...options
  });

  // Create RFC 7807 error response
  const errorResponse = createErrorResponse(
    error,
    status,
    type,
    req.path,
    {
      ...options,
      errors: (error as ServiceError).validationErrors
    }
  );

  // Apply security headers
  helmet()(req, res, () => {});

  // Compress response if supported
  if (req.headers['accept-encoding']?.includes('gzip')) {
    compression()(req, res, () => {});
  }

  // Send error response
  sendResponse(res, errorResponse, status, {
    cache: false,
    compress: true
  });

  // Trigger alerts for critical errors
  if ((error as ServiceError).severity === ErrorSeverity.CRITICAL) {
    // Implement alert notification system here
    logger.alert({
      message: 'Critical error detected',
      error: error.message,
      ...errorContext
    });
  }
};

/**
 * Higher-order function for handling async route handler errors
 * Includes performance monitoring and error context preservation
 */
export const asyncErrorHandler = 
  <T>(fn: (req: Request, res: Response, next: NextFunction) => Promise<T>) =>
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const startTime = process.hrtime();

    try {
      await fn(req, res, next);
      
      // Track successful execution time
      const [seconds, nanoseconds] = process.hrtime(startTime);
      const duration = seconds * 1000 + nanoseconds / 1000000;
      
      logger.info({
        message: 'Request processed successfully',
        path: req.path,
        method: req.method,
        duration,
        timestamp: new Date()
      });
    } catch (error) {
      // Preserve error context and add timing
      const [seconds, nanoseconds] = process.hrtime(startTime);
      const duration = seconds * 1000 + nanoseconds / 1000000;

      if (error instanceof Error) {
        (error as ServiceError).correlationId = uuidv4();
        (error as ServiceError).timestamp = new Date();
        (error as ServiceError).metadata = {
          ...((error as ServiceError).metadata || {}),
          duration,
          path: req.path,
          method: req.method
        };
      }

      next(error);
    }
  };