/**
 * @fileoverview Enhanced authentication middleware for API Gateway
 * @version 1.0.0
 * @license MIT
 */

import { Request, Response, NextFunction } from 'express'; // ^4.18.2
import { verify, JsonWebTokenError, TokenExpiredError } from 'jsonwebtoken'; // ^9.0.0
import { createLogger, format, transports } from 'winston'; // ^3.8.2
import { gatewayConfig } from '../config/gateway.config';
import { createErrorResponse } from '../utils/response.utils';

// Enhanced logger configuration for security events
const logger = createLogger({
  format: format.combine(
    format.timestamp(),
    format.json()
  ),
  transports: [
    new transports.Console(),
    new transports.File({ filename: 'security-events.log' })
  ]
});

// Interfaces
export interface TokenPayload {
  userId: string;
  role: string;
  isVerified: boolean;
  permissions: string[];
  sessionId: string;
  iat: number;
  exp: number;
}

export interface SecurityContext {
  traceId: string;
  authTime: number;
  authMethod: string;
  serviceContext: string;
}

export interface AuthenticatedRequest extends Request {
  user?: TokenPayload;
  securityContext?: SecurityContext;
}

// Cache for service authentication results
const serviceAuthCache = new Map<string, { result: boolean; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Enhanced authentication middleware with comprehensive security checks
 * @param req Express request object
 * @param res Express response object
 * @param next Next function
 */
export const authenticate = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const startTime = Date.now();
  const traceId = req.headers['x-request-id'] as string || crypto.randomUUID();

  try {
    // Create security context
    const securityContext: SecurityContext = {
      traceId,
      authTime: startTime,
      authMethod: 'jwt',
      serviceContext: req.path
    };
    req.securityContext = securityContext;

    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw new Error('Missing or invalid Authorization header');
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      throw new Error('No token provided');
    }

    // Verify token
    const decoded = verify(token, gatewayConfig.security.jwtSecret) as TokenPayload;

    // Validate token structure
    if (!decoded.userId || !decoded.role || !Array.isArray(decoded.permissions)) {
      throw new Error('Invalid token payload structure');
    }

    // Check if user is verified for sensitive operations
    if (req.method !== 'GET' && !decoded.isVerified) {
      throw new Error('Account verification required for this operation');
    }

    // Get service name from path
    const servicePath = req.path.split('/')[2]; // e.g., /api/book-service/...
    const serviceConfig = gatewayConfig.services[servicePath];

    // Validate service authentication if required
    if (serviceConfig?.auth) {
      const isAuthorized = await validateServiceAuth(servicePath, decoded);
      if (!isAuthorized) {
        throw new Error('Unauthorized access to service');
      }
    }

    // Attach user payload to request
    req.user = decoded;

    // Log successful authentication
    logger.info('Authentication successful', {
      userId: decoded.userId,
      role: decoded.role,
      service: servicePath,
      traceId,
      timestamp: new Date().toISOString()
    });

    next();
  } catch (error) {
    await handleAuthError(res, error, req.securityContext!);
  }
};

/**
 * Validates service-specific authentication requirements with caching
 * @param serviceName Name of the service being accessed
 * @param userPayload Decoded token payload
 * @returns Boolean indicating authorization status
 */
export const validateServiceAuth = async (
  serviceName: string,
  userPayload: TokenPayload
): Promise<boolean> => {
  const cacheKey = `${serviceName}:${userPayload.userId}:${userPayload.role}`;
  const cached = serviceAuthCache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.result;
  }

  const serviceConfig = gatewayConfig.services[serviceName];
  if (!serviceConfig) {
    return false;
  }

  // Implement service-specific authorization logic
  const isAuthorized = serviceConfig.auth
    ? userPayload.permissions.includes(`${serviceName}:access`)
    : true;

  // Cache the result
  serviceAuthCache.set(cacheKey, {
    result: isAuthorized,
    timestamp: Date.now()
  });

  return isAuthorized;
};

/**
 * Enhanced error handler for authentication failures
 * @param res Express response object
 * @param error Error object
 * @param securityContext Security context for the request
 */
const handleAuthError = async (
  res: Response,
  error: Error,
  securityContext: SecurityContext
): Promise<void> => {
  let status = 401;
  let type = 'https://api.memorable.com/errors/authentication';
  let retryable = false;

  // Categorize error types
  if (error instanceof TokenExpiredError) {
    type = 'https://api.memorable.com/errors/token-expired';
    retryable = true;
  } else if (error instanceof JsonWebTokenError) {
    type = 'https://api.memorable.com/errors/invalid-token';
  }

  // Log security event
  logger.warn('Authentication failed', {
    error: error.message,
    type,
    traceId: securityContext.traceId,
    timestamp: new Date().toISOString(),
    path: securityContext.serviceContext
  });

  // Send RFC 7807 compliant error response
  const errorResponse = createErrorResponse(
    error,
    status,
    type,
    securityContext.serviceContext,
    {
      retryable,
      code: 'AUTH_ERROR',
      logLevel: 'warn'
    }
  );

  // Add security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');

  res.status(status).json(errorResponse);
};