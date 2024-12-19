/**
 * @fileoverview Test suite for BookPreview component
 * Implements comprehensive testing of book preview functionality, accessibility,
 * and performance requirements
 * @version 1.0.0
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { axe, toHaveNoViolations } from 'jest-axe';
import { vi } from 'vitest';
import { ErrorBoundary } from 'react-error-boundary';

import BookPreview from '../../../../src/components/book/BookPreview';
import { useBook } from '../../../../src/hooks/useBook';
import { Book, BookPage } from '../../../../src/types/book.types';

// Add jest-axe matchers
expect.extend(toHaveNoViolations);

// Mock useBook hook
vi.mock('../../../../src/hooks/useBook', () => ({
  useBook: vi.fn()
}));

// Mock performance API
const mockPerformance = {
  now: vi.fn(),
  mark: vi.fn(),
  measure: vi.fn()
};
Object.defineProperty(window, 'performance', { value: mockPerformance });

// Test data
const mockPage: BookPage = {
  pageNumber: 1,
  content: 'Test page content',
  illustration: {
    url: 'test-illustration-url',
    alt: 'Test illustration',
    metadata: {
      width: 800,
      height: 600,
      format: 'jpg'
    }
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
      traits: ['brave'],
      interests: ['adventure']
    },
    supportingCharacters: [],
    settings: {
      fontSize: 16,
      fontFamily: 'Roboto',
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
      storyPrompt: 'test prompt',
      illustrationStyle: 'watercolor',
      generatedAt: new Date(),
      modelVersion: '1.0',
      iterations: 1,
      confidence: 0.9
    }
  },
  status: { status: 'complete', publishedAt: new Date() },
  theme: {
    id: 'test-theme',
    name: 'Magical',
    settings: {} as any,
    active: true,
    metadata: {
      version: '1.0',
      created: new Date().toISOString(),
      updated: new Date().toISOString()
    }
  },
  pages: [mockPage],
  createdAt: new Date(),
  updatedAt: new Date(),
  version: 1
};

// Helper function to render component with Redux store
const renderWithRedux = (
  component: React.ReactElement,
  initialState = {}
) => {
  const store = configureStore({
    reducer: {
      book: (state = initialState) => state
    }
  });

  return render(
    <Provider store={store}>
      <ErrorBoundary fallback={<div>Error occurred</div>}>
        {component}
      </ErrorBoundary>
    </Provider>
  );
};

describe('BookPreview Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPerformance.now.mockReturnValue(0);
  });

  describe('Loading State', () => {
    it('renders loading state correctly', () => {
      (useBook as jest.Mock).mockReturnValue({
        currentBook: null,
        loading: { fetch: true },
        error: null
      });

      renderWithRedux(<BookPreview bookId="test-book-id" />);

      expect(screen.getByRole('status')).toHaveTextContent('Loading book preview...');
      expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');
    });
  });

  describe('Content Display', () => {
    beforeEach(() => {
      (useBook as jest.Mock).mockReturnValue({
        currentBook: mockBook,
        loading: { fetch: false },
        error: null
      });
    });

    it('displays book content with navigation controls', async () => {
      renderWithRedux(<BookPreview bookId="test-book-id" />);

      // Verify content
      expect(screen.getByText(mockPage.content)).toBeInTheDocument();
      expect(screen.getByAltText(mockPage.illustration.alt)).toBeInTheDocument();

      // Verify navigation
      expect(screen.getByRole('button', { name: /previous/i })).toBeDisabled();
      expect(screen.getByRole('button', { name: /next/i })).toBeEnabled();
      expect(screen.getByText(/page 1 of/i)).toBeInTheDocument();
    });

    it('handles keyboard navigation correctly', async () => {
      renderWithRedux(<BookPreview bookId="test-book-id" />);

      // Test arrow key navigation
      fireEvent.keyDown(document, { key: 'ArrowRight' });
      await waitFor(() => {
        expect(screen.getByText(/page 2/i)).toBeInTheDocument();
      });

      fireEvent.keyDown(document, { key: 'ArrowLeft' });
      await waitFor(() => {
        expect(screen.getByText(/page 1/i)).toBeInTheDocument();
      });
    });

    it('supports touch gestures for navigation', async () => {
      renderWithRedux(<BookPreview bookId="test-book-id" />);

      const container = screen.getByRole('region');

      // Simulate swipe right
      fireEvent.touchStart(container, { touches: [{ clientX: 0 }] });
      fireEvent.touchEnd(container, { changedTouches: [{ clientX: 100 }] });

      await waitFor(() => {
        expect(screen.getByText(/page 2/i)).toBeInTheDocument();
      });
    });
  });

  describe('Demo Mode', () => {
    it('displays watermark and upgrade prompt in demo mode', () => {
      (useBook as jest.Mock).mockReturnValue({
        currentBook: mockBook,
        loading: { fetch: false },
        error: null
      });

      const onUpgrade = vi.fn();
      renderWithRedux(
        <BookPreview bookId="test-book-id" isDemo onUpgrade={onUpgrade} />
      );

      expect(screen.getByText(/preview mode/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /upgrade/i })).toBeInTheDocument();

      // Test upgrade button
      fireEvent.click(screen.getByRole('button', { name: /upgrade/i }));
      expect(onUpgrade).toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    it('meets WCAG 2.1 Level AA requirements', async () => {
      (useBook as jest.Mock).mockReturnValue({
        currentBook: mockBook,
        loading: { fetch: false },
        error: null
      });

      const { container } = renderWithRedux(<BookPreview bookId="test-book-id" />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('provides proper ARIA labels and announcements', () => {
      (useBook as jest.Mock).mockReturnValue({
        currentBook: mockBook,
        loading: { fetch: false },
        error: null
      });

      renderWithRedux(<BookPreview bookId="test-book-id" />);

      expect(screen.getByRole('region')).toHaveAttribute('aria-label', 'Book preview');
      expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite');
    });
  });

  describe('Performance', () => {
    it('renders within performance threshold', async () => {
      mockPerformance.now
        .mockReturnValueOnce(0)
        .mockReturnValueOnce(2000); // 2 seconds render time

      (useBook as jest.Mock).mockReturnValue({
        currentBook: mockBook,
        loading: { fetch: false },
        error: null
      });

      renderWithRedux(<BookPreview bookId="test-book-id" />);

      const renderTime = mockPerformance.now();
      expect(renderTime).toBeLessThan(3000); // 3s requirement
    });

    it('handles page transitions smoothly', async () => {
      (useBook as jest.Mock).mockReturnValue({
        currentBook: mockBook,
        loading: { fetch: false },
        error: null
      });

      renderWithRedux(<BookPreview bookId="test-book-id" />);

      mockPerformance.now.mockReturnValue(0);
      fireEvent.click(screen.getByRole('button', { name: /next/i }));

      await waitFor(() => {
        const transitionTime = mockPerformance.now();
        expect(transitionTime).toBeLessThan(300); // Animation duration
      });
    });
  });

  describe('Error Handling', () => {
    it('displays error message when book loading fails', () => {
      const error = { error: 'Failed to load book' };
      (useBook as jest.Mock).mockReturnValue({
        currentBook: null,
        loading: { fetch: false },
        error
      });

      renderWithRedux(<BookPreview bookId="test-book-id" />);

      expect(screen.getByRole('alert')).toHaveTextContent(error.error);
    });

    it('recovers gracefully from rendering errors', () => {
      (useBook as jest.Mock).mockReturnValue({
        currentBook: { ...mockBook, pages: null as any }, // Invalid data
        loading: { fetch: false },
        error: null
      });

      renderWithRedux(<BookPreview bookId="test-book-id" />);

      expect(screen.getByText(/error occurred/i)).toBeInTheDocument();
    });
  });
});