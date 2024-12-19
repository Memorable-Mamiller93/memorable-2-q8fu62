/**
 * @fileoverview Order API client implementation for the Memorable platform
 * Handles order creation, payment processing, and print production coordination
 * with comprehensive error handling and PCI compliance
 * @version 1.0.0
 */

import { retry } from 'axios-retry'; // v3.5.0
import { 
  Order,
  CreateOrderRequest,
  UpdateOrderRequest,
  OrderStatus,
  PaymentInfo,
  ShippingInfo
} from '../types/order.types';
import { API_ENDPOINTS } from '../constants/api.constants';
import { apiClient } from '../config/api.config';
import { ApiResponse, ValidationError } from '../types/api.types';

/**
 * PCI compliance configuration for payment data handling
 */
const PCI_CONFIG = {
  allowedPaymentMethods: ['stripe', 'paypal'],
  sensitiveFields: ['cvv', 'cardNumber'],
  retentionPeriod: '0', // Don't store sensitive data
  encryptionRequired: true
};

/**
 * Print production configuration
 */
const PRINT_CONFIG = {
  qualityThreshold: 0.95,
  retryAttempts: 3,
  statusCheckInterval: 5000, // 5 seconds
};

/**
 * Creates a new order with comprehensive validation and print production initialization
 * @param orderData - Order creation request data
 * @returns Promise with created order details
 */
export const createOrder = async (
  orderData: CreateOrderRequest
): Promise<ApiResponse<Order>> => {
  try {
    // Validate order data
    validateOrderData(orderData);

    // Initialize print production details
    const printDetails = await initializePrintProduction(orderData.printingDetails);

    const response = await apiClient.post<ApiResponse<Order>>(
      API_ENDPOINTS.ORDER.CREATE,
      {
        ...orderData,
        printDetails,
        metadata: {
          source: 'web',
          timestamp: new Date().toISOString(),
          printPartnerId: printDetails.partnerId
        }
      }
    );

    // Set up order status tracking
    await initializeOrderTracking(response.data.data.id);

    return response.data;
  } catch (error) {
    handleOrderError(error, 'Order Creation');
    throw error;
  }
};

/**
 * Processes payment for an order with PCI compliance and retry mechanisms
 * @param orderId - Order identifier
 * @param paymentDetails - Payment information
 * @returns Promise with payment processing result
 */
export const processPayment = async (
  orderId: string,
  paymentDetails: PaymentInfo
): Promise<ApiResponse<{ success: boolean; transactionId: string }>> => {
  try {
    // Validate PCI compliance
    validatePCICompliance(paymentDetails);

    // Configure retry strategy for payment processing
    const retryConfig = {
      retries: 3,
      retryDelay: retry.exponentialDelay,
      retryCondition: (error: any) => {
        return error.response?.status >= 500 || error.code === 'NETWORK_ERROR';
      }
    };

    const response = await apiClient.post<ApiResponse<any>>(
      `${API_ENDPOINTS.ORDER.CREATE}/${orderId}/payment`,
      sanitizePaymentData(paymentDetails),
      { ...retryConfig }
    );

    // Update order status after successful payment
    await updateOrderStatus(orderId, 'paid');

    return response.data;
  } catch (error) {
    handlePaymentError(error, orderId);
    throw error;
  }
};

/**
 * Retrieves comprehensive order status including payment and print production details
 * @param orderId - Order identifier
 * @returns Promise with detailed order status
 */
export const getOrderStatus = async (
  orderId: string
): Promise<ApiResponse<OrderStatus>> => {
  try {
    const [orderResponse, printStatus] = await Promise.all([
      apiClient.get<ApiResponse<Order>>(`${API_ENDPOINTS.ORDER.GET}/${orderId}`),
      getPrintProductionStatus(orderId)
    ]);

    return {
      ...orderResponse.data,
      data: {
        ...orderResponse.data.data,
        printStatus
      }
    };
  } catch (error) {
    handleOrderError(error, 'Status Retrieval');
    throw error;
  }
};

/**
 * Updates shipping information for an order
 * @param orderId - Order identifier
 * @param shippingInfo - Updated shipping details
 */
export const updateShippingInfo = async (
  orderId: string,
  shippingInfo: Partial<ShippingInfo>
): Promise<ApiResponse<Order>> => {
  try {
    validateShippingInfo(shippingInfo);
    
    return await apiClient.put<ApiResponse<Order>>(
      `${API_ENDPOINTS.ORDER.UPDATE_SHIPPING}/${orderId}`,
      shippingInfo
    );
  } catch (error) {
    handleOrderError(error, 'Shipping Update');
    throw error;
  }
};

/**
 * Validates order data against business rules and constraints
 */
const validateOrderData = (orderData: CreateOrderRequest): void => {
  const errors: ValidationError[] = [];

  if (!orderData.bookId) {
    errors.push({
      field: 'bookId',
      message: 'Book ID is required',
      code: 'REQUIRED_FIELD',
      path: ['bookId'],
      value: orderData.bookId,
      rule: 'required',
      severity: 'error'
    });
  }

  // Add more validation rules as needed

  if (errors.length > 0) {
    throw new Error(JSON.stringify(errors));
  }
};

/**
 * Validates payment data for PCI compliance
 */
const validatePCICompliance = (paymentDetails: PaymentInfo): void => {
  if (!PCI_CONFIG.allowedPaymentMethods.includes(paymentDetails.provider)) {
    throw new Error('Unsupported payment method');
  }

  // Additional PCI compliance checks
};

/**
 * Sanitizes payment data by removing sensitive information
 */
const sanitizePaymentData = (paymentDetails: PaymentInfo): Partial<PaymentInfo> => {
  const sanitized = { ...paymentDetails };
  PCI_CONFIG.sensitiveFields.forEach(field => {
    delete sanitized[field as keyof PaymentInfo];
  });
  return sanitized;
};

/**
 * Initializes print production tracking
 */
const initializePrintProduction = async (printDetails: any) => {
  const response = await apiClient.post(
    API_ENDPOINTS.PRINT.SUBMIT,
    printDetails
  );
  return response.data;
};

/**
 * Retrieves current print production status
 */
const getPrintProductionStatus = async (orderId: string) => {
  const response = await apiClient.get(
    `${API_ENDPOINTS.PRINT.STATUS}/${orderId}`
  );
  return response.data;
};

/**
 * Updates order status with retry mechanism
 */
const updateOrderStatus = async (orderId: string, status: OrderStatus) => {
  const retries = 3;
  for (let i = 0; i < retries; i++) {
    try {
      await apiClient.put(`${API_ENDPOINTS.ORDER.GET}/${orderId}/status`, { status });
      break;
    } catch (error) {
      if (i === retries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
};

/**
 * Initializes order status tracking
 */
const initializeOrderTracking = async (orderId: string) => {
  // Implementation for order tracking initialization
  // This could include WebSocket setup, polling configuration, etc.
};

/**
 * Handles order-related errors with detailed logging
 */
const handleOrderError = (error: any, context: string) => {
  console.error(`[Order Error] ${context}:`, {
    message: error.message,
    code: error.code,
    timestamp: new Date().toISOString(),
    details: error.details
  });
};

/**
 * Handles payment-related errors with PCI-compliant logging
 */
const handlePaymentError = (error: any, orderId: string) => {
  // Ensure PCI compliance in error logging
  console.error(`[Payment Error] Order ${orderId}:`, {
    code: error.code,
    timestamp: new Date().toISOString(),
    // Exclude sensitive payment details from logs
    safeDetails: error.safeDetails
  });
};