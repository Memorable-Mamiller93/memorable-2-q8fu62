/**
 * @fileoverview Test suite for book slice Redux state management
 * Comprehensive testing of actions, reducers, async thunks, and selectors
 * @version 1.0.0
 */

import { configureStore } from '@reduxjs/toolkit';
import { describe, it, expect, beforeEach, jest, afterEach } from '@jest/globals';
import { waitFor } from '@testing-library/react';

import { 
  bookSlice, 
  fetchUserBooks, 
  createNewBook, 
  updateBook,
  selectCurrentBook,
  selectUserBooks,
  selectBookById,
  selectLoadingStates
} from '../../../src/redux/slices/bookSlice';
import type { Book, BookMetadata, BookStatus } from '../../../src/types/book.types';

// Mock fetch API
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Test data
const mockBook: Book = {
  id: 'test-book-1' as any,
  userId: 'test-user-1' as any,
  themeId: 'adventure-theme' as any,
  title: 'Test Adventure Book',
  metadata: {
    mainCharacter: {
      name: 'Test Hero',
      age: 8,
      traits: ['brave', 'curious'],
      interests: ['exploration', 'science']
    },
    supportingCharacters: [],
    settings: {
      fontSize: 14,
      fontFamily: 'Roboto',
      lineSpacing: 1.5,
      pageLayout: 'standard',
      isGiftWrapped: false
    },
    printOptions: {
      format: 'hardcover',
      paperType: 'premium',
      colorProfile: 'CMYK',
      resolution: 300,
      bleed: 3,
      spine: 10,
      coverFinish: 'matte'
    },
    aiGeneration: {
      storyPrompt: 'Adventure in space',
      illustrationStyle: 'cartoon',
      generatedAt: new Date(),
      modelVersion: '1.0',
      iterations: 3,
      confidence: 0.95
    }
  },
  status: { status: 'draft', progress: 0 },
  theme: {} as any,
  pages: [],
  createdAt: new Date(),
  updatedAt: new Date(),
  version: 1
};

// Test store setup
const createTestStore = () => {
  return configureStore({
    reducer: {
      book: bookSlice.reducer
    }
  });
};

