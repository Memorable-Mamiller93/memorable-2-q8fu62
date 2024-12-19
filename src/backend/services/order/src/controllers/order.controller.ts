// @package express ^4.18.0 - Express request/response types
import { Request, Response } from 'express';
// @package http-errors ^2.0.0 - HTTP error handling
import createHttpError from 'http-errors';
// @package express-async-handler ^1.2.0 - Async request handling
import asyncHandler from 'express-async-handler';
// @package winston ^3.8.0 - Enhanced logging
import { Logger } from 'winston';
// @package @company/metrics ^1.0.0 - Performance monitoring
import { MetricsService } from '@company/metrics';

import { OrderService } from '../services/order.service';
import { validateCreateOrder, validateUpdateOrder } from '../middleware/validation.middleware';

/**
 * Enhanced OrderController implementing comprehensive order management
 * with validation, security checks, and performance monitoring
 */
export class OrderController {
  constructor(
    private readonly orderService: OrderService,
    private readonly metricsService: MetricsService,
    private readonly logger: Logger
  ) {}

  /**
   * Creates a new order with comprehensive validation and security checks
   */
  public createOrder = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const startTime = Date.now();
    const requestId = req.headers['x-request-id'] || crypto.randomUUID();

    this.logger.info('Creating new order', {
      requestId,
      userId: req.user?.id,
      bookId: req.body.bookId
    });

    try {
      // Validate request payload
      await validateCreateOrder(req, res, () => {});

      // Create order with security context
      const order = await this.orderService.createOrder({
        ...req.body,
        userId: req.user?.id,
        securityContext: {
          userId: req.user?.id,
          sessionId: req.sessionID,
          ipAddress: req.ip,
          userAgent: req.headers['user-agent']
        },
        idempotencyKey: req.headers['idempotency-key'] as string
      });

      // Record performance metrics
      const processingTime = Date.now() - startTime;
      this.metricsService.recordOrderCreation(processingTime, {
        success: true,
        region: req.headers['x-region']
      });

      res.status(201).json({
        success: true,
        data: order,
        meta: {
          requestId,
          processingTime
        }
      });
    } catch (error) {
      this.logger.error('Order creation failed', {
        error: error.message,
        requestId,
        userId: req.user?.id
      });
      throw error;
    }
  });

  /**
   * Retrieves order details with security validation
   */
  public getOrder = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const startTime = Date.now();
    const requestId = req.headers['x-request-id'] || crypto.randomUUID();

    try {
      const orderId = req.params.orderId;
      
      // Validate order access authorization
      if (!req.user?.id) {
        throw createHttpError(401, 'Authentication required');
      }

      const order = await this.orderService.getOrderDetails(orderId, {
        userId: req.user.id,
        securityContext: {
          sessionId: req.sessionID,
          ipAddress: req.ip
        }
      });

      // Record metrics
      const processingTime = Date.now() - startTime;
      this.metricsService.recordOrderRetrieval(processingTime);

      res.status(200).json({
        success: true,
        data: order,
        meta: {
          requestId,
          processingTime
        }
      });
    } catch (error) {
      this.logger.error('Order retrieval failed', {
        error: error.message,
        requestId,
        orderId: req.params.orderId
      });
      throw error;
    }
  });

  /**
   * Updates order status with transition validation
   */
  public updateOrderStatus = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const startTime = Date.now();
    const requestId = req.headers['x-request-id'] || crypto.randomUUID();

    try {
      const { orderId } = req.params;
      
      // Validate update payload
      await validateUpdateOrder(req, res, () => {});

      const updatedOrder = await this.orderService.updateOrderStatus(
        orderId,
        req.body.status,
        {
          userId: req.user?.id,
          metadata: req.body.metadata,
          securityContext: {
            sessionId: req.sessionID,
            ipAddress: req.ip
          }
        }
      );

      // Record metrics
      const processingTime = Date.now() - startTime;
      this.metricsService.recordOrderUpdate(processingTime, {
        status: req.body.status
      });

      res.status(200).json({
        success: true,
        data: updatedOrder,
        meta: {
          requestId,
          processingTime
        }
      });
    } catch (error) {
      this.logger.error('Order status update failed', {
        error: error.message,
        requestId,
        orderId: req.params.orderId
      });
      throw error;
    }
  });

  /**
   * Cancels order with validation and refund handling
   */
  public cancelOrder = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const startTime = Date.now();
    const requestId = req.headers['x-request-id'] || crypto.randomUUID();

    try {
      const { orderId } = req.params;

      const cancelledOrder = await this.orderService.cancelOrder(
        orderId,
        {
          userId: req.user?.id,
          reason: req.body.reason,
          refundRequired: req.body.refundRequired,
          securityContext: {
            sessionId: req.sessionID,
            ipAddress: req.ip
          }
        }
      );

      // Record metrics
      const processingTime = Date.now() - startTime;
      this.metricsService.recordOrderCancellation(processingTime, {
        refundRequired: req.body.refundRequired
      });

      res.status(200).json({
        success: true,
        data: cancelledOrder,
        meta: {
          requestId,
          processingTime
        }
      });
    } catch (error) {
      this.logger.error('Order cancellation failed', {
        error: error.message,
        requestId,
        orderId: req.params.orderId
      });
      throw error;
    }
  });

  /**
   * Retrieves user's orders with pagination and filtering
   */
  public getUserOrders = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const startTime = Date.now();
    const requestId = req.headers['x-request-id'] || crypto.randomUUID();

    try {
      if (!req.user?.id) {
        throw createHttpError(401, 'Authentication required');
      }

      const filters = {
        status: req.query.status as string,
        fromDate: req.query.fromDate as string,
        toDate: req.query.toDate as string
      };

      const pagination = {
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 10
      };

      const orders = await this.orderService.getUserOrders(
        req.user.id,
        filters,
        pagination,
        {
          securityContext: {
            sessionId: req.sessionID,
            ipAddress: req.ip
          }
        }
      );

      // Record metrics
      const processingTime = Date.now() - startTime;
      this.metricsService.recordOrderListing(processingTime);

      res.status(200).json({
        success: true,
        data: orders.data,
        meta: {
          requestId,
          processingTime,
          pagination: orders.pagination
        }
      });
    } catch (error) {
      this.logger.error('User orders retrieval failed', {
        error: error.message,
        requestId,
        userId: req.user?.id
      });
      throw error;
    }
  });
}

export default OrderController;