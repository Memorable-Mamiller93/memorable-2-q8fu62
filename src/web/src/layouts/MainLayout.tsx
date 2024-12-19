/**
 * @fileoverview Main layout component implementing Material Design 3.0 principles
 * with comprehensive accessibility, responsive layout, and theme support
 * @version 1.0.0
 */

import React, { useCallback, useEffect, useState } from 'react';
import classNames from 'classnames'; // v2.3.2
import { useLocation } from 'react-router-dom';

// Internal imports
import { Header } from '../components/layout/Header';
import { Footer } from '../components/layout/Footer';
import { Navigation } from '../components/layout/Navigation';
import { useTheme } from '../hooks/useTheme';
import { useAuth } from '../hooks/useAuth';

// Types
interface MainLayoutProps {
  children: React.ReactNode;
  className?: string;
  skipNavigation?: boolean;
  customHeader?: React.ReactNode;
  layoutTransition?: 'fade' | 'slide' | 'none';
}

interface LayoutState {
  isTransitioning: boolean;
  animation: string | null;
}

// Constants
const TRANSITION_DURATION = 300;
const MOBILE_BREAKPOINT = 768;
const SKIP_LINK_ID = 'skip-to-content';

/**
 * Enhanced main layout component with accessibility and animations
 */
export const MainLayout: React.FC<MainLayoutProps> = ({
  children,
  className = '',
  skipNavigation = false,
  customHeader,
  layoutTransition = 'fade'
}) => {
  // Hooks
  const { currentTheme, isHighContrastMode } = useTheme();
  const { isAuthenticated } = useAuth();
  const location = useLocation();

  // State
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [layoutState, setLayoutState] = useState<LayoutState>({
    isTransitioning: false,
    animation: null
  });

  /**
   * Handles mobile menu toggle with animation and focus management
   */
  const handleMobileMenuToggle = useCallback(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    setIsMobileMenuOpen(prev => {
      // Update ARIA attributes
      const menuButton = document.querySelector('[aria-controls="mobile-menu"]');
      if (menuButton) {
        menuButton.setAttribute('aria-expanded', (!prev).toString());
      }

      // Handle body scroll lock
      document.body.style.overflow = !prev ? 'hidden' : '';

      return !prev;
    });

    // Manage focus when menu opens/closes
    if (!prefersReducedMotion) {
      setLayoutState({
        isTransitioning: true,
        animation: isMobileMenuOpen ? 'menu-close' : 'menu-open'
      });

      setTimeout(() => {
        setLayoutState({ isTransitioning: false, animation: null });
      }, TRANSITION_DURATION);
    }
  }, [isMobileMenuOpen]);

  /**
   * Handles layout transitions between routes
   */
  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (!prefersReducedMotion && layoutTransition !== 'none') {
      setLayoutState({
        isTransitioning: true,
        animation: `layout-${layoutTransition}`
      });

      setTimeout(() => {
        setLayoutState({ isTransitioning: false, animation: null });
      }, TRANSITION_DURATION);
    }
  }, [location.pathname, layoutTransition]);

  /**
   * Handles keyboard navigation and accessibility
   */
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Skip to content functionality
      if (event.key === 'Tab' && event.shiftKey) {
        const skipLink = document.getElementById(SKIP_LINK_ID);
        if (skipLink) {
          skipLink.style.opacity = '1';
          skipLink.focus();
        }
      }

      // Close mobile menu on escape
      if (event.key === 'Escape' && isMobileMenuOpen) {
        handleMobileMenuToggle();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isMobileMenuOpen, handleMobileMenuToggle]);

  return (
    <div
      className={classNames(
        'layout',
        `layout--${currentTheme?.settings.mode}`,
        {
          'layout--high-contrast': isHighContrastMode,
          'layout--transitioning': layoutState.isTransitioning,
          [`layout--${layoutState.animation}`]: layoutState.animation,
          'layout--mobile-menu-open': isMobileMenuOpen
        },
        className
      )}
      data-theme={currentTheme?.settings.mode}
      role="main"
      aria-live="polite"
    >
      {/* Skip to content link */}
      <a
        id={SKIP_LINK_ID}
        href="#main-content"
        className="skip-link"
        aria-label="Skip to main content"
      >
        Skip to main content
      </a>

      {/* Header */}
      {customHeader || (
        <Header
          onMobileMenuToggle={handleMobileMenuToggle}
          isMobileMenuOpen={isMobileMenuOpen}
        />
      )}

      {/* Navigation */}
      {!skipNavigation && (
        <>
          <Navigation
            variant="desktop"
            className="layout__nav--desktop"
          />
          {isMobileMenuOpen && (
            <Navigation
              variant="mobile"
              className="layout__nav--mobile"
              onClose={handleMobileMenuToggle}
            />
          )}
        </>
      )}

      {/* Main content */}
      <main
        id="main-content"
        className={classNames('layout__content', {
          'layout__content--authenticated': isAuthenticated
        })}
        tabIndex={-1}
      >
        <div className="layout__content-wrapper">
          {children}
        </div>
      </main>

      {/* Footer */}
      <Footer
        variant={isAuthenticated ? 'minimal' : 'default'}
        showSocial={!isAuthenticated}
      />
    </div>
  );
};

export type { MainLayoutProps };
export default MainLayout;