/**
 * @fileoverview Comprehensive test suite for the Home page component
 * Verifies landing page functionality, navigation, accessibility, and responsive behavior
 * @version 1.0.0
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import { axe } from '@axe-core/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

// Internal imports
import { Home } from '../../../../src/pages/home/Home';
import { ROUTES } from '../../../../src/constants/routes.constants';

// Mock dependencies
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: vi.fn()
  };
});

vi.mock('@analytics/react', () => ({
  useAnalytics: () => ({
    track: vi.fn()
  })
}));

/**
 * Helper function to render component with router context
 */
const renderWithRouter = (
  component: React.ReactElement,
  { initialRoute = '/', mockNavigate = vi.fn() } = {}
) => {
  (useNavigate as jest.Mock).mockReturnValue(mockNavigate);
  
  return {
    user: userEvent.setup(),
    ...render(
      <MemoryRouter initialEntries={[initialRoute]}>
        {component}
      </MemoryRouter>
    )
  };
};

describe('Home Page Component', () => {
  let mockNavigate: jest.Mock;

  beforeEach(() => {
    mockNavigate = vi.fn();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('renders hero section with correct content', () => {
    renderWithRouter(<Home />);

    // Verify main heading
    const mainHeading = screen.getByRole('heading', {
      level: 1,
      name: /Create Magical Stories for Children/i
    });
    expect(mainHeading).toBeInTheDocument();

    // Verify subtitle
    expect(screen.getByText(/Transform your loved ones into storybook characters/i))
      .toBeInTheDocument();

    // Verify CTA buttons
    const tryDemoButton = screen.getByRole('button', { name: /Try Demo Now/i });
    const learnMoreButton = screen.getByRole('button', { name: /See How It Works/i });
    
    expect(tryDemoButton).toBeInTheDocument();
    expect(learnMoreButton).toBeInTheDocument();
  });

  it('displays sample books section correctly', () => {
    renderWithRouter(<Home />);

    // Verify sample books section
    const samplesSection = screen.getByRole('region', { name: /Sample book previews/i });
    expect(samplesSection).toBeInTheDocument();

    // Verify book cards
    const bookCards = screen.getAllByRole('listitem');
    expect(bookCards).toHaveLength(2);

    // Verify first book content
    const firstBook = bookCards[0];
    expect(within(firstBook).getByText('The Magical Adventure')).toBeInTheDocument();
    expect(firstBook.querySelector('img')).toHaveAttribute(
      'alt',
      'A colorful storybook cover showing a child on a magical journey through a fantasy world'
    );
  });

  it('handles navigation interactions correctly', async () => {
    const { user } = renderWithRouter(<Home />, { mockNavigate });

    // Click demo button
    await user.click(screen.getByRole('button', { name: /Try Demo Now/i }));
    expect(mockNavigate).toHaveBeenCalledWith(ROUTES.DEMO);

    // Click learn more button
    await user.click(screen.getByRole('button', { name: /See How It Works/i }));
    expect(mockNavigate).toHaveBeenCalledWith(ROUTES.FEATURES);
  });

  it('maintains accessibility standards', async () => {
    const { container } = renderWithRouter(<Home />);

    // Run axe accessibility tests
    const results = await axe(container);
    expect(results).toHaveNoViolations();

    // Verify ARIA landmarks
    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: /Sample book previews/i }))
      .toBeInTheDocument();

    // Test keyboard navigation
    const firstButton = screen.getByRole('button', { name: /Try Demo Now/i });
    firstButton.focus();
    expect(document.activeElement).toBe(firstButton);

    // Verify focus order
    fireEvent.keyDown(firstButton, { key: 'Tab' });
    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: /See How It Works/i })
    );
  });

  it('handles responsive layout correctly', async () => {
    const { rerender } = renderWithRouter(<Home />);

    // Test mobile viewport
    window.innerWidth = 375;
    window.dispatchEvent(new Event('resize'));
    rerender(<Home />);

    // Verify mobile layout adjustments
    const heroSection = screen.getByRole('region', { name: /hero/i });
    expect(heroSection).toHaveClass('hero--mobile');

    // Test tablet viewport
    window.innerWidth = 768;
    window.dispatchEvent(new Event('resize'));
    rerender(<Home />);

    // Verify tablet layout adjustments
    expect(heroSection).toHaveClass('hero--tablet');

    // Test desktop viewport
    window.innerWidth = 1200;
    window.dispatchEvent(new Event('resize'));
    rerender(<Home />);

    // Verify desktop layout adjustments
    expect(heroSection).toHaveClass('hero--desktop');
  });

  it('tracks analytics events correctly', async () => {
    const mockAnalytics = {
      track: vi.fn()
    };

    vi.mock('@analytics/react', () => ({
      useAnalytics: () => mockAnalytics
    }));

    const { user } = renderWithRouter(<Home />);

    // Verify page view tracking
    expect(mockAnalytics.track).toHaveBeenCalledWith('page_view', {
      page: 'home',
      timestamp: expect.any(String)
    });

    // Verify CTA click tracking
    await user.click(screen.getByRole('button', { name: /Try Demo Now/i }));
    expect(mockAnalytics.track).toHaveBeenCalledWith('cta_click', {
      button: 'try_demo',
      location: 'hero_section'
    });
  });

  it('handles error states gracefully', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockNavigate.mockImplementation(() => {
      throw new Error('Navigation failed');
    });

    const { user } = renderWithRouter(<Home />);

    // Attempt navigation
    await user.click(screen.getByRole('button', { name: /Try Demo Now/i }));

    // Verify error handling
    expect(consoleError).toHaveBeenCalled();
    expect(screen.queryByText(/Error/i)).not.toBeInTheDocument();

    consoleError.mockRestore();
  });
});