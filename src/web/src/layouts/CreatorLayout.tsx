/**
 * @fileoverview Creator Layout component implementing Material Design 3.0 principles
 * with comprehensive accessibility features and responsive design
 * @version 1.0.0
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, Outlet, useLocation } from 'react-router-dom';
import classNames from 'classnames';

// Internal imports
import Header from '../components/layout/Header';
import Sidebar from '../components/layout/Sidebar';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../hooks/useTheme';

// Constants
const MOBILE_BREAKPOINT = 768;
const SWIPE_THRESHOLD = 50;
const TRANSITION_DURATION = 300;

interface CreatorLayoutProps {
  className?: string;
  children?: React.ReactNode;
  requireAuth?: boolean;
}

/**
 * Enhanced creator layout component with responsive design and accessibility features
 */
export const CreatorLayout: React.FC<CreatorLayoutProps> = ({
  className = '',
  requireAuth = true,
}) => {
  // Hooks
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, loading } = useAuth();
  const { currentTheme, isHighContrastMode } = useTheme();

  // State
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth >= MOBILE_BREAKPOINT);
  const [isLoading, setIsLoading] = useState(loading);
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);
  const [error, setError] = useState<Error | null>(null);

  // Memoized values
  const layoutClasses = useMemo(() => 
    classNames(
      'creator-layout',
      {
        'creator-layout--sidebar-open': isSidebarOpen,
        'creator-layout--high-contrast': isHighContrastMode,
        'creator-layout--loading': isLoading,
        [`theme-${currentTheme?.settings.mode}`]: currentTheme?.settings.mode,
      },
      className
    ),
    [isSidebarOpen, isHighContrastMode, isLoading, currentTheme, className]
  );

  /**
   * Handles sidebar toggle with smooth transitions
   */
  const handleSidebarToggle = useCallback(() => {
    setIsSidebarOpen(prev => !prev);
    // Update ARIA attributes
    document.getElementById('main-content')?.setAttribute(
      'aria-expanded',
      (!isSidebarOpen).toString()
    );
  }, [isSidebarOpen]);

  /**
   * Handles authentication redirection
   */
  const handleAuthRedirect = useCallback(() => {
    if (requireAuth && !isAuthenticated && !loading) {
      navigate('/auth/login', {
        state: { returnUrl: location.pathname },
        replace: true
      });
    }
  }, [requireAuth, isAuthenticated, loading, navigate, location.pathname]);

  /**
   * Handles touch interactions for mobile devices
   */
  const handleTouchStart = useCallback((event: TouchEvent) => {
    setTouchStart({
      x: event.touches[0].clientX,
      y: event.touches[0].clientY
    });
  }, []);

  const handleTouchMove = useCallback((event: TouchEvent) => {
    if (!touchStart) return;

    const xDiff = touchStart.x - event.touches[0].clientX;
    const yDiff = touchStart.y - event.touches[0].clientY;

    // Only handle horizontal swipes
    if (Math.abs(xDiff) > Math.abs(yDiff) && Math.abs(xDiff) > SWIPE_THRESHOLD) {
      if (xDiff > 0) {
        // Swipe left - close sidebar
        setIsSidebarOpen(false);
      } else {
        // Swipe right - open sidebar
        setIsSidebarOpen(true);
      }
      setTouchStart(null);
    }
  }, [touchStart]);

  /**
   * Handle window resize
   */
  useEffect(() => {
    const handleResize = () => {
      setIsSidebarOpen(window.innerWidth >= MOBILE_BREAKPOINT);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  /**
   * Handle touch events
   */
  useEffect(() => {
    document.addEventListener('touchstart', handleTouchStart);
    document.addEventListener('touchmove', handleTouchMove);

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
    };
  }, [handleTouchStart, handleTouchMove]);

  /**
   * Handle authentication check
   */
  useEffect(() => {
    handleAuthRedirect();
  }, [handleAuthRedirect]);

  /**
   * Handle loading state
   */
  useEffect(() => {
    setIsLoading(loading);
  }, [loading]);

  /**
   * Error boundary
   */
  if (error) {
    return (
      <div className="creator-layout__error" role="alert">
        <h2>Something went wrong</h2>
        <p>{error.message}</p>
        <button onClick={() => setError(null)}>Try Again</button>
      </div>
    );
  }

  return (
    <div className={layoutClasses} data-testid="creator-layout">
      {/* Skip to main content link for accessibility */}
      <a href="#main-content" className="creator-layout__skip-link">
        Skip to main content
      </a>

      <Header
        className="creator-layout__header"
        onMenuClick={handleSidebarToggle}
      />

      <div className="creator-layout__container">
        <Sidebar
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
          className="creator-layout__sidebar"
        />

        <main
          id="main-content"
          className="creator-layout__content"
          role="main"
          aria-live="polite"
        >
          {isLoading ? (
            <div 
              className="creator-layout__loading"
              role="progressbar"
              aria-busy="true"
              aria-label="Loading content"
            >
              <div className="creator-layout__loading-spinner" />
            </div>
          ) : (
            <Outlet />
          )}
        </main>
      </div>
    </div>
  );
};

export default CreatorLayout;