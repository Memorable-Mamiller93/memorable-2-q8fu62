/**
 * @fileoverview API client configuration for the Memorable platform frontend
 * Implements comprehensive request handling, error management, and resilience patterns
 * @version 1.0.0
 */

import axios, { AxiosInstance, AxiosError, AxiosRequestConfig } from 'axios'; // v1.4.0
import CircuitBreaker from 'opossum'; // v6.0.0
import axiosRetry from 'axios-retry'; // v3.8.0
import { v4 as uuidv4 } from 'uuid'; // v9.0.0

import { ApiResponse, ApiError } from '../types/api.types';
import { API_ENDPOINTS, HTTP_STATUS, API_HEADERS } from '../constants/api.constants';

// Environment configuration
const API_BASE_URL = process.env.VITE_API_BASE_URL || 'http://localhost:3000';
const API_TIMEOUT = 30000; // 30 seconds
const RETRY_ATTEMPTS = 3;
const CIRCUIT_BREAKER_THRESHOLD = 5;
const RATE_LIMIT_PER_MINUTE = 100;

/**
 * Base API client configuration
 */
export const apiConfig: AxiosRequestConfig = {
  baseURL: API_BASE_URL,
  timeout: API_TIMEOUT,
  headers: {
    [API_HEADERS.CONTENT_TYPE]: 'application/json',
    [API_HEADERS.ACCEPT]: 'application/json',
    [API_HEADERS.API_VERSION]: '1.0'
  },
  validateStatus: (status) => status >= 200 && status < 500
};

/**
 * Retry configuration for failed requests
 */
const retryConfig = {
  retries: RETRY_ATTEMPTS,
  retryDelay: axiosRetry.exponentialDelay,
  retryCondition: (error: AxiosError) => {
    return axiosRetry.isNetworkOrIdempotentRequestError(error) ||
           error.response?.status === HTTP_STATUS.TOO_MANY_REQUESTS;
  }
};

/**
 * Circuit breaker configuration for API resilience
 */
const circuitBreakerConfig = {
  timeout: 3000, // 3 seconds
  errorThresholdPercentage: 50,
  resetTimeout: 30000, // 30 seconds
  volumeThreshold: CIRCUIT_BREAKER_THRESHOLD
};

/**
 * Sets up request and response interceptors for the API client
 * @param axiosInstance - The Axios instance to configure
 */
const setupInterceptors = (axiosInstance: AxiosInstance): void => {
  // Request interceptors
  axiosInstance.interceptors.request.use(
    (config) => {
      // Add correlation ID for request tracing
      const correlationId = uuidv4();
      config.headers[API_HEADERS.REQUEST_ID] = correlationId;

      // Add authentication token if available
      const token = localStorage.getItem('auth_token');
      if (token) {
        config.headers[API_HEADERS.AUTHORIZATION] = `Bearer ${token}`;
      }

      // Add request timestamp for performance monitoring
      config.metadata = { startTime: Date.now() };

      return config;
    },
    (error) => Promise.reject(error)
  );

  // Response interceptors
  axiosInstance.interceptors.response.use(
    (response) => {
      // Calculate request duration
      const duration = Date.now() - (response.config.metadata?.startTime || 0);
      
      // Track rate limit headers
      const remainingRequests = response.headers[API_HEADERS.RATE_LIMIT_REMAINING];
      const rateLimitReset = response.headers[API_HEADERS.RATE_LIMIT_RESET];

      // Log performance metrics
      if (duration > 1000) {
        console.warn(`Slow API call to ${response.config.url}: ${duration}ms`);
      }

      // Unwrap the response data
      return response.data as ApiResponse<any>;
    },
    (error: AxiosError) => {
      return Promise.reject(handleApiError(error));
    }
  );
};

/**
 * Enhanced error handling with detailed error mapping
 * @param error - The Axios error object
 * @returns Standardized API error object
 */
const handleApiError = (error: AxiosError): ApiError => {
  const errorResponse: ApiError = {
    error: 'An unexpected error occurred',
    code: 'SERVER_ERROR',
    details: {},
    correlationId: error.config?.headers?.[API_HEADERS.REQUEST_ID] as string,
    timestamp: new Date().toISOString(),
    path: error.config?.url || ''
  };

  if (error.response) {
    const { status, data } = error.response;

    switch (status) {
      case HTTP_STATUS.BAD_REQUEST:
        errorResponse.code = 'VALIDATION_ERROR';
        errorResponse.error = 'Invalid request parameters';
        break;
      case HTTP_STATUS.UNAUTHORIZED:
        errorResponse.code = 'AUTH_ERROR';
        errorResponse.error = 'Authentication required';
        // Trigger token refresh or logout if needed
        break;
      case HTTP_STATUS.TOO_MANY_REQUESTS:
        errorResponse.code = 'RATE_LIMIT_ERROR';
        errorResponse.error = 'Rate limit exceeded';
        break;
      default:
        errorResponse.code = 'SERVER_ERROR';
        errorResponse.error = 'Server error occurred';
    }

    errorResponse.details = data;
  } else if (error.request) {
    errorResponse.code = 'NETWORK_ERROR';
    errorResponse.error = 'Network error occurred';
  }

  // Log error for monitoring
  console.error('[API Error]', {
    ...errorResponse,
    stack: error.stack
  });

  return errorResponse;
};

/**
 * Configure circuit breaker for API resilience
 * @param options - Circuit breaker configuration options
 */
const setupCircuitBreaker = (options = circuitBreakerConfig) => {
  return new CircuitBreaker(async (config: AxiosRequestConfig) => {
    const response = await apiClient(config);
    return response;
  }, options);
};

// Create and configure the API client instance
export const apiClient = axios.create(apiConfig);

// Apply retry configuration
axiosRetry(apiClient, retryConfig);

// Setup interceptors
setupInterceptors(apiClient);

// Create circuit breaker instance
const breaker = setupCircuitBreaker();

/**
 * Enhanced API client with circuit breaker protection
 */
export const enhancedApiClient = {
  async get<T>(url: string, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    return breaker.fire({ ...config, method: 'GET', url });
  },
  async post<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    return breaker.fire({ ...config, method: 'POST', url, data });
  },
  async put<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    return breaker.fire({ ...config, method: 'PUT', url, data });
  },
  async delete<T>(url: string, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    return breaker.fire({ ...config, method: 'DELETE', url });
  }
};

export default enhancedApiClient;