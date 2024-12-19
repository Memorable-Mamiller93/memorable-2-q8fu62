// External imports with versions
import { Router } from 'express'; // @version ^4.18.2
import rateLimit from 'express-rate-limit'; // @version ^6.7.0
import helmet from 'helmet'; // @version ^7.0.0

// Internal imports
import { AuthController } from '../controllers/auth.controller';
import { 
  validateRegistration, 
  validateLogin, 
  validatePasswordReset 
} from '../middleware/validation.middleware';
import { authenticate, securityHeaders } from '../middleware/auth.middleware';
import { authConfig } from '../config/auth.config';

/**
 * Creates a progressive rate limiter with increasing restrictions
 * based on user behavior and status
 */
const createProgressiveRateLimit = ({ 
  baseWindow, 
  baseMax, 
  userMultiplier 
}: {
  baseWindow: number;
  baseMax: number;
  userMultiplier: number;
}) => rateLimit({
  windowMs: baseWindow,
  max: (req) => {
    // Authenticated users get higher limits
    if (req.user) {
      return baseMax * userMultiplier;
    }
    return baseMax;
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  handler: (req, res) => {
    res.status(429).json({
      error: 'Too many requests',
      retryAfter: Math.ceil(baseWindow / 1000)
    });
  }
});

/**
 * Creates and configures the authentication router with enhanced security,
 * monitoring, and GDPR compliance
 */
const createAuthRouter = (): Router => {
  const router = Router();
  const authController = new AuthController();

  // Apply security headers to all routes
  router.use(securityHeaders);

  // Configure progressive rate limiting
  const progressiveRateLimiter = createProgressiveRateLimit({
    baseWindow: 15 * 60 * 1000, // 15 minutes
    baseMax: 100,
    userMultiplier: 2
  });

  // Registration endpoint with GDPR compliance
  router.post(
    '/register',
    progressiveRateLimiter,
    validateRegistration,
    async (req, res) => {
      try {
        const result = await authController.register(req, res);
        return result;
      } catch (error) {
        return res.status(500).json({
          error: 'Registration failed',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  );

  // Login endpoint with enhanced security tracking
  router.post(
    '/login',
    progressiveRateLimiter,
    validateLogin,
    async (req, res) => {
      try {
        const result = await authController.login(req, res);
        return result;
      } catch (error) {
        return res.status(500).json({
          error: 'Login failed',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  );

  // Token refresh endpoint with security validation
  router.post(
    '/refresh-token',
    progressiveRateLimiter,
    authenticate,
    async (req, res) => {
      try {
        const result = await authController.refreshToken(req, res);
        return result;
      } catch (error) {
        return res.status(500).json({
          error: 'Token refresh failed',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  );

  // Password reset endpoint with security checks
  router.post(
    '/reset-password',
    progressiveRateLimiter,
    validatePasswordReset,
    async (req, res) => {
      try {
        const result = await authController.resetPassword(req, res);
        return result;
      } catch (error) {
        return res.status(500).json({
          error: 'Password reset failed',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  );

  // Account deletion endpoint with GDPR compliance
  router.post(
    '/delete-account',
    progressiveRateLimiter,
    authenticate,
    async (req, res) => {
      try {
        const result = await authController.deleteAccount(req, res);
        return result;
      } catch (error) {
        return res.status(500).json({
          error: 'Account deletion failed',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  );

  // GDPR data export endpoint
  router.get(
    '/export-data',
    authenticate,
    async (req, res) => {
      try {
        // Implement GDPR data export logic
        const userData = await authController.exportUserData(req.user!.id);
        return res.json(userData);
      } catch (error) {
        return res.status(500).json({
          error: 'Data export failed',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  );

  // Consent management endpoint
  router.put(
    '/consent',
    authenticate,
    async (req, res) => {
      try {
        const { consents } = req.body;
        const result = await authController.updateConsents(req.user!.id, consents);
        return res.json(result);
      } catch (error) {
        return res.status(500).json({
          error: 'Consent update failed',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  );

  return router;
};

// Create and export the configured router
const router = createAuthRouter();
export { router };