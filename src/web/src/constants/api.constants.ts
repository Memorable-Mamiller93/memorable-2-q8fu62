/**
 * API Constants
 * @description Defines constant values for API endpoints, status codes, headers, and error codes
 * @version 1.0.0
 */

/**
 * API endpoint paths organized by service domain
 * All paths are prefixed with /api/v1/
 */
export const API_ENDPOINTS = {
  AUTH: {
    LOGIN: '/api/v1/auth/login',
    REGISTER: '/api/v1/auth/register',
    LOGOUT: '/api/v1/auth/logout',
    REFRESH: '/api/v1/auth/refresh',
    VERIFY_EMAIL: '/api/v1/auth/verify-email',
    RESET_PASSWORD: '/api/v1/auth/reset-password',
    CHANGE_PASSWORD: '/api/v1/auth/change-password'
  },
  BOOK: {
    CREATE: '/api/v1/books',
    GET: '/api/v1/books/{id}',
    UPDATE: '/api/v1/books/{id}',
    DELETE: '/api/v1/books/{id}',
    LIST: '/api/v1/books',
    SAVE_DRAFT: '/api/v1/books/{id}/draft',
    GET_PREVIEW: '/api/v1/books/{id}/preview',
    ADD_PAGE: '/api/v1/books/{id}/pages',
    UPDATE_PAGE: '/api/v1/books/{id}/pages/{pageId}'
  },
  AI: {
    GENERATE_STORY: '/api/v1/generate/story',
    GENERATE_ILLUSTRATION: '/api/v1/generate/illustration',
    ENHANCE_PHOTO: '/api/v1/generate/enhance-photo',
    VALIDATE_CONTENT: '/api/v1/generate/validate-content'
  },
  ORDER: {
    CREATE: '/api/v1/orders',
    GET: '/api/v1/orders/{id}',
    LIST: '/api/v1/orders',
    CANCEL: '/api/v1/orders/{id}/cancel',
    UPDATE_SHIPPING: '/api/v1/orders/{id}/shipping'
  },
  PRINT: {
    SUBMIT: '/api/v1/print/submit',
    STATUS: '/api/v1/print/{id}/status',
    GET_PROVIDERS: '/api/v1/print/providers',
    GET_PRICING: '/api/v1/print/pricing'
  }
} as const;

/**
 * Standard HTTP status codes used across the application
 */
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  ACCEPTED: 202,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503
} as const;

/**
 * Application-specific error codes for detailed error handling
 */
export const API_ERROR_CODES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  AUTHENTICATION_ERROR: 'AUTHENTICATION_ERROR',
  AUTHORIZATION_ERROR: 'AUTHORIZATION_ERROR',
  RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',
  SERVER_ERROR: 'SERVER_ERROR',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  CONTENT_GENERATION_ERROR: 'CONTENT_GENERATION_ERROR',
  PRINT_SERVICE_ERROR: 'PRINT_SERVICE_ERROR',
  INVALID_FILE_FORMAT: 'INVALID_FILE_FORMAT',
  PAYMENT_ERROR: 'PAYMENT_ERROR'
} as const;

/**
 * Common HTTP headers used in API requests and responses
 */
export const API_HEADERS = {
  CONTENT_TYPE: 'Content-Type',
  AUTHORIZATION: 'Authorization',
  ACCEPT: 'Accept',
  RATE_LIMIT_REMAINING: 'X-RateLimit-Remaining',
  RATE_LIMIT_RESET: 'X-RateLimit-Reset',
  API_VERSION: 'X-API-Version',
  REQUEST_ID: 'X-Request-ID'
} as const;

/**
 * TypeScript type definitions for API constants
 */
export type ApiEndpoints = typeof API_ENDPOINTS;
export type HttpStatus = typeof HTTP_STATUS;
export type ApiErrorCodes = typeof API_ERROR_CODES;
export type ApiHeaders = typeof API_HEADERS;

/**
 * Type guard to check if a value is a valid API error code
 */
export const isApiErrorCode = (code: string): code is keyof typeof API_ERROR_CODES => {
  return Object.values(API_ERROR_CODES).includes(code as any);
};

/**
 * Type guard to check if a value is a valid HTTP status code
 */
export const isHttpStatus = (status: number): status is typeof HTTP_STATUS[keyof typeof HTTP_STATUS] => {
  return Object.values(HTTP_STATUS).includes(status);
};