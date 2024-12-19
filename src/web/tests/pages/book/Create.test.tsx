/**
 * @fileoverview Comprehensive test suite for CreatePage component
 * Validates book creation workflow, theme selection, navigation behavior,
 * accessibility compliance, and performance metrics
 * @version 1.0.0
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MemoryRouter, useNavigate } from 'react-router-dom';

// Component imports
import CreatePage from '../../../src/pages/book/Create';
import { useBook } from '../../../src/hooks/useBook';
import { useAuth } from '../../../src/hooks/useAuth';
import { useTheme } from '../../../src/hooks/useTheme';

// Constants and types
import { BOOK_ROUTES, AUTH_ROUTES } from '../../../src/constants/routes.constants';
import { Book } from '../../../src/types/book.types';

// Mock implementations
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: vi.fn()
  };
});

vi.mock('../../../src/hooks/useBook', () => ({
  useBook: vi.fn()
}));

vi.mock('../../../src/hooks/useAuth', () => ({
  useAuth: vi.fn()
}));

vi.mock('../../../src/hooks/useTheme', () => ({
  useTheme: vi.fn()
}));

/**
 * Helper function to render component with necessary providers
 */
const renderWithProviders = (
  ui: React.ReactElement,
  { route = '/' } = {}
) => {
  const navigate = vi.fn();
  (useNavigate as jest.Mock).mockReturnValue(navigate);

  return {
    navigate,
    ...render(
      <MemoryRouter initialEntries={[route]}>
        {ui}
      </MemoryRouter>
    )
  };
};

