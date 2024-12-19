/**
 * @fileoverview Order type definitions for the Memorable platform frontend
 * Implements comprehensive order processing, payment, shipping, and print production types
 * @version 1.0.0
 */

import { Book, BookMetadata } from './book.types';
import { User } from './user.types';
import { ApiResponse, ValidationError } from './api.types';

/**
 * Enhanced payment information interface with validation
 */
interface PaymentInfo {
  /** Payment method identifier */
  paymentMethodId: string;
  /** Payment provider (e.g., stripe, paypal) */
  provider: 'stripe' | 'paypal';
  /** Last 4 digits of payment card if applicable */
  lastFour?: string;
  /** Payment status with detailed tracking */
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'refunded';
  /** Transaction reference from payment provider */
  transactionId?: string;
  /** Payment receipt URL */
  receiptUrl?: string;
  /** Payment method expiry if applicable */
  expiryDate?: string;
}

/**
 * Comprehensive shipping information interface
 */
interface ShippingInfo {
  /** Full name of recipient */
  recipientName: string;
  /** Validated street address */
  streetAddress: string;
  /** Optional apartment/unit number */
  unit?: string;
  /** City name */
  city: string;
  /** State/province code */
  state: string;
  /** Postal/ZIP code */
  postalCode: string;
  /** ISO 3166-1 alpha-2 country code */
  countryCode: string;
  /** Contact phone number */
  phoneNumber: string;
  /** Shipping method selection */
  method: 'standard' | 'express' | 'priority';
  /** Tracking number when available */
  trackingNumber?: string;
  /** Estimated delivery date */
  estimatedDelivery?: Date;
  /** Special delivery instructions */
  instructions?: string;
}

/**
 * Enhanced printing specifications interface
 */
interface PrintingDetails {
  /** Print format specification */
  format: 'softcover' | 'hardcover' | 'premium';
  /** Paper type selection */
  paperType: string;
  /** Color profile for printing */
  colorProfile: 'CMYK' | 'RGB';
  /** Print resolution in DPI */
  resolution: number;
  /** Bleed settings in mm */
  bleed: number;
  /** Cover finish type */
  coverFinish: 'matte' | 'gloss';
  /** Quality control metrics */
  qualityMetrics?: {
    colorAccuracy: number;
    bindingStrength: number;
    printAlignment: number;
  };
  /** Eco-friendly options */
  ecoOptions: {
    recycledPaper: boolean;
    sustainableInks: boolean;
    carbonNeutral: boolean;
  };
}

/**
 * Enhanced pagination state interface
 */
interface PaginationState {
  /** Current page number */
  page: number;
  /** Items per page */
  limit: number;
  /** Total number of items */
  total: number;
  /** Total number of pages */
  totalPages: number;
  /** Has more pages flag */
  hasMore: boolean;
}

/**
 * Order status type with granular tracking
 */
export type OrderStatus =
  | 'draft'
  | 'pending_payment'
  | 'payment_processing'
  | 'paid'
  | 'preparing_print'
  | 'printing'
  | 'quality_check'
  | 'packaging'
  | 'shipped'
  | 'out_for_delivery'
  | 'delivered'
  | 'cancelled'
  | 'refund_pending'
  | 'refunded';

/**
 * Order source type
 */
export type OrderSource = 'web' | 'mobile' | 'api';

/**
 * Enhanced order metadata interface
 */
export interface OrderMetadata {
  /** Order creation source */
  source: OrderSource;
  /** Order classification tags */
  tags: string[];
  /** Optional processing notes */
  notes?: string;
  /** Print partner assignment */
  printPartnerId?: string;
  /** Quality control results */
  qualityResults?: {
    score: number;
    checkedBy: string;
    checkedAt: Date;
    issues?: string[];
  };
}

/**
 * Enhanced core order interface
 */
export interface Order {
  /** UUID v4 format unique identifier */
  id: string;
  /** Reference to order owner's UUID */
  userId: string;
  /** Reference to ordered book's UUID */
  bookId: string;
  /** Optimistic concurrency control version */
  version: number;
  /** Current order status */
  status: OrderStatus;
  /** Total order amount in smallest currency unit */
  amount: number;
  /** ISO 4217 currency code */
  currency: string;
  /** Order metadata */
  metadata: OrderMetadata;
  /** Payment information */
  paymentInfo: PaymentInfo;
  /** Shipping details */
  shippingInfo: ShippingInfo;
  /** Printing specifications */
  printingDetails: PrintingDetails;
  /** Order creation timestamp */
  createdAt: Date;
  /** Order last update timestamp */
  updatedAt: Date;
}

/**
 * Enhanced Redux order state interface
 */
export interface OrderState {
  /** Currently selected order */
  currentOrder: Order | null;
  /** List of user's orders */
  userOrders: Order[];
  /** Pagination state */
  pagination: PaginationState;
  /** Loading states */
  loading: {
    create: boolean;
    fetch: boolean;
    update: boolean;
    cancel: boolean;
  };
  /** Error states */
  error: {
    create: string | null;
    fetch: string | null;
    update: string | null;
    cancel: string | null;
  };
}

/**
 * Order creation request interface
 */
export interface CreateOrderRequest {
  bookId: string;
  shippingInfo: ShippingInfo;
  printingDetails: PrintingDetails;
}

/**
 * Order update request interface
 */
export interface UpdateOrderRequest {
  orderId: string;
  status?: OrderStatus;
  shippingInfo?: Partial<ShippingInfo>;
  printingDetails?: Partial<PrintingDetails>;
  metadata?: Partial<OrderMetadata>;
}

/**
 * Order API response types
 */
export type OrderResponse = ApiResponse<Order>;
export type OrderListResponse = ApiResponse<{
  orders: Order[];
  pagination: PaginationState;
}>;