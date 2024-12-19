// Stripe Service v1.0.0
// Implements PCI-compliant payment processing with enhanced security measures
// External dependencies:
// - stripe: ^12.0.0 - Stripe SDK for payment processing
// - winston: ^3.8.0 - Enhanced logging service
// - retry: ^0.13.0 - Retry mechanism with exponential backoff

import { injectable } from 'inversify';
import Stripe from 'stripe';
import { Logger } from 'winston';
import retry from 'retry';
import { paymentConfig } from '../config/payment.config';
import { Payment, PaymentAttributes } from '../models/payment.model';
import * as crypto from 'crypto';

// Enhanced interfaces for type safety
interface PaymentIntentRequest {
  amount: number;
  currency: string;
  paymentMethodId: string;
  orderId: string;
  metadata: Record<string, any>;
  riskLevel: RiskLevel;
  idempotencyKey: string;
}

interface PaymentConfirmation {
  status: string;
  transactionId: string;
  amount: number;
  currency: string;
  metadata: Record<string, any>;
  securityChecksum: string;
}

enum RiskLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high'
}

interface RetryOptions {
  retries: number;
  factor: number;
  minTimeout: number;
  maxTimeout: number;
}

@injectable()
export class StripeService {
  private readonly stripeClient: Stripe;
  private readonly logger: Logger;
  private readonly webhookTolerance: number;
  private readonly retryOptions: RetryOptions;

  constructor(logger: Logger) {
    // Initialize Stripe client with enhanced security configuration
    this.stripeClient = new Stripe(paymentConfig.stripe.apiKey, {
      apiVersion: paymentConfig.stripe.apiVersion,
      typescript: true,
      maxNetworkRetries: paymentConfig.stripe.maxRetries,
      timeout: paymentConfig.stripe.timeout,
    });

    this.logger = logger;
    this.webhookTolerance = paymentConfig.stripe.webhookTolerance;
    
    // Configure retry mechanism with exponential backoff
    this.retryOptions = {
      retries: paymentConfig.stripe.maxRetries,
      factor: 2,
      minTimeout: 1000,
      maxTimeout: 10000
    };
  }

  /**
   * Creates a new payment intent with enhanced security measures
   * @param request Payment intent request with validation parameters
   * @returns Promise resolving to validated payment intent
   */
  public async createPaymentIntent(request: PaymentIntentRequest): Promise<Stripe.PaymentIntent> {
    this.logger.info('Creating payment intent', { orderId: request.orderId });

    // Validate request parameters
    this.validatePaymentRequest(request);

    // Apply fraud detection rules based on risk level
    const fraudScore = await this.calculateFraudScore(request);
    if (fraudScore > paymentConfig.security.fraudDetection.threshold) {
      throw new Error('Transaction blocked due to high fraud risk');
    }

    try {
      // Create payment intent with retry mechanism
      const operation = retry.operation(this.retryOptions);
      
      return await new Promise((resolve, reject) => {
        operation.attempt(async (currentAttempt) => {
          try {
            const paymentIntent = await this.stripeClient.paymentIntents.create(
              {
                amount: request.amount,
                currency: request.currency.toLowerCase(),
                payment_method: request.paymentMethodId,
                confirm: false,
                metadata: {
                  orderId: request.orderId,
                  riskLevel: request.riskLevel,
                  ...request.metadata
                }
              },
              {
                idempotencyKey: request.idempotencyKey,
              }
            );

            // Store payment record with audit trail
            await this.createPaymentRecord(paymentIntent, request);
            
            resolve(paymentIntent);
          } catch (error) {
            if (operation.retry(error as Error)) {
              this.logger.warn('Retrying payment intent creation', { 
                attempt: currentAttempt,
                error: error.message 
              });
              return;
            }
            reject(error);
          }
        });
      });
    } catch (error) {
      this.logger.error('Failed to create payment intent', { 
        error: error.message,
        orderId: request.orderId 
      });
      throw error;
    }
  }

