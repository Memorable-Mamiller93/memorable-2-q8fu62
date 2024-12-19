/**
 * @fileoverview Comprehensive test suite for the BookCreator component
 * Tests theme selection, book creation workflow, accessibility, and performance
 * @version 1.0.0
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { axe, toHaveNoViolations } from 'jest-axe';
import { vi, describe, it, expect, beforeEach } from 'vitest';

import BookCreator from '../../src/components/book/BookCreator';
import { Book, BookPage, BookStatus, Theme } from '../../src/types/book.types';
import { useBook } from '../../src/hooks/useBook';

// Add jest-axe matchers
expect.extend(toHaveNoViolations);

// Mock the hooks and components
vi.mock('../../src/hooks/useBook');
vi.mock('../../src/components/book/ThemeSelector', () => ({
  default: ({ onThemeSelect, selectedThemeId }: any) => (
    <div data-testid="theme-selector">
      <button onClick={() => onThemeSelect(mockTheme)}>
        Select Theme
      </button>
    </div>
  )
}));

// Test data
const mockTheme: Theme = {
  id: 'test-theme-id',
  name: 'Adventure',
  settings: {
    colors: {
      primary: { base: '#000000' },
      secondary: { base: '#ffffff' }
    },
    typography: {
      fontFamily: 'Arial',
      fontSize: '16px'
    },
    layout: {
      spacing: '8px'
    },
    mode: 'light',
    direction: 'ltr',
    motion: 'no-preference'
  },
  active: true,
  metadata: {
    version: '1.0.0',
    created: '2023-01-01',
    updated: '2023-01-01'
  }
};

const mockBook: Book = {
  id: 'test-book-id' as any,
  userId: 'test-user-id' as any,
  themeId: 'test-theme-id' as any,
  title: 'Test Book',
  metadata: {
    mainCharacter: {
      name: 'Test Character',
      traits: [],
      interests: []
    },
    supportingCharacters: [],
    settings: {
      fontSize: 16,
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
      storyPrompt: '',
      illustrationStyle: '',
      generatedAt: new Date(),
      modelVersion: '1.0',
      iterations: 1,
      confidence: 0.9
    }
  },
  status: { status: 'draft', progress: 0 },
  theme: mockTheme,
  pages: [],
  createdAt: new Date(),
  updatedAt: new Date(),
  version: 1
};

// Helper function to render with Redux store
const renderWithRedux = (
  component: React.ReactElement,
  initialState = {}
) => {
  const store = configureStore({
    reducer: {
      book: (state = initialState) => state
    }
  });

  return {
    ...render(
      <Provider store={store}>
        {component}
      </Provider>
    ),
    store
  };
};

// Performance measurement setup
const setupPerformanceTest = () => {
  const marks: { [key: string]: number } = {};
  const measure = (name: string, startMark: string, endMark: string) => {
    marks[name] = marks[endMark] - marks[startMark];
  };

  return {
    marks,
    measure,
    mark: (name: string) => {
      marks[name] = performance.now();
    }
  };
};

describe('BookCreator Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useBook as jest.Mock).mockReturnValue({
      currentBook: null,
      loading: false,
      error: null,
      createBook: vi.fn(),
      updateBook: vi.fn(),
      fetchUserBooks: vi.fn(),
      setCurrentBook: vi.fn(),
      resetError: vi.fn()
    });
  });

  it('renders in demo mode correctly', async () => {
    const { container } = renderWithRedux(
      <BookCreator isDemo onComplete={vi.fn()} />
    );

    // Check basic structure
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
    expect(screen.getByTestId('theme-selector')).toBeInTheDocument();
    
    // Verify demo watermark
    expect(screen.getByText(/demo/i)).toBeInTheDocument();

    // Check accessibility
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('handles theme selection with performance tracking', async () => {
    const perf = setupPerformanceTest();
    const mockCreateBook = vi.fn().mockResolvedValue(mockBook);
    (useBook as jest.Mock).mockReturnValue({
      currentBook: null,
      loading: false,
      error: null,
      createBook: mockCreateBook
    });

    perf.mark('themeSelectionStart');
    renderWithRedux(
      <BookCreator onComplete={vi.fn()} />
    );

    // Select theme
    const themeSelector = screen.getByTestId('theme-selector');
    await userEvent.click(within(themeSelector).getByText('Select Theme'));

    perf.mark('themeSelectionEnd');
    perf.measure('themeSelection', 'themeSelectionStart', 'themeSelectionEnd');

    // Verify performance
    expect(perf.marks.themeSelection).toBeLessThan(1000); // 1 second threshold

    // Verify book creation
    expect(mockCreateBook).toHaveBeenCalledWith(expect.objectContaining({
      theme: mockTheme
    }));
  });

  it('handles keyboard navigation', async () => {
    renderWithRedux(
      <BookCreator onComplete={vi.fn()} />
    );

    // Focus main content
    const mainContent = screen.getByRole('main');
    mainContent.focus();

    // Test keyboard navigation
    await userEvent.keyboard('{Tab}');
    expect(screen.getByTestId('theme-selector')).toHaveFocus();

    await userEvent.keyboard('{Enter}');
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '25');
  });

  it('displays error states appropriately', async () => {
    const mockError = new Error('Test error');
    (useBook as jest.Mock).mockReturnValue({
      currentBook: null,
      loading: false,
      error: mockError,
      createBook: vi.fn().mockRejectedValue(mockError)
    });

    renderWithRedux(
      <BookCreator onComplete={vi.fn()} />
    );

    // Select theme to trigger error
    const themeSelector = screen.getByTestId('theme-selector');
    await userEvent.click(within(themeSelector).getByText('Select Theme'));

    // Verify error display
    expect(await screen.findByRole('alert')).toHaveTextContent('Test error');
  });

  it('tracks progress through book creation steps', async () => {
    const mockCreateBook = vi.fn().mockResolvedValue(mockBook);
    (useBook as jest.Mock).mockReturnValue({
      currentBook: null,
      loading: false,
      error: null,
      createBook: mockCreateBook
    });

    renderWithRedux(
      <BookCreator onComplete={vi.fn()} />
    );

    // Initial progress
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');

    // Select theme
    await userEvent.click(screen.getByText('Select Theme'));
    
    // Verify progress update
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '25');
  });

  it('handles high contrast mode correctly', async () => {
    renderWithRedux(
      <BookCreator onComplete={vi.fn()} highContrast />
    );

    // Verify high contrast styles
    const container = screen.getByTestId('theme-selector');
    expect(container).toHaveClass('highContrast');
  });

  it('maintains state during navigation', async () => {
    const mockUpdateBook = vi.fn().mockResolvedValue(mockBook);
    (useBook as jest.Mock).mockReturnValue({
      currentBook: mockBook,
      loading: false,
      error: null,
      updateBook: mockUpdateBook
    });

    const { rerender } = renderWithRedux(
      <BookCreator onComplete={vi.fn()} />
    );

    // Simulate navigation
    rerender(<BookCreator onComplete={vi.fn()} />);

    // Verify state persistence
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '25');
  });
});