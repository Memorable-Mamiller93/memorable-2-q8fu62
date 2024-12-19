// @package express ^4.18.0 - Express router for defining routes with type safety
import { Router } from 'express';
// @package express-jwt ^8.4.1 - Enhanced JWT authentication middleware
import { expressjwt as authenticate } from 'express-jwt';
// @package express-error-boundary ^1.0.0 - Error handling middleware
import errorBoundary from 'express-error-boundary';
// @package express-rate-limit ^6.7.0 - Rate limiting middleware
import rateLimit from 'express-rate-limit';
// @package winston ^3.8.0 - Enhanced logging
import { Logger } from 'winston';

import { OrderController } from '../controllers/order.controller';
import { validateCreateOrder, validateUpdateOrder } from '../middleware/validation.middleware';

/**
 * Configures rate limiting for order-related endpoints
 */
const createRateLimiter = (windowMs: number, max: number) => rateLimit({
  windowMs,
  max,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many requests, please try again later.',
    retryAfter: Math.ceil(windowMs / 1000)
  }
});

/**
 * Configures JWT authentication with enhanced security
 */
const jwtAuth = authenticate({
  secret: process.env.JWT_SECRET!,
  algorithms: ['RS256'],
  requestProperty: 'user',
  getToken: (req) => {
    if (req.headers.authorization?.split(' ')[0] === 'Bearer') {
      return req.headers.authorization.split(' ')[1];
    }
    return null;
  }
});

/**
 * Initializes and configures order routes with comprehensive middleware stack
 * @param orderController Initialized OrderController instance
 * @returns Configured Express router
 */
export function initializeRoutes(orderController: OrderController): Router {
  const router = Router({ strict: true });

  // Global middleware for all order routes
  router.use(jwtAuth);

  // Rate limiters for different endpoints
  const createOrderLimiter = createRateLimiter(60 * 1000, 10); // 10 requests per minute
  const getOrderLimiter = createRateLimiter(60 * 1000, 100); // 100 requests per minute
  const updateOrderLimiter = createRateLimiter(60 * 1000, 30); // 30 requests per minute

  /**
   * POST /orders
   * Creates a new order with validation and rate limiting
   */
  router.post('/orders',
    createOrderLimiter,
    validateCreateOrder,
    errorBoundary(orderController.createOrder)
  );

  /**
   * GET /orders/:id
   * Retrieves order details with caching and security validation
   */
  router.get('/orders/:id',
    getOrderLimiter,
    errorBoundary(orderController.getOrder)
  );

  /**
   * PUT /orders/:id
   * Updates order status with transition validation and security checks
   */
  router.put('/orders/:id',
    updateOrderLimiter,
    validateUpdateOrder,
    errorBoundary(orderController.updateOrderStatus)
  );

  /**
   * DELETE /orders/:id
   * Cancels an order with status validation and refund handling
   */
  router.delete('/orders/:id',
    updateOrderLimiter,
    errorBoundary(orderController.cancelOrder)
  );

  /**
   * GET /orders
   * Retrieves user's orders with pagination and filtering
   */
  router.get('/orders',
    getOrderLimiter,
    errorBoundary(orderController.getUserOrders)
  );

  // Error handling middleware
  router.use((err: any, req: any, res: any, next: any) => {
    console.error('Order Route Error:', err);
    res.status(err.status || 500).json({
      error: err.message || 'Internal Server Error',
      timestamp: new Date().toISOString(),
      path: req.path,
      requestId: req.headers['x-request-id']
    });
  });

  return router;
}

// Export configured router instance
export const orderRouter = initializeRoutes(new OrderController());

export default orderRouter;