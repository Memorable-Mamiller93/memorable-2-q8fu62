import { Request, Response, NextFunction } from 'express'; // v4.18.0
import Joi from 'joi'; // v17.9.0
import { OrderAttributes } from '../models/order.model';
import { PaymentAttributes } from '../models/payment.model';

/**
 * Enhanced validation schema for order creation with comprehensive validation rules
 */
const orderCreateSchema = Joi.object({
  bookId: Joi.string().uuid().required()
    .messages({
      'string.guid': 'Book ID must be a valid UUID',
      'any.required': 'Book ID is required'
    }),
  amount: Joi.number().positive().max(10000.00).precision(2).required()
    .messages({
      'number.base': 'Amount must be a valid number',
      'number.positive': 'Amount must be positive',
      'number.max': 'Amount cannot exceed 10000.00',
      'any.required': 'Amount is required'
    }),
  currency: Joi.string().length(3).uppercase().valid('USD', 'EUR', 'GBP').required()
    .messages({
      'string.length': 'Currency must be a 3-letter code',
      'any.only': 'Currency must be one of USD, EUR, or GBP'
    }),
  shippingAddress: Joi.object({
    street: Joi.string().min(5).max(100).required(),
    city: Joi.string().min(2).max(50).required(),
    state: Joi.string().length(2).uppercase().required(),
    country: Joi.string().length(2).uppercase().required(),
    postalCode: Joi.string().pattern(/^[A-Z0-9\s-]{3,10}$/).required(),
    phone: Joi.string().pattern(/^\+?[\d\s-]{10,}$/).required()
  }).required()
    .messages({
      'object.base': 'Shipping address must be a valid object',
      'any.required': 'Shipping address is required'
    }),
  shippingMethod: Joi.string().valid('STANDARD', 'EXPRESS', 'PRIORITY').required()
    .messages({
      'any.only': 'Invalid shipping method selected'
    }),
  metadata: Joi.object().optional()
});

/**
 * Enhanced validation schema for order updates with status transition rules
 */
const orderUpdateSchema = Joi.object({
  status: Joi.string()
    .valid('PENDING', 'PROCESSING', 'CONFIRMED', 'PRINTING', 'SHIPPED', 'DELIVERED', 'CANCELLED')
    .required()
    .messages({
      'any.only': 'Invalid order status',
      'any.required': 'Order status is required'
    }),
  trackingNumber: Joi.string()
    .pattern(/^[A-Z0-9]{8,30}$/)
    .when('status', {
      is: 'SHIPPED',
      then: Joi.required(),
      otherwise: Joi.optional()
    })
    .messages({
      'string.pattern.base': 'Invalid tracking number format'
    }),
  printerId: Joi.string().uuid()
    .when('status', {
      is: 'PRINTING',
      then: Joi.required(),
      otherwise: Joi.optional()
    }),
  metadata: Joi.object().optional()
});

/**
 * PCI DSS compliant validation schema for payment creation
 */
const paymentCreateSchema = Joi.object({
  orderId: Joi.string().uuid().required()
    .messages({
      'string.guid': 'Order ID must be a valid UUID',
      'any.required': 'Order ID is required'
    }),
  amount: Joi.number().positive().max(10000.00).precision(2).required()
    .messages({
      'number.base': 'Amount must be a valid number',
      'number.positive': 'Amount must be positive',
      'number.max': 'Amount cannot exceed 10000.00'
    }),
  currency: Joi.string().length(3).uppercase().valid('USD', 'EUR', 'GBP').required(),
  paymentMethod: Joi.string()
    .valid('CREDIT_CARD', 'DEBIT_CARD', 'PAYPAL', 'BANK_TRANSFER')
    .required()
    .messages({
      'any.only': 'Invalid payment method'
    }),
  paymentMethodId: Joi.string()
    .pattern(/^[A-Za-z0-9_-]{10,50}$/)
    .required()
    .messages({
      'string.pattern.base': 'Invalid payment method ID format'
    }),
  metadata: Joi.object().optional()
}).options({ stripUnknown: true }); // Remove any unrecognized fields for security

/**
 * Enhanced validation schema for refund requests
 */
const refundRequestSchema = Joi.object({
  paymentId: Joi.string().uuid().required()
    .messages({
      'string.guid': 'Payment ID must be a valid UUID',
      'any.required': 'Payment ID is required'
    }),
  amount: Joi.number().positive().max(10000.00).precision(2).required()
    .messages({
      'number.base': 'Refund amount must be a valid number',
      'number.positive': 'Refund amount must be positive',
      'number.max': 'Refund amount cannot exceed 10000.00'
    }),
  reason: Joi.string().min(10).max(500).required()
    .messages({
      'string.min': 'Refund reason must be at least 10 characters',
      'string.max': 'Refund reason cannot exceed 500 characters'
    }),
  metadata: Joi.object().optional()
});

/**
 * Validates create order request payload with enhanced shipping address validation
 */
export const validateCreateOrder = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    await orderCreateSchema.validateAsync(req.body, { abortEarly: false });
    next();
  } catch (error) {
    if (error instanceof Error) {
      res.status(400).json({
        error: 'Validation Error',
        details: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }
};

/**
 * Validates order update request payload with status transition rules
 */
export const validateUpdateOrder = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    await orderUpdateSchema.validateAsync(req.body, { abortEarly: false });
    next();
  } catch (error) {
    if (error instanceof Error) {
      res.status(400).json({
        error: 'Validation Error',
        details: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }
};

/**
 * Validates payment creation request payload with PCI DSS compliance
 */
export const validateCreatePayment = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    await paymentCreateSchema.validateAsync(req.body, { 
      abortEarly: false,
      stripUnknown: true // Remove any unrecognized fields for security
    });
    next();
  } catch (error) {
    if (error instanceof Error) {
      // Sanitize error messages for PCI compliance
      const sanitizedError = error.message.replace(/card|credit|debit/gi, '[REDACTED]');
      res.status(400).json({
        error: 'Payment Validation Error',
        details: sanitizedError,
        timestamp: new Date().toISOString()
      });
    }
  }
};

/**
 * Validates payment refund request payload with enhanced amount validation
 */
export const validateRefundRequest = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    await refundRequestSchema.validateAsync(req.body, { abortEarly: false });
    next();
  } catch (error) {
    if (error instanceof Error) {
      res.status(400).json({
        error: 'Refund Validation Error',
        details: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }
};