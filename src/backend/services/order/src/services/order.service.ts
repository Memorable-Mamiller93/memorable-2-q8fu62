// @package bull ^4.10.0 - Redis-backed queue management
import Bull from 'bull';
// @package winston ^3.8.0 - Structured logging
import { Logger } from 'winston';
// @package http-errors ^2.0.0 - Enhanced error handling
import createHttpError from 'http-errors';

import { Order } from '../models/order.model';
import { PaymentService } from './payment.service';
import { PrintService } from '../../print/src/services/print.service';
import { sequelize } from '../config/database.config';

/**
 * Enhanced interface for order creation with security context
 */
interface CreateOrderRequest {
  userId: string;
  bookId: string;
  amount: number;
  currency: string;
  paymentMethod: string;
  paymentMethodId: string;
  shippingAddress: ShippingAddress;
  shippingMethod: string;
  metadata: Record<string, any>;
  idempotencyKey: string;
  securityContext: SecurityContext;
}

interface ShippingAddress {
  street: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
  phone: string;
}

interface SecurityContext {
  userId: string;
  sessionId: string;
  ipAddress: string;
  userAgent: string;
}

interface OrderResponse {
  orderId: string;
  status: OrderStatus;
  amount: number;
  currency: string;
  paymentStatus: PaymentStatus;
  printStatus: PrintJobStatus;
  trackingNumber: string | null;
  createdAt: Date;
  auditLog: AuditRecord[];
  performanceMetrics: PerformanceMetrics;
}

interface AuditRecord {
  timestamp: Date;
  action: string;
  actor: string;
  details: Record<string, any>;
}

interface PerformanceMetrics {
  processingTime: number;
  paymentProcessingTime: number;
  printJobCreationTime: number;
}

enum OrderStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  CONFIRMED = 'CONFIRMED',
  PRINTING = 'PRINTING',
  SHIPPED = 'SHIPPED',
  DELIVERED = 'DELIVERED',
  CANCELLED = 'CANCELLED',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED'
}

enum PaymentStatus {
  PENDING = 'PENDING',
  AUTHORIZED = 'AUTHORIZED',
  CAPTURED = 'CAPTURED',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED'
}

enum PrintJobStatus {
  QUEUED = 'QUEUED',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED'
}

/**
 * Enhanced service class for order lifecycle management with performance optimization
 */
export class OrderService {
  private readonly orderQueue: Bull.Queue;
  private readonly logger: Logger;
  private readonly metrics: any;
  private readonly cache: any;