  /**
   * Confirms payment intent with enhanced security checks
   * @param paymentIntentId Stripe payment intent ID
   * @returns Promise resolving to secure payment confirmation
   */
  public async confirmPayment(paymentIntentId: string): Promise<PaymentConfirmation> {
    this.logger.info('Confirming payment intent', { paymentIntentId });

    try {
      // Retrieve and confirm payment intent with retry mechanism
      const operation = retry.operation(this.retryOptions);
      
      const confirmedIntent = await new Promise<Stripe.PaymentIntent>((resolve, reject) => {
        operation.attempt(async (currentAttempt) => {
          try {
            const intent = await this.stripeClient.paymentIntents.confirm(
              paymentIntentId,
              {
                return_url: `${process.env.PAYMENT_RETURN_URL}`,
              }
            );
            resolve(intent);
          } catch (error) {
            if (operation.retry(error as Error)) {
              this.logger.warn('Retrying payment confirmation', { 
                attempt: currentAttempt,
                error: error.message 
              });
              return;
            }
            reject(error);
          }
        });
      });

      // Update payment record with confirmation details
      await this.updatePaymentRecord(confirmedIntent);

      // Generate security checksum for confirmation
      const securityChecksum = this.generateSecurityChecksum(confirmedIntent);

      return {
        status: confirmedIntent.status,
        transactionId: confirmedIntent.id,
        amount: confirmedIntent.amount,
        currency: confirmedIntent.currency,
        metadata: confirmedIntent.metadata,
        securityChecksum
      };
    } catch (error) {
      this.logger.error('Failed to confirm payment', { 
        error: error.message,
        paymentIntentId 
      });
      throw error;
    }
  }

  /**
   * Processes Stripe webhooks with enhanced security and validation
   * @param signature Stripe webhook signature
   * @param rawBody Raw webhook payload
   */
  public async handleWebhook(signature: string, rawBody: Buffer): Promise<void> {
    try {
      // Verify webhook signature with configurable tolerance
      const event = this.stripeClient.webhooks.constructEvent(
        rawBody,
        signature,
        paymentConfig.stripe.webhookSecret,
        this.webhookTolerance
      );

      this.logger.info('Processing webhook event', { 
        type: event.type,
        id: event.id 
      });

      // Process different webhook event types
      switch (event.type) {
        case 'payment_intent.succeeded':
          await this.handlePaymentSuccess(event.data.object as Stripe.PaymentIntent);
          break;
        case 'payment_intent.payment_failed':
          await this.handlePaymentFailure(event.data.object as Stripe.PaymentIntent);
          break;
        // Add other webhook event handlers as needed
      }
    } catch (error) {
      this.logger.error('Webhook processing failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Private helper methods
   */

  private validatePaymentRequest(request: PaymentIntentRequest): void {
    if (!request.amount || request.amount <= 0) {
      throw new Error('Invalid payment amount');
    }
    if (!request.currency || request.currency.length !== 3) {
      throw new Error('Invalid currency code');
    }
    if (!request.paymentMethodId) {
      throw new Error('Payment method ID is required');
    }
    if (!request.idempotencyKey) {
      throw new Error('Idempotency key is required');
    }
  }

  private async calculateFraudScore(request: PaymentIntentRequest): Promise<number> {
    // Implement fraud detection logic based on risk level and other factors
    const baseScore = request.riskLevel === RiskLevel.HIGH ? 0.8 :
                     request.riskLevel === RiskLevel.MEDIUM ? 0.5 : 0.2;
    
    // Add additional fraud detection rules here
    return baseScore;
  }

  private async createPaymentRecord(intent: Stripe.PaymentIntent, request: PaymentIntentRequest): Promise<void> {
    await Payment.create({
      id: crypto.randomUUID(),
      orderId: request.orderId,
      amount: intent.amount,
      currency: intent.currency,
      status: 'PENDING',
      paymentMethod: 'CREDIT_CARD',
      paymentIntentId: intent.id,
      paymentMethodId: request.paymentMethodId,
      metadata: request.metadata,
      securityChecksum: this.generateSecurityChecksum(intent),
      auditLog: [{
        timestamp: new Date(),
        action: 'CREATE',
        actor: 'SYSTEM',
        details: { intentId: intent.id }
      }]
    });
  }

  private generateSecurityChecksum(intent: Stripe.PaymentIntent): string {
    const data = `${intent.id}:${intent.amount}:${intent.currency}:${intent.status}`;
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  private async handlePaymentSuccess(intent: Stripe.PaymentIntent): Promise<void> {
    await Payment.update(
      {
        status: 'COMPLETED',
        transactionId: intent.id,
        auditLog: sequelize.fn('array_append', 
          sequelize.col('auditLog'),
          {
            timestamp: new Date(),
            action: 'COMPLETE',
            actor: 'STRIPE',
            details: { intentId: intent.id }
          }
        )
      },
      {
        where: { paymentIntentId: intent.id }
      }
    );
  }

  private async handlePaymentFailure(intent: Stripe.PaymentIntent): Promise<void> {
    await Payment.update(
      {
        status: 'FAILED',
        errorMessage: intent.last_payment_error?.message,
        auditLog: sequelize.fn('array_append', 
          sequelize.col('auditLog'),
          {
            timestamp: new Date(),
            action: 'FAIL',
            actor: 'STRIPE',
            details: { 
              intentId: intent.id,
              error: intent.last_payment_error?.message 
            }
          }
        )
      },
      {
        where: { paymentIntentId: intent.id }
      }
    );
  }
}