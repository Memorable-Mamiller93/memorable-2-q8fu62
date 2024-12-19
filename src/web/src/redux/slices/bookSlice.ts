/**
 * @fileoverview Redux slice for managing personalized children's book state
 * Implements book creation, editing, and listing functionality with enhanced
 * error handling, optimistic updates, and request management
 * @version 1.0.0
 */

import { createSlice, createAsyncThunk, createSelector, PayloadAction } from '@reduxjs/toolkit';
import { Book, BookMetadata, BookStatus } from '../../types/book.types';

// Constants
const REQUEST_TIMEOUT = 30000;
const RETRY_ATTEMPTS = 3;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Types
interface BookState {
  currentBook: Book | null;
  userBooks: Record<string, Book>;
  loadingStates: {
    fetch: boolean;
    create: boolean;
    update: boolean;
    delete: boolean;
  };
  error: {
    code: string;
    message: string;
  } | null;
  requestCache: Map<string, {
    promise: Promise<any>;
    timestamp: number;
  }>;
  optimisticUpdates: string[];
}

// Initial state
const initialState: BookState = {
  currentBook: null,
  userBooks: {},
  loadingStates: {
    fetch: false,
    create: false,
    update: false,
    delete: false,
  },
  error: null,
  requestCache: new Map(),
  optimisticUpdates: [],
};

/**
 * Fetch all books for the current user
 * Implements request deduplication and caching
 */
export const fetchUserBooks = createAsyncThunk(
  'book/fetchUserBooks',
  async (_, { getState, rejectWithValue }) => {
    try {
      const cacheKey = 'fetchUserBooks';
      const cachedRequest = (getState() as any).book.requestCache.get(cacheKey);

      if (cachedRequest && Date.now() - cachedRequest.timestamp < CACHE_DURATION) {
        return cachedRequest.promise;
      }

      const promise = new Promise<Book[]>(async (resolve, reject) => {
        const timeoutId = setTimeout(() => {
          reject(new Error('Request timeout'));
        }, REQUEST_TIMEOUT);

        try {
          // API call would go here
          const response = await fetch('/api/v1/books');
          const books = await response.json();
          clearTimeout(timeoutId);
          resolve(books);
        } catch (error) {
          clearTimeout(timeoutId);
          reject(error);
        }
      });

      (getState() as any).book.requestCache.set(cacheKey, {
        promise,
        timestamp: Date.now(),
      });

      return await promise;
    } catch (error: any) {
      return rejectWithValue({
        code: error.code || 'FETCH_ERROR',
        message: error.message || 'Failed to fetch books',
      });
    }
  }
);

/**
 * Create a new book with optimistic updates
 */
export const createNewBook = createAsyncThunk(
  'book/createNewBook',
  async (metadata: BookMetadata, { dispatch, rejectWithValue }) => {
    const tempId = `temp-${Date.now()}`;
    const optimisticBook: Book = {
      id: tempId as any,
      userId: 'current-user' as any,
      themeId: metadata.settings.theme as any,
      title: metadata.title || 'Untitled Book',
      metadata,
      status: { status: 'draft', progress: 0 },
      theme: {} as any,
      pages: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      version: 1,
    };

    try {
      dispatch(bookSlice.actions.addOptimisticUpdate(tempId));
      dispatch(bookSlice.actions.setCurrentBook(optimisticBook));

      let attempts = 0;
      let book: Book | null = null;

      while (attempts < RETRY_ATTEMPTS && !book) {
        try {
          // API call would go here
          const response = await fetch('/api/v1/books', {
            method: 'POST',
            body: JSON.stringify(metadata),
          });
          book = await response.json();
        } catch (error) {
          attempts++;
          if (attempts === RETRY_ATTEMPTS) throw error;
          await new Promise(resolve => setTimeout(resolve, 1000 * attempts));
        }
      }

      if (!book) throw new Error('Failed to create book after retries');

      // Track analytics
      trackBookCreation(book);

      return book;
    } catch (error: any) {
      dispatch(bookSlice.actions.removeOptimisticUpdate(tempId));
      return rejectWithValue({
        code: error.code || 'CREATE_ERROR',
        message: error.message || 'Failed to create book',
      });
    }
  }
);

