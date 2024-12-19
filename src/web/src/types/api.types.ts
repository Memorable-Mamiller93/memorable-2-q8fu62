/**
 * @fileoverview Core API type definitions for the Memorable platform frontend
 * Implements standardized request/response structures with comprehensive type safety
 * @version 1.0.0
 */

/**
 * Generic API response wrapper for successful operations
 * Provides consistent structure for all API responses with metadata
 * @template T - The type of data being returned
 */
export interface ApiResponse<T> {
  /** Indicates if the operation was successful */
  success: boolean;
  /** The actual response data */
  data: T;
  /** Optional message providing additional context */
  message: string;
  /** HTTP status code of the response */
  statusCode: number;
  /** ISO timestamp of when the response was generated */
  timestamp: string;
}

/**
 * Standardized error codes for different error categories
 * Used for consistent error handling across the platform
 */
export type ErrorCode =
  | 'VALIDATION_ERROR'  // Input validation failures
  | 'AUTH_ERROR'        // Authentication/authorization issues
  | 'NOT_FOUND'         // Resource not found
  | 'SERVER_ERROR'      // Internal server errors
  | 'BUSINESS_ERROR';   // Business logic violations

/**
 * Comprehensive error response structure
 * Provides detailed error information for debugging and user feedback
 */
export interface ApiError {
  /** Human-readable error message */
  error: string;
  /** Standardized error code */
  code: ErrorCode;
  /** Additional error context and metadata */
  details: Record<string, any>;
  /** Error stack trace (only included in development) */
  stack?: string;
  /** ISO timestamp of when the error occurred */
  timestamp: string;
  /** API endpoint path where the error occurred */
  path: string;
}

/**
 * Enhanced pagination parameters for list endpoints
 * Supports sorting, filtering, and search capabilities
 */
export interface PaginationParams {
  /** Current page number (1-based) */
  page: number;
  /** Number of items per page */
  limit: number;
  /** Field to sort by */
  sortBy?: string;
  /** Sort direction */
  sortOrder?: 'asc' | 'desc';
  /** Dynamic filters as key-value pairs */
  filters?: Record<string, string | number | boolean>;
  /** Optional search query string */
  search?: string;
}

/**
 * Enhanced paginated response structure
 * Provides comprehensive metadata for pagination UI
 * @template T - The type of items being paginated
 */
export interface PaginatedResponse<T> {
  /** Array of paginated items */
  data: T[];
  /** Total number of items across all pages */
  total: number;
  /** Current page number */
  page: number;
  /** Items per page */
  limit: number;
  /** Total number of pages */
  totalPages: number;
  /** Indicates if there is a next page */
  hasNext: boolean;
  /** Indicates if there is a previous page */
  hasPrevious: boolean;
}

/**
 * Detailed validation error structure
 * Provides comprehensive information about validation failures
 */
export interface ValidationError {
  /** Name of the field that failed validation */
  field: string;
  /** Human-readable error message */
  message: string;
  /** Validation error code */
  code: string;
  /** Full path to the invalid field (for nested objects) */
  path: string[];
  /** The invalid value that was provided */
  value: any;
  /** The validation rule that failed */
  rule: string;
  /** Error severity level */
  severity: 'error' | 'warning' | 'info';
}

/**
 * Supported HTTP methods
 * Comprehensive list including less common methods
 */
export type HttpMethod =
  | 'GET'
  | 'POST'
  | 'PUT'
  | 'DELETE'
  | 'PATCH'
  | 'OPTIONS'
  | 'HEAD';