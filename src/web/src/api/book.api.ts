/**
 * @fileoverview Book API client implementation for the Memorable platform
 * Provides comprehensive book management functionality with enhanced error handling,
 * performance monitoring, and rate limit management
 * @version 1.0.0
 */

import { enhancedApiClient as apiClient } from '../config/api.config';
import { API_ENDPOINTS } from '../constants/api.constants';
import { Book, BookMetadata, BookStatus } from '../types/book.types';
import type { ApiResponse, PaginationParams, PaginatedResponse } from '../types/api.types';

// Constants for API client configuration
const CACHE_TTL = 300000; // 5 minutes in milliseconds
const MAX_RETRIES = 3;
const RATE_LIMIT_THRESHOLD = 100;

/**
 * Performance monitoring decorator
 */
function withMetrics(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
  const originalMethod = descriptor.value;
  descriptor.value = async function (...args: any[]) {
    const startTime = performance.now();
    try {
      const result = await originalMethod.apply(this, args);
      const duration = performance.now() - startTime;
      // Log performance metrics
      if (duration > 1000) {
        console.warn(`[BookAPI] Slow operation ${propertyKey}: ${duration}ms`);
      }
      return result;
    } catch (error) {
      const duration = performance.now() - startTime;
      console.error(`[BookAPI] Operation ${propertyKey} failed after ${duration}ms`, error);
      throw error;
    }
  };
  return descriptor;
}

/**
 * Cache decorator for GET operations
 */
function withCache(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
  const cache = new Map<string, { data: any; timestamp: number }>();
  const originalMethod = descriptor.value;

  descriptor.value = async function (...args: any[]) {
    const cacheKey = `${propertyKey}-${JSON.stringify(args)}`;
    const cached = cache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.data;
    }

    const result = await originalMethod.apply(this, args);
    cache.set(cacheKey, { data: result, timestamp: Date.now() });
    return result;
  };
  return descriptor;
}

/**
 * Book API namespace containing all book-related operations
 */
export namespace BookAPI {
  /**
   * Creates a new personalized book
   * @param metadata Book metadata including theme and character information
   * @param signal Optional AbortSignal for request cancellation
   * @returns Promise resolving to the created book
   */
  @withMetrics
  export async function createBook(
    metadata: BookMetadata,
    signal?: AbortSignal
  ): Promise<Book> {
    const response = await apiClient.post<Book>(
      API_ENDPOINTS.BOOK.CREATE,
      metadata,
      { signal }
    );
    return response.data;
  }

  /**
   * Retrieves a specific book by ID
   * @param bookId Unique identifier of the book
   * @returns Promise resolving to the book data
   */
  @withCache
  @withMetrics
  export async function getBook(bookId: string): Promise<Book> {
    const endpoint = API_ENDPOINTS.BOOK.GET.replace('{id}', bookId);
    const response = await apiClient.get<Book>(endpoint);
    return response.data;
  }

  /**
   * Updates an existing book
   * @param bookId Unique identifier of the book
   * @param updates Partial book data to update
   * @returns Promise resolving to the updated book
   */
  @withMetrics
  export async function updateBook(
    bookId: string,
    updates: Partial<Book>
  ): Promise<Book> {
    const endpoint = API_ENDPOINTS.BOOK.UPDATE.replace('{id}', bookId);
    const response = await apiClient.put<Book>(endpoint, updates);
    return response.data;
  }

  /**
   * Deletes a book
   * @param bookId Unique identifier of the book
   * @returns Promise resolving to void on successful deletion
   */
  @withMetrics
  export async function deleteBook(bookId: string): Promise<void> {
    const endpoint = API_ENDPOINTS.BOOK.DELETE.replace('{id}', bookId);
    await apiClient.delete(endpoint);
  }

  /**
   * Retrieves a paginated list of user's books with filtering
   * @param params Pagination and filtering parameters
   * @returns Promise resolving to paginated book list
   */
  @withCache
  @withMetrics
  export async function getUserBooks(
    params: PaginationParams
  ): Promise<PaginatedResponse<Book>> {
    const response = await apiClient.get<PaginatedResponse<Book>>(
      API_ENDPOINTS.BOOK.LIST,
      { params }
    );
    return response.data;
  }

  /**
   * Saves a book draft
   * @param bookId Unique identifier of the book
   * @param draftData Draft data to save
   * @returns Promise resolving to the saved draft
   */
  @withMetrics
  export async function saveDraft(
    bookId: string,
    draftData: Partial<Book>
  ): Promise<Book> {
    const endpoint = API_ENDPOINTS.BOOK.SAVE_DRAFT.replace('{id}', bookId);
    const response = await apiClient.post<Book>(endpoint, draftData);
    return response.data;
  }

  /**
   * Retrieves a book preview
   * @param bookId Unique identifier of the book
   * @returns Promise resolving to the book preview data
   */
  @withCache
  @withMetrics
  export async function getPreview(bookId: string): Promise<Book> {
    const endpoint = API_ENDPOINTS.BOOK.GET_PREVIEW.replace('{id}', bookId);
    const response = await apiClient.get<Book>(endpoint);
    return response.data;
  }

  /**
   * Adds a new page to a book
   * @param bookId Unique identifier of the book
   * @param pageData Page content and metadata
   * @returns Promise resolving to the updated book
   */
  @withMetrics
  export async function addPage(
    bookId: string,
    pageData: any
  ): Promise<Book> {
    const endpoint = API_ENDPOINTS.BOOK.ADD_PAGE.replace('{id}', bookId);
    const response = await apiClient.post<Book>(endpoint, pageData);
    return response.data;
  }

  /**
   * Updates an existing page in a book
   * @param bookId Unique identifier of the book
   * @param pageId Unique identifier of the page
   * @param pageData Updated page content
   * @returns Promise resolving to the updated book
   */
  @withMetrics
  export async function updatePage(
    bookId: string,
    pageId: string,
    pageData: any
  ): Promise<Book> {
    const endpoint = API_ENDPOINTS.BOOK.UPDATE_PAGE
      .replace('{id}', bookId)
      .replace('{pageId}', pageId);
    const response = await apiClient.put<Book>(endpoint, pageData);
    return response.data;
  }
}

export default BookAPI;