  constructor(
    private readonly paymentService: PaymentService,
    private readonly printService: PrintService,
    metrics: any,
    cache: any
  ) {
    // Initialize Bull queue with optimized settings
    this.orderQueue = new Bull('order-processing', {
      redis: {
        host: process.env.REDIS_HOST,
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD
      },
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000
        },
        removeOnComplete: false
      }
    });

    this.logger = this.initializeLogger();
    this.metrics = metrics;
    this.cache = cache;

    this.initializeQueueProcessors();
  }

  /**
   * Creates new order with enhanced security and monitoring
   * @param orderRequest Order creation request with validation parameters
   * @returns Promise<OrderResponse> Created order details with performance metrics
   */
  public async createOrder(orderRequest: CreateOrderRequest): Promise<OrderResponse> {
    const startTime = Date.now();
    const trx = await sequelize.transaction();

    try {
      // Validate security context
      this.validateSecurityContext(orderRequest.securityContext);

      // Check idempotency
      const existingOrder = await this.checkIdempotency(orderRequest.idempotencyKey);
      if (existingOrder) {
        return this.buildOrderResponse(existingOrder);
      }

      // Create order record
      const order = await Order.create({
        userId: orderRequest.userId,
        bookId: orderRequest.bookId,
        amount: orderRequest.amount,
        currency: orderRequest.currency,
        status: OrderStatus.PENDING,
        shippingAddress: orderRequest.shippingAddress,
        shippingMethod: orderRequest.shippingMethod,
        metadata: {
          ...orderRequest.metadata,
          securityContext: orderRequest.securityContext,
          idempotencyKey: orderRequest.idempotencyKey
        }
      }, { transaction: trx });

      // Process payment
      const paymentStartTime = Date.now();
      const payment = await this.paymentService.processPayment({
        orderId: order.id,
        amount: orderRequest.amount,
        currency: orderRequest.currency,
        paymentMethod: orderRequest.paymentMethod,
        paymentMethodId: orderRequest.paymentMethodId,
        metadata: orderRequest.metadata,
        securityContext: orderRequest.securityContext,
        idempotencyKey: orderRequest.idempotencyKey
      });

      const paymentProcessingTime = Date.now() - paymentStartTime;

      // Create print job
      const printStartTime = Date.now();
      const printJob = await this.printService.createPrintJob(
        order.id,
        order.bookId,
        {
          colorSpace: 'CMYK',
          resolution: 300,
          bleed: 3,
          paperType: 'FSC-certified-matte',
          paperWeight: 200,
          printMarks: {
            cropMarks: true,
            registrationMarks: true,
            colorBars: true,
            pageInformation: true
          }
        },
        'strict'
      );

      const printJobCreationTime = Date.now() - printStartTime;

      // Update order status
      await order.update({
        status: OrderStatus.PROCESSING,
        paymentId: payment.paymentId,
        printJobId: printJob.id
      }, { transaction: trx });

      // Queue order processing
      await this.orderQueue.add('process-order', {
        orderId: order.id,
        paymentId: payment.paymentId,
        printJobId: printJob.id
      });

      await trx.commit();

      // Log performance metrics
      const totalProcessingTime = Date.now() - startTime;
      this.metrics.recordOrderProcessing(totalProcessingTime, paymentProcessingTime, printJobCreationTime);

      return this.buildOrderResponse(order, {
        processingTime: totalProcessingTime,
        paymentProcessingTime,
        printJobCreationTime
      });

    } catch (error) {
      await trx.rollback();
      this.logger.error('Order creation failed', {
        error: error.message,
        userId: orderRequest.userId,
        bookId: orderRequest.bookId
      });
      throw error;
    }
  }

  /**
   * Private helper methods
   */

  private initializeLogger(): Logger {
    // Implementation of logger initialization
    return {} as Logger;
  }

  private initializeQueueProcessors(): void {
    this.orderQueue.process('process-order', async (job) => {
      const { orderId, paymentId, printJobId } = job.data;
      
      try {
        // Confirm payment
        await this.paymentService.confirmPayment(paymentId, {
          orderId,
          userId: job.data.userId,
          sessionId: job.data.sessionId
        });

        // Update order status
        await Order.update(
          { status: OrderStatus.CONFIRMED },
          { where: { id: orderId } }
        );

        this.logger.info('Order processed successfully', { orderId });
      } catch (error) {
        this.logger.error('Order processing failed', {
          error: error.message,
          orderId
        });
        throw error;
      }
    });
  }

  private validateSecurityContext(context: SecurityContext): void {
    if (!context.userId || !context.sessionId) {
      throw createHttpError(401, 'Invalid security context');
    }
  }

  private async checkIdempotency(idempotencyKey: string): Promise<Order | null> {
    return await Order.findOne({
      where: {
        'metadata.idempotencyKey': idempotencyKey
      }
    });
  }

  private buildOrderResponse(
    order: Order,
    metrics?: PerformanceMetrics
  ): OrderResponse {
    return {
      orderId: order.id,
      status: order.status as OrderStatus,
      amount: order.amount,
      currency: order.currency,
      paymentStatus: order.payment?.status as PaymentStatus,
      printStatus: order.printJob?.status as PrintJobStatus,
      trackingNumber: order.trackingNumber,
      createdAt: order.createdAt,
      auditLog: order.auditLog,
      performanceMetrics: metrics || {
        processingTime: 0,
        paymentProcessingTime: 0,
        printJobCreationTime: 0
      }
    };
  }
}

export default OrderService;