/**
 * Update existing book with optimistic updates
 */
export const updateBook = createAsyncThunk(
  'book/updateBook',
  async ({ id, updates }: { id: string; updates: Partial<Book> }, { getState, rejectWithValue }) => {
    try {
      const currentBook = (getState() as any).book.userBooks[id];
      if (!currentBook) throw new Error('Book not found');

      const optimisticBook = { ...currentBook, ...updates, updatedAt: new Date() };

      // API call would go here
      const response = await fetch(`/api/v1/books/${id}`, {
        method: 'PUT',
        body: JSON.stringify(updates),
      });
      
      return await response.json();
    } catch (error: any) {
      return rejectWithValue({
        code: error.code || 'UPDATE_ERROR',
        message: error.message || 'Failed to update book',
      });
    }
  }
);

// Analytics helper
const trackBookCreation = (book: Book) => {
  // Analytics implementation would go here
};

// Create the slice
export const bookSlice = createSlice({
  name: 'book',
  initialState,
  reducers: {
    setCurrentBook: (state, action: PayloadAction<Book | null>) => {
      state.currentBook = action.payload;
    },
    addOptimisticUpdate: (state, action: PayloadAction<string>) => {
      state.optimisticUpdates.push(action.payload);
    },
    removeOptimisticUpdate: (state, action: PayloadAction<string>) => {
      state.optimisticUpdates = state.optimisticUpdates.filter(id => id !== action.payload);
    },
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    // Fetch books reducers
    builder.addCase(fetchUserBooks.pending, (state) => {
      state.loadingStates.fetch = true;
      state.error = null;
    });
    builder.addCase(fetchUserBooks.fulfilled, (state, action) => {
      state.loadingStates.fetch = false;
      state.userBooks = action.payload.reduce((acc, book) => {
        acc[book.id] = book;
        return acc;
      }, {} as Record<string, Book>);
    });
    builder.addCase(fetchUserBooks.rejected, (state, action) => {
      state.loadingStates.fetch = false;
      state.error = action.payload as any;
    });

    // Create book reducers
    builder.addCase(createNewBook.pending, (state) => {
      state.loadingStates.create = true;
      state.error = null;
    });
    builder.addCase(createNewBook.fulfilled, (state, action) => {
      state.loadingStates.create = false;
      state.userBooks[action.payload.id] = action.payload;
      state.currentBook = action.payload;
      state.optimisticUpdates = state.optimisticUpdates.filter(
        id => !id.startsWith('temp-')
      );
    });
    builder.addCase(createNewBook.rejected, (state, action) => {
      state.loadingStates.create = false;
      state.error = action.payload as any;
    });

    // Update book reducers
    builder.addCase(updateBook.pending, (state) => {
      state.loadingStates.update = true;
      state.error = null;
    });
    builder.addCase(updateBook.fulfilled, (state, action) => {
      state.loadingStates.update = false;
      state.userBooks[action.payload.id] = action.payload;
      if (state.currentBook?.id === action.payload.id) {
        state.currentBook = action.payload;
      }
    });
    builder.addCase(updateBook.rejected, (state, action) => {
      state.loadingStates.update = false;
      state.error = action.payload as any;
    });
  },
});

// Selectors
export const selectCurrentBook = createSelector(
  [(state: { book: BookState }) => state.book.currentBook],
  (currentBook) => currentBook
);

export const selectUserBooks = createSelector(
  [(state: { book: BookState }) => state.book.userBooks],
  (userBooks) => Object.values(userBooks)
);

export const selectBookById = createSelector(
  [
    (state: { book: BookState }) => state.book.userBooks,
    (_: any, bookId: string) => bookId,
  ],
  (userBooks, bookId) => userBooks[bookId]
);

export const selectLoadingStates = createSelector(
  [(state: { book: BookState }) => state.book.loadingStates],
  (loadingStates) => loadingStates
);

// Export actions and reducer
export const { setCurrentBook, clearError } = bookSlice.actions;
export default bookSlice.reducer;