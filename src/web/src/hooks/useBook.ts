/**
 * @fileoverview Custom React hook for managing book-related operations and state
 * Provides a unified interface for book creation, updates, and state management
 * with enhanced error handling, optimistic updates, and performance optimizations
 * @version 1.0.0
 */

import { useState, useCallback, useEffect, useRef } from 'react'; // v18.2.0
import { useSelector, useDispatch } from 'react-redux'; // v8.1.0
import { v4 as uuidv4 } from 'uuid'; // v9.0.0

import { Book, BookMetadata, BookStatus } from '../types/book.types';
import { bookApi } from '../api/book.api';
import { ApiError } from '../types/api.types';

// Types for hook state management
interface BookState {
  books: Book[];
  currentBook: Book | null;
  loading: {
    create: boolean;
    update: boolean;
    fetch: boolean;
  };
  error: {
    create: ApiError | null;
    update: ApiError | null;
    fetch: ApiError | null;
  };
  progress: {
    create: number;
    update: number;
  };
}

// Initial state
const initialState: BookState = {
  books: [],
  currentBook: null,
  loading: {
    create: false,
    update: false,
    fetch: false
  },
  error: {
    create: null,
    update: null,
    fetch: null
  },
  progress: {
    create: 0,
    update: 0
  }
};

/**
 * Custom hook for managing book operations with enhanced features
 * Includes optimistic updates, error handling, and progress tracking
 */
export const useBook = () => {
  // Local state management
  const [state, setState] = useState<BookState>(initialState);
  
  // Redux integration
  const dispatch = useDispatch();
  
  // Refs for request cancellation
  const createAbortController = useRef<AbortController | null>(null);
  const updateAbortController = useRef<AbortController | null>(null);
  const fetchAbortController = useRef<AbortController | null>(null);

  /**
   * Cleanup function for aborting ongoing requests
   */
  useEffect(() => {
    return () => {
      createAbortController.current?.abort();
      updateAbortController.current?.abort();
      fetchAbortController.current?.abort();
    };
  }, []);

  /**
   * Creates a new book with optimistic updates
   * @param metadata Book metadata for creation
   */
  const createBook = useCallback(async (metadata: BookMetadata) => {
    try {
      // Abort any existing create request
      createAbortController.current?.abort();
      createAbortController.current = new AbortController();

      // Set loading state
      setState(prev => ({
        ...prev,
        loading: { ...prev.loading, create: true },
        error: { ...prev.error, create: null }
      }));

      // Generate optimistic ID
      const optimisticId = uuidv4();

      // Create optimistic book entry
      const optimisticBook: Book = {
        id: optimisticId as any,
        metadata,
        status: { status: 'draft', progress: 0 },
        createdAt: new Date(),
        updatedAt: new Date(),
        version: 1,
        pages: []
      } as Book;

      // Update local state optimistically
      setState(prev => ({
        ...prev,
        books: [optimisticBook, ...prev.books],
        currentBook: optimisticBook
      }));

      // Make API request
      const createdBook = await bookApi.createBook(
        metadata,
        createAbortController.current.signal
      );

      // Update state with actual book data
      setState(prev => ({
        ...prev,
        books: prev.books.map(book => 
          book.id === optimisticId ? createdBook : book
        ),
        currentBook: createdBook,
        loading: { ...prev.loading, create: false },
        progress: { ...prev.progress, create: 100 }
      }));

      return createdBook;
    } catch (error) {
      // Handle error state
      setState(prev => ({
        ...prev,
        loading: { ...prev.loading, create: false },
        error: { ...prev.error, create: error as ApiError }
      }));
      throw error;
    }
  }, []);

  /**
   * Updates an existing book with optimistic updates
   * @param bookId Book identifier
   * @param updates Partial book updates
   */
  const updateBook = useCallback(async (bookId: string, updates: Partial<Book>) => {
    try {
      // Abort any existing update request
      updateAbortController.current?.abort();
      updateAbortController.current = new AbortController();

      // Set loading state
      setState(prev => ({
        ...prev,
        loading: { ...prev.loading, update: true },
        error: { ...prev.error, update: null }
      }));

      // Apply optimistic update
      setState(prev => ({
        ...prev,
        books: prev.books.map(book =>
          book.id === bookId ? { ...book, ...updates } : book
        ),
        currentBook: prev.currentBook?.id === bookId
          ? { ...prev.currentBook, ...updates }
          : prev.currentBook
      }));

      // Make API request
      const updatedBook = await bookApi.updateBook(bookId, updates);

      // Update state with actual data
      setState(prev => ({
        ...prev,
        books: prev.books.map(book =>
          book.id === bookId ? updatedBook : book
        ),
        currentBook: prev.currentBook?.id === bookId
          ? updatedBook
          : prev.currentBook,
        loading: { ...prev.loading, update: false },
        progress: { ...prev.progress, update: 100 }
      }));

      return updatedBook;
    } catch (error) {
      // Handle error state
      setState(prev => ({
        ...prev,
        loading: { ...prev.loading, update: false },
        error: { ...prev.error, update: error as ApiError }
      }));
      throw error;
    }
  }, []);

  /**
   * Fetches user's books with pagination
   * @param page Page number
   * @param limit Items per page
   */
  const fetchUserBooks = useCallback(async (page = 1, limit = 10) => {
    try {
      // Abort any existing fetch request
      fetchAbortController.current?.abort();
      fetchAbortController.current = new AbortController();

      // Set loading state
      setState(prev => ({
        ...prev,
        loading: { ...prev.loading, fetch: true },
        error: { ...prev.error, fetch: null }
      }));

      // Make API request
      const response = await bookApi.getUserBooks({ page, limit });

      // Update state with fetched data
      setState(prev => ({
        ...prev,
        books: response.data,
        loading: { ...prev.loading, fetch: false }
      }));

      return response.data;
    } catch (error) {
      // Handle error state
      setState(prev => ({
        ...prev,
        loading: { ...prev.loading, fetch: false },
        error: { ...prev.error, fetch: error as ApiError }
      }));
      throw error;
    }
  }, []);

  /**
   * Cancels ongoing book operations
   */
  const cancelOperation = useCallback((operation: 'create' | 'update' | 'fetch') => {
    switch (operation) {
      case 'create':
        createAbortController.current?.abort();
        break;
      case 'update':
        updateAbortController.current?.abort();
        break;
      case 'fetch':
        fetchAbortController.current?.abort();
        break;
    }
  }, []);

  return {
    // State
    books: state.books,
    currentBook: state.currentBook,
    loading: state.loading,
    error: state.error,
    progress: state.progress,

    // Operations
    createBook,
    updateBook,
    fetchUserBooks,
    cancelOperation
  };
};

export default useBook;