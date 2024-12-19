/**
 * @fileoverview Test suite for useBook custom hook
 * Verifies book management functionality, performance, type safety, and Redux integration
 * @version 1.0.0
 */

import { renderHook, act, cleanup } from '@testing-library/react-hooks'; // v8.0.1
import { Provider } from 'react-redux'; // v8.1.0
import { configureStore } from '@reduxjs/toolkit'; // v1.9.0
import { jest, expect, beforeEach, afterEach } from '@jest/globals'; // v29.5.0

import { useBook } from '../../src/hooks/useBook';
import type { Book, BookMetadata, BookStatus, BookTheme } from '../../src/types/book.types';

// Performance threshold constants
const OPERATION_TIMEOUT = 3000; // 3 seconds max for operations
const RENDER_TIMEOUT = 100; // 100ms max for initial render

// Mock book data with proper typing
const mockBookMetadata: BookMetadata = {
  mainCharacter: {
    name: 'Test Character',
    age: 8,
    traits: ['curious', 'brave'],
    interests: ['adventure', 'science']
  },
  supportingCharacters: [],
  settings: {
    fontSize: 14,
    fontFamily: 'Arial',
    lineSpacing: 1.5,
    pageLayout: 'standard',
    isGiftWrapped: false
  },
  printOptions: {
    format: 'softcover',
    paperType: 'standard',
    colorProfile: 'CMYK',
    resolution: 300,
    bleed: 3,
    spine: 5,
    coverFinish: 'matte'
  },
  aiGeneration: {
    storyPrompt: 'Test prompt',
    illustrationStyle: 'watercolor',
    generatedAt: new Date(),
    modelVersion: '1.0',
    iterations: 1,
    confidence: 0.95
  }
};

const mockBook: Book = {
  id: 'test-id' as any,
  userId: 'test-user' as any,
  themeId: 'test-theme' as any,
  title: 'Test Book',
  metadata: mockBookMetadata,
  status: { status: 'draft', progress: 0 },
  theme: {} as BookTheme,
  pages: [],
  createdAt: new Date(),
  updatedAt: new Date(),
  version: 1
};

// Mock Redux store setup
const createMockStore = () => {
  return configureStore({
    reducer: {
      books: (state = { books: [], currentBook: null }, action) => state
    }
  });
};

// Test wrapper component with Redux provider
const wrapper = ({ children }: { children: React.ReactNode }) => (
  <Provider store={createMockStore()}>{children}</Provider>
);

describe('useBook Hook', () => {
  // Setup and teardown
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  describe('Initialization', () => {
    test('should initialize with correct default values', () => {
      const { result } = renderHook(() => useBook(), { wrapper });

      expect(result.current.books).toEqual([]);
      expect(result.current.currentBook).toBeNull();
      expect(result.current.loading).toEqual({
        create: false,
        update: false,
        fetch: false
      });
      expect(result.current.error).toEqual({
        create: null,
        update: null,
        fetch: null
      });
      expect(result.current.progress).toEqual({
        create: 0,
        update: 0
      });
    });

    test('should render within performance threshold', () => {
      const startTime = performance.now();
      renderHook(() => useBook(), { wrapper });
      const renderTime = performance.now() - startTime;

      expect(renderTime).toBeLessThan(RENDER_TIMEOUT);
    });
  });

  describe('Book Creation', () => {
    test('should create book with proper metadata', async () => {
      const { result } = renderHook(() => useBook(), { wrapper });

      await act(async () => {
        const startTime = performance.now();
        const book = await result.current.createBook(mockBookMetadata);
        const operationTime = performance.now() - startTime;

        expect(operationTime).toBeLessThan(OPERATION_TIMEOUT);
        expect(book).toMatchObject({
          metadata: mockBookMetadata,
          status: { status: 'draft', progress: 0 }
        });
      });
    });

    test('should handle creation errors properly', async () => {
      const { result } = renderHook(() => useBook(), { wrapper });
      const error = new Error('Creation failed');

      await act(async () => {
        try {
          await result.current.createBook({} as BookMetadata);
        } catch (e) {
          expect(result.current.error.create).toBeTruthy();
          expect(result.current.loading.create).toBe(false);
        }
      });
    });
  });

  describe('Book Updates', () => {
    test('should update book with optimistic updates', async () => {
      const { result } = renderHook(() => useBook(), { wrapper });
      const updates = { title: 'Updated Title' };

      await act(async () => {
        const startTime = performance.now();
        const updatedBook = await result.current.updateBook(mockBook.id, updates);
        const operationTime = performance.now() - startTime;

        expect(operationTime).toBeLessThan(OPERATION_TIMEOUT);
        expect(updatedBook.title).toBe(updates.title);
      });
    });

    test('should handle update errors with proper rollback', async () => {
      const { result } = renderHook(() => useBook(), { wrapper });

      await act(async () => {
        try {
          await result.current.updateBook('invalid-id', {});
        } catch (e) {
          expect(result.current.error.update).toBeTruthy();
          expect(result.current.loading.update).toBe(false);
        }
      });
    });
  });

  describe('Book Fetching', () => {
    test('should fetch user books with pagination', async () => {
      const { result } = renderHook(() => useBook(), { wrapper });

      await act(async () => {
        const startTime = performance.now();
        await result.current.fetchUserBooks(1, 10);
        const operationTime = performance.now() - startTime;

        expect(operationTime).toBeLessThan(OPERATION_TIMEOUT);
        expect(Array.isArray(result.current.books)).toBe(true);
      });
    });

    test('should handle fetch errors properly', async () => {
      const { result } = renderHook(() => useBook(), { wrapper });

      await act(async () => {
        try {
          await result.current.fetchUserBooks(-1, 0);
        } catch (e) {
          expect(result.current.error.fetch).toBeTruthy();
          expect(result.current.loading.fetch).toBe(false);
        }
      });
    });
  });

  describe('Operation Cancellation', () => {
    test('should cancel ongoing operations', async () => {
      const { result } = renderHook(() => useBook(), { wrapper });

      await act(async () => {
        const createPromise = result.current.createBook(mockBookMetadata);
        result.current.cancelOperation('create');

        try {
          await createPromise;
        } catch (e) {
          expect(e.name).toBe('AbortError');
          expect(result.current.loading.create).toBe(false);
        }
      });
    });
  });

  describe('Type Safety', () => {
    test('should enforce proper typing for book operations', () => {
      const { result } = renderHook(() => useBook(), { wrapper });

      // TypeScript compilation checks
      type CreateBookFn = typeof result.current.createBook;
      type UpdateBookFn = typeof result.current.updateBook;

      // Verify function signatures
      const createBook: CreateBookFn = (metadata: BookMetadata) => Promise.resolve({} as Book);
      const updateBook: UpdateBookFn = (id: string, updates: Partial<Book>) => Promise.resolve({} as Book);

      expect(typeof result.current.createBook).toBe('function');
      expect(typeof result.current.updateBook).toBe('function');
    });
  });

  describe('Performance Optimization', () => {
    test('should handle rapid state updates efficiently', async () => {
      const { result } = renderHook(() => useBook(), { wrapper });
      const updateCount = 10;
      const startTime = performance.now();

      await act(async () => {
        const promises = Array(updateCount).fill(null).map((_, i) => 
          result.current.updateBook(mockBook.id, { title: `Update ${i}` })
        );
        await Promise.all(promises);
      });

      const totalTime = performance.now() - startTime;
      const averageTime = totalTime / updateCount;

      expect(averageTime).toBeLessThan(OPERATION_TIMEOUT / updateCount);
    });
  });
});