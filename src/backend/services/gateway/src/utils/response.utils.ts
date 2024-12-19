import { StatusCodes } from 'http-status-codes'; // v2.2.0
import { Response } from 'express'; // v4.18.2
import { v4 as uuidv4 } from 'uuid'; // v9.0.0

// API Response Interfaces
export interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  error: ErrorDetail | null;
  metadata: ResponseMetadata;
}

export interface ErrorDetail {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance: string;
  timestamp: string;
  traceId: string;
  errors?: ValidationError[];
  code: string;
  retryable: boolean;
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
  constraint: string;
  value: unknown;
}

export interface ResponseMetadata {
  version: string;
  timestamp: string;
  processingTime: number;
  region: string;
}

// Options Interfaces
export interface ErrorResponseOptions {
  retryable?: boolean;
  code?: string;
  errors?: ValidationError[];
  logLevel?: 'error' | 'warn' | 'info';
}

export interface ResponseOptions {
  cache?: boolean;
  maxAge?: number;
  compress?: boolean;
  private?: boolean;
}

// Constants
const API_VERSION = '1.0.0';
const DEFAULT_REGION = process.env.AWS_REGION || 'us-east-1';
const SAFE_ERROR_MESSAGE = 'An unexpected error occurred';

/**
 * Creates a standardized success response with metadata
 * @param data Response payload
 * @param status HTTP status code
 * @param metadata Additional metadata
 * @returns Formatted success response
 */
export function createSuccessResponse<T>(
  data: T,
  status: number = StatusCodes.OK,
  metadata: Partial<ResponseMetadata> = {}
): ApiResponse<T> {
  const startTime = process.hrtime();
  
  const responseMetadata: ResponseMetadata = {
    version: API_VERSION,
    timestamp: new Date().toISOString(),
    processingTime: 0,
    region: DEFAULT_REGION,
    ...metadata
  };

  const [seconds, nanoseconds] = process.hrtime(startTime);
  responseMetadata.processingTime = seconds * 1000 + nanoseconds / 1000000;

  return {
    success: true,
    data,
    error: null,
    metadata: responseMetadata
  };
}

/**
 * Creates a secure RFC 7807 compliant error response with tracing
 * @param error Error object
 * @param status HTTP status code
 * @param type Error type URI
 * @param instance Request path
 * @param options Additional error options
 * @returns Formatted error response
 */
export function createErrorResponse(
  error: Error,
  status: number = StatusCodes.INTERNAL_SERVER_ERROR,
  type: string = 'https://api.memorable.com/errors/internal-error',
  instance: string = '/unknown',
  options: ErrorResponseOptions = {}
): ApiResponse<null> {
  const traceId = uuidv4();
  const timestamp = new Date().toISOString();

  // Sanitize error message for security
  const detail = process.env.NODE_ENV === 'production' 
    ? SAFE_ERROR_MESSAGE 
    : error.message;

  const errorDetail: ErrorDetail = {
    type,
    title: error.name,
    status,
    detail,
    instance,
    timestamp,
    traceId,
    code: options.code || 'INTERNAL_ERROR',
    retryable: options.retryable ?? false,
    ...(options.errors && { errors: options.errors })
  };

  // Log error with trace ID for debugging
  console[options.logLevel || 'error']({
    error: {
      message: error.message,
      stack: error.stack,
      name: error.name
    },
    traceId,
    timestamp,
    status,
    instance
  });

  return {
    success: false,
    data: null,
    error: errorDetail,
    metadata: {
      version: API_VERSION,
      timestamp,
      processingTime: 0,
      region: DEFAULT_REGION
    }
  };
}

/**
 * Maps service errors to appropriate HTTP status codes and error details
 * @param error Error object
 * @param context Error context
 * @returns Error mapping with status and details
 */
export function mapServiceError(
  error: Error,
  context: { path: string; service: string }
): { status: number; type: string; options: ErrorResponseOptions } {
  // Define error mapping patterns
  const errorPatterns = {
    ValidationError: {
      status: StatusCodes.BAD_REQUEST,
      type: 'https://api.memorable.com/errors/validation'
    },
    AuthenticationError: {
      status: StatusCodes.UNAUTHORIZED,
      type: 'https://api.memorable.com/errors/authentication'
    },
    AuthorizationError: {
      status: StatusCodes.FORBIDDEN,
      type: 'https://api.memorable.com/errors/authorization'
    },
    NotFoundError: {
      status: StatusCodes.NOT_FOUND,
      type: 'https://api.memorable.com/errors/not-found'
    },
    RateLimitError: {
      status: StatusCodes.TOO_MANY_REQUESTS,
      type: 'https://api.memorable.com/errors/rate-limit',
      retryable: true
    }
  };

  // Match error type and get mapping
  const mapping = errorPatterns[error.constructor.name] || {
    status: StatusCodes.INTERNAL_SERVER_ERROR,
    type: 'https://api.memorable.com/errors/internal-error'
  };

  return {
    status: mapping.status,
    type: mapping.type,
    options: {
      code: error.constructor.name,
      retryable: mapping.retryable || false,
      logLevel: mapping.status >= 500 ? 'error' : 'warn'
    }
  };
}

/**
 * Sends formatted response with appropriate headers and logging
 * @param res Express response object
 * @param response Formatted API response
 * @param status HTTP status code
 * @param options Response options
 */
export function sendResponse<T>(
  res: Response,
  response: ApiResponse<T>,
  status: number = StatusCodes.OK,
  options: ResponseOptions = {}
): void {
  // Set security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');

  // Set caching headers
  if (options.cache) {
    res.setHeader('Cache-Control', `${options.private ? 'private' : 'public'}, max-age=${options.maxAge || 3600}`);
  } else {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  }

  // Set content type
  res.setHeader('Content-Type', 'application/problem+json');

  // Enable compression if requested
  if (options.compress) {
    res.setHeader('Content-Encoding', 'gzip');
  }

  // Log response metrics
  console.info({
    path: res.req?.path,
    method: res.req?.method,
    status,
    processingTime: response.metadata.processingTime,
    timestamp: response.metadata.timestamp
  });

  // Send response
  res.status(status).json(response);
}