describe('CreatePage Component', () => {
  // Common test setup
  beforeEach(() => {
    vi.useFakeTimers();
    // Mock auth hook
    (useAuth as jest.Mock).mockReturnValue({
      isAuthenticated: true,
      user: { id: 'test-user' }
    });
    // Mock book hook
    (useBook as jest.Mock).mockReturnValue({
      createBook: vi.fn(),
      updateBook: vi.fn(),
      error: null
    });
    // Mock theme hook
    (useTheme as jest.Mock).mockReturnValue({
      currentTheme: { settings: { mode: 'light' } }
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  describe('Rendering and Layout', () => {
    it('renders correctly in normal mode', () => {
      renderWithProviders(<CreatePage />);

      // Verify core components are present
      expect(screen.getByRole('main')).toBeInTheDocument();
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
      expect(screen.getByTestId('book-creator')).toBeInTheDocument();
    });

    it('renders correctly in demo mode', () => {
      renderWithProviders(<CreatePage isDemo={true} />);

      // Verify demo-specific elements
      expect(screen.getByText(/Try the Demo/i)).toBeInTheDocument();
      expect(screen.queryByText(/Save Progress/i)).not.toBeInTheDocument();
    });

    it('applies correct accessibility attributes', () => {
      renderWithProviders(<CreatePage />);

      const main = screen.getByRole('main');
      expect(main).toHaveAttribute('aria-busy', 'false');
      expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuemin', '0');
      expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuemax', '100');
    });
  });

  describe('Authentication Flow', () => {
    it('redirects to login when not authenticated in normal mode', () => {
      (useAuth as jest.Mock).mockReturnValue({
        isAuthenticated: false
      });

      const { navigate } = renderWithProviders(<CreatePage />);

      expect(navigate).toHaveBeenCalledWith(AUTH_ROUTES.LOGIN, {
        state: { returnUrl: BOOK_ROUTES.CREATE }
      });
    });

    it('allows access in demo mode without authentication', () => {
      (useAuth as jest.Mock).mockReturnValue({
        isAuthenticated: false
      });

      const { navigate } = renderWithProviders(<CreatePage isDemo={true} />);

      expect(navigate).not.toHaveBeenCalled();
    });
  });

  describe('Book Creation Flow', () => {
    it('handles successful book creation', async () => {
      const mockBook: Book = {
        id: 'test-book',
        theme: { id: 'theme-1', name: 'Magical' },
        pages: []
      } as Book;

      const createBook = vi.fn().mockResolvedValue(mockBook);
      (useBook as jest.Mock).mockReturnValue({
        createBook,
        error: null
      });

      const { navigate } = renderWithProviders(<CreatePage />);

      // Simulate book creation
      const creator = screen.getByTestId('book-creator');
      fireEvent.click(within(creator).getByText(/Create Book/i));

      await waitFor(() => {
        expect(createBook).toHaveBeenCalled();
        expect(navigate).toHaveBeenCalledWith(
          BOOK_ROUTES.PREVIEW.replace(':id', mockBook.id)
        );
      });
    });

    it('handles book creation errors', async () => {
      const error = new Error('Creation failed');
      const createBook = vi.fn().mockRejectedValue(error);
      (useBook as jest.Mock).mockReturnValue({
        createBook,
        error
      });

      renderWithProviders(<CreatePage />);

      // Simulate book creation
      const creator = screen.getByTestId('book-creator');
      fireEvent.click(within(creator).getByText(/Create Book/i));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent('Creation failed');
      });
    });
  });

  describe('Progress Tracking', () => {
    it('updates progress bar during book creation', async () => {
      renderWithProviders(<CreatePage />);

      const progressBar = screen.getByRole('progressbar');
      
      // Simulate theme selection
      fireEvent.click(screen.getByText(/Select Theme/i));
      await waitFor(() => {
        expect(progressBar).toHaveAttribute('aria-valuenow', '25');
      });

      // Simulate photo upload
      const fileInput = screen.getByLabelText(/Upload Photos/i);
      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
      await userEvent.upload(fileInput, file);
      
      await waitFor(() => {
        expect(progressBar).toHaveAttribute('aria-valuenow', '50');
      });
    });

    it('persists progress in normal mode', async () => {
      const updateBook = vi.fn();
      (useBook as jest.Mock).mockReturnValue({
        updateBook,
        error: null
      });

      renderWithProviders(<CreatePage />);

      // Simulate progress
      fireEvent.click(screen.getByText(/Select Theme/i));

      await waitFor(() => {
        expect(updateBook).toHaveBeenCalled();
      });
    });
  });

  describe('Performance Monitoring', () => {
    it('measures and reports component render time', async () => {
      const start = performance.now();
      renderWithProviders(<CreatePage />);
      const renderTime = performance.now() - start;

      expect(renderTime).toBeLessThan(100); // 100ms threshold
    });

    it('measures and reports AI generation time', async () => {
      const mockBook = { id: 'test-book' } as Book;
      const createBook = vi.fn().mockImplementation(() => {
        return new Promise(resolve => {
          setTimeout(() => resolve(mockBook), 2000);
        });
      });

      (useBook as jest.Mock).mockReturnValue({
        createBook,
        error: null
      });

      renderWithProviders(<CreatePage />);

      // Simulate AI generation
      fireEvent.click(screen.getByText(/Generate Story/i));

      vi.advanceTimersByTime(2000);

      await waitFor(() => {
        expect(createBook).toHaveBeenCalled();
      });
    });
  });

  describe('Accessibility Compliance', () => {
    it('supports keyboard navigation', async () => {
      renderWithProviders(<CreatePage />);

      const creator = screen.getByTestId('book-creator');
      await userEvent.tab();

      expect(creator).toHaveFocus();
    });

    it('announces progress updates', async () => {
      renderWithProviders(<CreatePage />);

      const progressBar = screen.getByRole('progressbar');
      fireEvent.click(screen.getByText(/Select Theme/i));

      await waitFor(() => {
        expect(progressBar).toHaveAttribute('aria-valuenow', '25');
        expect(progressBar).toHaveAttribute('aria-valuetext', 'Creating your book: 25%');
      });
    });
  });
});