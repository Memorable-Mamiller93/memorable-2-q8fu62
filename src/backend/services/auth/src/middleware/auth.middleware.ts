// External imports with versions
import { Request, Response, NextFunction, RequestHandler } from 'express'; // @version ^4.18.2
import rateLimit from 'express-rate-limit'; // @version ^6.7.0
import helmet from 'helmet'; // @version ^7.0.0
import { v4 as uuidv4 } from 'uuid'; // @version ^9.0.0

// Internal imports
import { authConfig } from '../config/auth.config';
import { TokenService, TokenPayload } from '../services/token.service';
import { User, IUser } from '../models/user.model';

/**
 * Extended Express Request interface with authenticated user and security context
 */
export interface AuthenticatedRequest extends Request {
  user?: IUser;
  tokenPayload?: TokenPayload;
  securityContext?: RequestContext;
  requestId?: string;
}

/**
 * Security context for request tracking and audit
 */
interface RequestContext {
  ip: string;
  userAgent: string;
  origin: string;
  timestamp: number;
  sessionId: string;
}

/**
 * Enhanced configuration for role-based access control with security options
 */
interface RoleConfig {
  allowedRoles: string[];
  requireVerified?: boolean;
  requiredPermissions?: string[];
  securityOptions?: {
    enforceIPCheck?: boolean;
    requireMFA?: boolean;
    maxInactivityTime?: number;
  };
}

// Initialize TokenService
const tokenService = new TokenService(console);

/**
 * Rate limiter configuration based on security settings
 */
const rateLimiter = rateLimit({
  windowMs: authConfig.security.rateLimit.windowMs,
  max: authConfig.security.rateLimit.maxRequests,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      error: 'Too many requests',
      retryAfter: Math.ceil(authConfig.security.rateLimit.windowMs / 1000)
    });
  }
});

/**
 * Creates security context for request tracking
 */
const createSecurityContext = (req: Request): RequestContext => ({
  ip: req.ip,
  userAgent: req.get('user-agent') || 'unknown',
  origin: req.get('origin') || req.get('host') || 'unknown',
  timestamp: Date.now(),
  sessionId: req.get('x-session-id') || uuidv4()
});

/**
 * Enhanced middleware for request authentication with comprehensive security checks
 */
export const authenticate = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Initialize request tracking
    req.requestId = uuidv4();
    req.securityContext = createSecurityContext(req);

    // Extract and validate Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw new Error('Invalid authorization header');
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      throw new Error('No token provided');
    }

    // Verify token and extract payload
    const tokenPayload = await tokenService.verifyToken(token);
    req.tokenPayload = tokenPayload;

    // Find and validate user
    const user = await User.findById(tokenPayload.id);
    if (!user) {
      throw new Error('User not found');
    }

    // Security checks
    if (!user.isActive) {
      throw new Error('Account is deactivated');
    }

    if (user.lockoutUntil && user.lockoutUntil > new Date()) {
      throw new Error('Account is temporarily locked');
    }

    // Session validation
    const sessionAge = Date.now() - (user.lastLoginAt?.getTime() || 0);
    if (sessionAge > authConfig.session.sessionAbsoluteTimeout * 1000) {
      throw new Error('Session expired');
    }

    // Attach user to request
    req.user = user;

    // Update user's last activity
    await user.update({
      lastLoginAt: new Date(),
      lastIpAddress: req.securityContext.ip,
      activityLog: [
        ...user.activityLog,
        {
          action: 'authentication',
          timestamp: new Date(),
          ipAddress: req.securityContext.ip,
          userAgent: req.securityContext.userAgent
        }
      ]
    });

    next();
  } catch (error) {
    res.status(401).json({
      error: 'Authentication failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      requestId: req.requestId
    });
  }
};

/**
 * Enhanced middleware factory for role-based authorization with security controls
 */
export const authorize = (roleConfig: RoleConfig): RequestHandler => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      // Validate authenticated context
      if (!req.user || !req.tokenPayload) {
        throw new Error('Unauthorized access');
      }

      // Role validation
      if (!roleConfig.allowedRoles.includes(req.user.role)) {
        throw new Error('Insufficient permissions');
      }

      // Verification check if required
      if (roleConfig.requireVerified && !req.user.isVerified) {
        throw new Error('Account not verified');
      }

      // Enhanced security checks
      if (roleConfig.securityOptions) {
        // IP validation
        if (roleConfig.securityOptions.enforceIPCheck &&
            req.user.lastIpAddress &&
            req.user.lastIpAddress !== req.securityContext?.ip) {
          throw new Error('IP address mismatch');
        }

        // MFA validation
        if (roleConfig.securityOptions.requireMFA && !req.user.mfaEnabled) {
          throw new Error('MFA required');
        }

        // Inactivity check
        if (roleConfig.securityOptions.maxInactivityTime) {
          const lastActivity = req.user.lastLoginAt?.getTime() || 0;
          const inactivityTime = Date.now() - lastActivity;
          if (inactivityTime > roleConfig.securityOptions.maxInactivityTime) {
            throw new Error('Session inactive');
          }
        }
      }

      // Log authorization event
      req.user.activityLog.push({
        action: 'authorization',
        timestamp: new Date(),
        ipAddress: req.securityContext?.ip || 'unknown',
        userAgent: req.securityContext?.userAgent || 'unknown'
      });

      next();
    } catch (error) {
      res.status(403).json({
        error: 'Authorization failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        requestId: req.requestId
      });
    }
  };
};

// Apply security headers middleware
export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"]
    }
  },
  crossOriginEmbedderPolicy: true,
  crossOriginOpenerPolicy: true,
  crossOriginResourcePolicy: { policy: "same-site" },
  dnsPrefetchControl: true,
  frameguard: { action: 'deny' },
  hidePoweredBy: true,
  hsts: true,
  ieNoOpen: true,
  noSniff: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  xssFilter: true
});

// Export rate limiter for use in routes
export { rateLimiter };
```

This implementation provides a comprehensive authentication and authorization middleware with the following key features:

1. Enhanced JWT token validation with security checks
2. Role-based access control with granular permissions
3. Session management with inactivity tracking
4. Security context tracking for audit purposes
5. Rate limiting protection
6. Security headers using Helmet
7. IP validation and MFA enforcement options
8. Comprehensive error handling and logging
9. Activity tracking for security events

The middleware can be used in routes like this:

```typescript
router.get('/protected',
  rateLimiter,
  securityHeaders,
  authenticate,
  authorize({
    allowedRoles: ['admin'],
    requireVerified: true,
    securityOptions: {
      enforceIPCheck: true,
      requireMFA: true,
      maxInactivityTime: 3600000 // 1 hour
    }
  }),
  protectedRouteHandler
);