describe('bookSlice', () => {
  let store: ReturnType<typeof createTestStore>;

  beforeEach(() => {
    store = createTestStore();
    mockFetch.mockClear();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('initial state', () => {
    it('should have correct initial state', () => {
      const state = store.getState().book;
      expect(state.currentBook).toBeNull();
      expect(state.userBooks).toEqual({});
      expect(state.loadingStates).toEqual({
        fetch: false,
        create: false,
        update: false,
        delete: false
      });
      expect(state.error).toBeNull();
      expect(state.optimisticUpdates).toEqual([]);
    });
  });

  describe('synchronous actions', () => {
    it('should set current book', () => {
      store.dispatch(bookSlice.actions.setCurrentBook(mockBook));
      expect(selectCurrentBook(store.getState())).toEqual(mockBook);
    });

    it('should clear current book', () => {
      store.dispatch(bookSlice.actions.setCurrentBook(mockBook));
      store.dispatch(bookSlice.actions.setCurrentBook(null));
      expect(selectCurrentBook(store.getState())).toBeNull();
    });

    it('should manage optimistic updates', () => {
      const tempId = 'temp-123';
      store.dispatch(bookSlice.actions.addOptimisticUpdate(tempId));
      expect(store.getState().book.optimisticUpdates).toContain(tempId);

      store.dispatch(bookSlice.actions.removeOptimisticUpdate(tempId));
      expect(store.getState().book.optimisticUpdates).not.toContain(tempId);
    });

    it('should clear error state', () => {
      store.dispatch(bookSlice.actions.clearError());
      expect(store.getState().book.error).toBeNull();
    });
  });

  describe('fetchUserBooks thunk', () => {
    it('should handle successful fetch', async () => {
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve([mockBook])
      });

      await store.dispatch(fetchUserBooks());
      
      expect(selectUserBooks(store.getState())).toEqual([mockBook]);
      expect(selectLoadingStates(store.getState()).fetch).toBeFalsy();
      expect(store.getState().book.error).toBeNull();
    });

    it('should handle fetch error', async () => {
      const error = { code: 'FETCH_ERROR', message: 'Network error' };
      mockFetch.mockRejectedValueOnce(error);

      await store.dispatch(fetchUserBooks());

      expect(store.getState().book.error).toEqual(error);
      expect(selectLoadingStates(store.getState()).fetch).toBeFalsy();
    });

    it('should use cached response within duration', async () => {
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve([mockBook])
      });

      await store.dispatch(fetchUserBooks());
      await store.dispatch(fetchUserBooks());

      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('createNewBook thunk', () => {
    const newBookMetadata: BookMetadata = mockBook.metadata;

    it('should handle successful book creation', async () => {
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve(mockBook)
      });

      const result = await store.dispatch(createNewBook(newBookMetadata));
      
      expect(result.payload).toEqual(mockBook);
      expect(selectBookById(store.getState(), mockBook.id)).toEqual(mockBook);
      expect(selectLoadingStates(store.getState()).create).toBeFalsy();
    });

    it('should handle optimistic updates', async () => {
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve(mockBook)
      });

      const createPromise = store.dispatch(createNewBook(newBookMetadata));
      
      // Verify optimistic update
      expect(selectCurrentBook(store.getState())).toBeTruthy();
      expect(store.getState().book.optimisticUpdates.length).toBe(1);

      await createPromise;

      // Verify final state
      expect(store.getState().book.optimisticUpdates.length).toBe(0);
      expect(selectCurrentBook(store.getState())).toEqual(mockBook);
    });

    it('should handle creation error with retry', async () => {
      mockFetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          json: () => Promise.resolve(mockBook)
        });

      await store.dispatch(createNewBook(newBookMetadata));

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(selectBookById(store.getState(), mockBook.id)).toEqual(mockBook);
    });
  });

  describe('updateBook thunk', () => {
    const updates = { title: 'Updated Title' };

    beforeEach(() => {
      // Setup initial state with a book
      store.dispatch(bookSlice.actions.setCurrentBook(mockBook));
      store.getState().book.userBooks[mockBook.id] = mockBook;
    });

    it('should handle successful update', async () => {
      const updatedBook = { ...mockBook, ...updates };
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve(updatedBook)
      });

      await store.dispatch(updateBook({ id: mockBook.id, updates }));

      expect(selectBookById(store.getState(), mockBook.id)).toEqual(updatedBook);
      expect(selectLoadingStates(store.getState()).update).toBeFalsy();
    });

    it('should handle update error', async () => {
      const error = { code: 'UPDATE_ERROR', message: 'Update failed' };
      mockFetch.mockRejectedValueOnce(error);

      await store.dispatch(updateBook({ id: mockBook.id, updates }));

      expect(store.getState().book.error).toEqual(error);
      expect(selectLoadingStates(store.getState()).update).toBeFalsy();
    });
  });

  describe('selectors', () => {
    beforeEach(() => {
      store.dispatch(bookSlice.actions.setCurrentBook(mockBook));
      store.getState().book.userBooks[mockBook.id] = mockBook;
    });

    it('should select current book', () => {
      expect(selectCurrentBook(store.getState())).toEqual(mockBook);
    });

    it('should select all user books', () => {
      expect(selectUserBooks(store.getState())).toEqual([mockBook]);
    });

    it('should select book by id', () => {
      expect(selectBookById(store.getState(), mockBook.id)).toEqual(mockBook);
    });

    it('should select loading states', () => {
      expect(selectLoadingStates(store.getState())).toEqual({
        fetch: false,
        create: false,
        update: false,
        delete: false
      });
    });
  });
});