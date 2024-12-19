// Payment Controller v1.0.0
// Implements PCI-compliant payment processing with comprehensive security measures

import { Request, Response, NextFunction } from 'express'; // v4.18.0
import { injectable, inject } from 'inversify';
import { Controller, Post, Get, Put } from '@decorators/express';
import { UseGuards, UseInterceptors } from '@decorators/express';
import { ValidateBody } from '@decorators/express-validator';
import createHttpError from 'http-errors'; // v2.0.0
import { Logger } from 'winston'; // v3.8.0
import { RateLimiter } from '../middleware/rate-limiter';
import { IdempotencyInterceptor } from '../interceptors/idempotency.interceptor';
import { AuthGuard } from '../guards/auth.guard';
import { PaymentService } from '../services/payment.service';
import { paymentConfig } from '../config/payment.config';

// Enhanced interfaces for request/response types
interface ProcessPaymentRequest {
  orderId: string;
  amount: number;
  currency: string;
  paymentMethod: string;
  paymentMethodId: string;
  metadata: Record<string, any>;
  idempotencyKey: string;
}

interface SecurityContext {
  userId: string;
  sessionId: string;
  ipAddress: string;
  userAgent: string;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
}

// Payment validation schema
const ProcessPaymentSchema = {
  orderId: { type: 'string', required: true },
  amount: { type: 'number', required: true, min: 0.01 },
  currency: { type: 'string', required: true, length: 3 },
  paymentMethod: { type: 'string', required: true },
  paymentMethodId: { type: 'string', required: true },
  metadata: { type: 'object', required: true },
  idempotencyKey: { type: 'string', required: true }
};

@injectable()
@Controller('/payments')
@UseGuards(AuthGuard)
export class PaymentController {
  constructor(
    @inject('PaymentService') private readonly paymentService: PaymentService,
    @inject('Logger') private readonly logger: Logger,
    @inject('RateLimiter') private readonly rateLimiter: RateLimiter
  ) {}

  /**
   * Process new payment with PCI compliance and security measures
   * @param req Express request object
   * @param res Express response object
   * @param next Express next function
   */
  @Post('/process')
  @ValidateBody(ProcessPaymentSchema)
  @UseInterceptors(IdempotencyInterceptor)
  public async processPayment(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const startTime = Date.now();

    try {
      // Rate limiting check
      await this.rateLimiter.checkLimit(req);

      // Build security context
      const securityContext: SecurityContext = {
        userId: req.user?.id,
        sessionId: req.sessionID,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'] || '',
        riskLevel: this.calculateRiskLevel(req)
      };

      // Validate and sanitize request data
      const paymentRequest: ProcessPaymentRequest = {
        orderId: req.body.orderId,
        amount: Math.round(req.body.amount * 100), // Convert to cents
        currency: req.body.currency.toUpperCase(),
        paymentMethod: req.body.paymentMethod,
        paymentMethodId: req.body.paymentMethodId,
        metadata: this.sanitizeMetadata(req.body.metadata),
        idempotencyKey: req.body.idempotencyKey
      };

      // Log sanitized request (excluding sensitive data)
      this.logger.info('Processing payment request', {
        orderId: paymentRequest.orderId,
        amount: paymentRequest.amount,
        currency: paymentRequest.currency,
        method: paymentRequest.paymentMethod
      });

      // Process payment through service
      const paymentResponse = await this.paymentService.processPayment({
        ...paymentRequest,
        securityContext
      });

      // Log success (excluding sensitive data)
      this.logger.info('Payment processed successfully', {
        paymentId: paymentResponse.paymentId,
        orderId: paymentRequest.orderId,
        processingTime: Date.now() - startTime
      });

      res.status(200).json({
        success: true,
        paymentId: paymentResponse.paymentId,
        status: paymentResponse.status,
        processingTime: Date.now() - startTime
      });

    } catch (error) {
      // Log error (excluding sensitive data)
      this.logger.error('Payment processing failed', {
        error: error.message,
        orderId: req.body?.orderId,
        processingTime: Date.now() - startTime
      });

      next(error);
    }
  }

  /**
   * Confirm payment with security validation
   */
  @Put('/confirm/:paymentId')
  @UseInterceptors(IdempotencyInterceptor)
  public async confirmPayment(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const securityContext: SecurityContext = {
        userId: req.user?.id,
        sessionId: req.sessionID,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'] || '',
        riskLevel: this.calculateRiskLevel(req)
      };

      const confirmation = await this.paymentService.confirmPayment(
        req.params.paymentId,
        securityContext
      );

      res.status(200).json({
        success: true,
        status: confirmation.status,
        transactionId: confirmation.transactionId
      });

    } catch (error) {
      next(error);
    }
  }

  /**
   * Handle Stripe webhooks with signature verification
   */
  @Post('/webhook')
  public async handleWebhook(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const signature = req.headers['stripe-signature'];
      
      if (!signature) {
        throw createHttpError(400, 'Missing Stripe signature');
      }

      await this.paymentService.verifyWebhookSignature(
        signature as string,
        req.rawBody
      );

      res.status(200).json({ received: true });

    } catch (error) {
      next(error);
    }
  }

  /**
   * Get payment status with security validation
   */
  @Get('/:paymentId/status')
  public async getPaymentStatus(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const status = await this.paymentService.getPaymentStatus(
        req.params.paymentId,
        req.user?.id
      );

      res.status(200).json(status);

    } catch (error) {
      next(error);
    }
  }

  /**
   * Private helper methods
   */

  private calculateRiskLevel(req: Request): SecurityContext['riskLevel'] {
    // Implement risk scoring based on request parameters
    const riskFactors = {
      newIp: !this.isKnownIp(req.ip),
      newUserAgent: !this.isKnownUserAgent(req.headers['user-agent']),
      highAmount: req.body?.amount > paymentConfig.security.highAmountThreshold,
      suspiciousPattern: this.checkSuspiciousPattern(req)
    };

    if (Object.values(riskFactors).filter(Boolean).length >= 3) {
      return 'HIGH';
    } else if (Object.values(riskFactors).filter(Boolean).length >= 1) {
      return 'MEDIUM';
    }
    return 'LOW';
  }

  private sanitizeMetadata(metadata: Record<string, any>): Record<string, any> {
    // Remove any sensitive or invalid data from metadata
    const sanitized = { ...metadata };
    const sensitiveKeys = ['password', 'token', 'secret', 'card'];
    
    Object.keys(sanitized).forEach(key => {
      if (sensitiveKeys.some(sk => key.toLowerCase().includes(sk))) {
        delete sanitized[key];
      }
    });

    return sanitized;
  }

  private isKnownIp(ip: string): boolean {
    // Implement IP verification logic
    return paymentConfig.security.allowedIPs.includes(ip);
  }

  private isKnownUserAgent(userAgent?: string): boolean {
    // Implement user agent verification logic
    return !!userAgent && userAgent.length > 0;
  }

  private checkSuspiciousPattern(req: Request): boolean {
    // Implement suspicious pattern detection
    return false; // Placeholder implementation
  }
}