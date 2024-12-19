/**
 * @fileoverview API utilities for the Memorable platform frontend
 * Provides enhanced axios client with retry logic, request queuing, and error handling
 * @version 1.0.0
 */

import axios, { AxiosInstance, AxiosError, AxiosRequestConfig, AxiosResponse } from 'axios'; // v1.4.0
import {
  ApiResponse,
  ApiError,
  ValidationError,
} from '../types/api.types';
import {
  API_ENDPOINTS,
  HTTP_STATUS,
  API_HEADERS,
  API_ERROR_CODES,
} from '../constants/api.constants';

// Environment configuration
const API_BASE_URL = process.env.VITE_API_BASE_URL || 'http://localhost:3000';
const API_TIMEOUT = 30000;
const MAX_RETRY_ATTEMPTS = 3;
const MAX_CONCURRENT_REQUESTS = 10;

/**
 * Request queue implementation for managing concurrent requests
 */
class RequestQueue {
  private queue: Array<{ request: AxiosRequestConfig; priority: number; resolve: Function; reject: Function }> = [];
  private activeRequests = 0;

  /**
   * Adds a request to the priority queue
   * @param request - Axios request configuration
   * @param priority - Request priority (1-5, 1 being highest)
   */
  public async enqueue(request: AxiosRequestConfig, priority: number = 3): Promise<AxiosResponse> {
    return new Promise((resolve, reject) => {
      this.queue.push({ request, priority, resolve, reject });
      this.queue.sort((a, b) => a.priority - b.priority);
      this.processQueue();
    });
  }

  /**
   * Processes queued requests respecting concurrency limits
   */
  private async processQueue(): Promise<void> {
    if (this.activeRequests >= MAX_CONCURRENT_REQUESTS || this.queue.length === 0) {
      return;
    }

    const { request, resolve, reject } = this.queue.shift()!;
    this.activeRequests++;

    try {
      const response = await axios(request);
      resolve(response);
    } catch (error) {
      reject(error);
    } finally {
      this.activeRequests--;
      this.processQueue();
    }
  }
}

const requestQueue = new RequestQueue();

/**
 * Calculates exponential backoff delay for retries
 * @param attempt - Current retry attempt number
 */
const calculateBackoff = (attempt: number): number => {
  return Math.min(1000 * Math.pow(2, attempt), 10000);
};

/**
 * Enhanced error handling with detailed mapping and retry suggestions
 * @param error - Axios error object
 */
export const handleApiError = (error: AxiosError): ApiError => {
  const timestamp = new Date().toISOString();
  const path = error.config?.url || 'unknown';
  
  // Default error structure
  const apiError: ApiError = {
    error: 'An unexpected error occurred',
    code: API_ERROR_CODES.SERVER_ERROR,
    details: {},
    timestamp,
    path
  };

  if (error.response) {
    const { status, data } = error.response;

    switch (status) {
      case HTTP_STATUS.BAD_REQUEST:
        apiError.code = API_ERROR_CODES.VALIDATION_ERROR;
        apiError.error = 'Invalid request parameters';
        apiError.details = (data as any).validationErrors || {};
        break;
      case HTTP_STATUS.UNAUTHORIZED:
        apiError.code = API_ERROR_CODES.AUTHENTICATION_ERROR;
        apiError.error = 'Authentication required';
        break;
      case HTTP_STATUS.TOO_MANY_REQUESTS:
        apiError.code = API_ERROR_CODES.RATE_LIMIT_EXCEEDED;
        apiError.error = 'Rate limit exceeded';
        apiError.details = {
          resetTime: error.response.headers[API_HEADERS.RATE_LIMIT_RESET],
          retryAfter: error.response.headers['Retry-After']
        };
        break;
      default:
        apiError.error = (data as any)?.message || error.message;
        apiError.details = (data as any)?.details || {};
    }
  }

  // Log error for monitoring
  console.error('[API Error]', {
    ...apiError,
    requestId: error.config?.headers?.[API_HEADERS.REQUEST_ID],
    method: error.config?.method?.toUpperCase(),
  });

  return apiError;
};

/**
 * Implements request retry logic with exponential backoff
 * @param error - Axios error that triggered the retry
 * @param attempt - Current retry attempt number
 */
export const retryRequest = async (
  error: AxiosError,
  attempt: number
): Promise<AxiosResponse> => {
  if (attempt >= MAX_RETRY_ATTEMPTS || !error.config) {
    throw error;
  }

  // Don't retry certain status codes
  if (error.response?.status && [HTTP_STATUS.BAD_REQUEST, HTTP_STATUS.UNAUTHORIZED, HTTP_STATUS.FORBIDDEN].includes(error.response.status)) {
    throw error;
  }

  const delay = calculateBackoff(attempt);
  await new Promise(resolve => setTimeout(resolve, delay));

  const retryConfig = { ...error.config, retryAttempt: attempt + 1 };
  return axios(retryConfig);
};

/**
 * Creates and configures an axios instance with enhanced features
 * @param config - Additional axios configuration options
 */
export const createApiClient = (config: AxiosRequestConfig = {}): AxiosInstance => {
  const client = axios.create({
    baseURL: API_BASE_URL,
    timeout: API_TIMEOUT,
    headers: {
      [API_HEADERS.CONTENT_TYPE]: 'application/json',
      [API_HEADERS.ACCEPT]: 'application/json',
      [API_HEADERS.API_VERSION]: '1.0'
    },
    ...config
  });

  // Request interceptor for authentication and request ID
  client.interceptors.request.use(config => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers[API_HEADERS.AUTHORIZATION] = `Bearer ${token}`;
    }
    config.headers[API_HEADERS.REQUEST_ID] = crypto.randomUUID();
    return config;
  });

  // Response interceptor for unwrapping data and handling errors
  client.interceptors.response.use(
    (response): ApiResponse<any> => {
      return {
        success: true,
        data: response.data,
        message: response.data.message || '',
        statusCode: response.status,
        timestamp: new Date().toISOString()
      };
    },
    async (error: AxiosError) => {
      // Handle token refresh if needed
      if (error.response?.status === HTTP_STATUS.UNAUTHORIZED && error.config?.url !== API_ENDPOINTS.AUTH.REFRESH) {
        try {
          const refreshToken = localStorage.getItem('refresh_token');
          if (refreshToken) {
            const { data } = await client.post(API_ENDPOINTS.AUTH.REFRESH, { refreshToken });
            localStorage.setItem('auth_token', data.accessToken);
            return client(error.config!);
          }
        } catch (refreshError) {
          // Token refresh failed, clear auth and throw original error
          localStorage.removeItem('auth_token');
          localStorage.removeItem('refresh_token');
        }
      }

      // Implement retry logic for certain errors
      if (error.config?.retryAttempt === undefined) {
        try {
          return await retryRequest(error, 0);
        } catch (retryError) {
          throw handleApiError(retryError as AxiosError);
        }
      }

      throw handleApiError(error);
    }
  );

  return client;
};

// Export a default configured API client instance
export const apiClient = createApiClient();

/**
 * Type definitions for enhanced request options
 */
export interface EnhancedRequestConfig extends AxiosRequestConfig {
  priority?: number;
  skipQueue?: boolean;
  skipRetry?: boolean;
}

/**
 * Enhanced request method with queue support
 * @param config - Enhanced request configuration
 */
export const request = async <T>(config: EnhancedRequestConfig): Promise<ApiResponse<T>> => {
  if (config.skipQueue) {
    return apiClient(config) as Promise<ApiResponse<T>>;
  }
  return requestQueue.enqueue(config, config.priority) as Promise<ApiResponse<T>>;
};