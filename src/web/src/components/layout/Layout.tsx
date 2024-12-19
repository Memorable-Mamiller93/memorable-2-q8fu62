/**
 * @fileoverview Enhanced layout component implementing Material Design 3.0 principles
 * with comprehensive accessibility and responsive features
 * @version 1.0.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import classNames from 'classnames'; // v2.3.2
import { useTheme } from '@mui/material'; // v5.14.0

// Internal components
import Header from './Header';
import Navigation from './Navigation';
import Sidebar from './Sidebar';
import Loading from '../common/Loading';

// Layout configuration
const MOBILE_BREAKPOINT = 768;
const SCROLL_THRESHOLD = 50;
const RESIZE_DEBOUNCE = 150;

/**
 * Layout configuration interface
 */
interface LayoutConfig {
  showHeader?: boolean;
  showNavigation?: boolean;
  showSidebar?: boolean;
  fullWidth?: boolean;
  maxWidth?: string;
  padding?: string;
}

/**
 * Layout component props interface
 */
interface LayoutProps {
  children: React.ReactNode;
  variant?: 'default' | 'dashboard' | 'creator' | 'auth' | 'custom';
  className?: string;
  isLoading?: boolean;
  customConfig?: LayoutConfig;
}

/**
 * Custom hook for managing layout state
 */
const useLayoutState = (initialConfig: LayoutConfig) => {
  const [isMobile, setIsMobile] = useState(window.innerWidth < MOBILE_BREAKPOINT);
  const [isScrolled, setIsScrolled] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [config, setConfig] = useState(initialConfig);

  // Handle window resize with debounce
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    const handleResize = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
      }, RESIZE_DEBOUNCE);
    };

    window.addEventListener('resize', handleResize, { passive: true });
    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(timeoutId);
    };
  }, []);

  // Handle scroll events
  useEffect(() => {
    const handleScroll = () => {
      requestAnimationFrame(() => {
        setIsScrolled(window.scrollY > SCROLL_THRESHOLD);
      });
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return {
    isMobile,
    isScrolled,
    isSidebarOpen,
    setIsSidebarOpen,
    config,
    setConfig,
  };
};

/**
 * Custom hook for managing accessibility features
 */
const useAccessibility = (isMenuOpen: boolean) => {
  const mainContentRef = useRef<HTMLDivElement>(null);
  const skipLinkRef = useRef<HTMLAnchorElement>(null);

  // Handle skip link focus
  const handleSkipLinkClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    mainContentRef.current?.focus();
    mainContentRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  // Set up focus trap for mobile menu
  useEffect(() => {
    if (isMenuOpen) {
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          mainContentRef.current?.focus();
        }
      };

      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isMenuOpen]);

  return {
    mainContentRef,
    skipLinkRef,
    handleSkipLinkClick,
  };
};

/**
 * Enhanced Layout component implementing Material Design 3.0 principles
 */
const Layout: React.FC<LayoutProps> = ({
  children,
  variant = 'default',
  className,
  isLoading = false,
  customConfig,
}) => {
  const location = useLocation();
  const theme = useTheme();
  
  // Default configuration based on variant
  const defaultConfig: LayoutConfig = {
    showHeader: variant !== 'auth',
    showNavigation: variant !== 'auth',
    showSidebar: variant === 'dashboard',
    fullWidth: variant === 'creator',
    maxWidth: variant === 'creator' ? '100%' : '1440px',
    padding: variant === 'auth' ? '0' : '24px',
    ...customConfig,
  };

  // Initialize layout state
  const {
    isMobile,
    isScrolled,
    isSidebarOpen,
    setIsSidebarOpen,
    config,
  } = useLayoutState(defaultConfig);

  // Initialize accessibility features
  const {
    mainContentRef,
    skipLinkRef,
    handleSkipLinkClick,
  } = useAccessibility(isSidebarOpen);

  // Handle sidebar toggle
  const handleSidebarToggle = useCallback(() => {
    setIsSidebarOpen(prev => !prev);
  }, []);

  return (
    <div
      className={classNames(
        'layout',
        `layout--${variant}`,
        {
          'layout--scrolled': isScrolled,
          'layout--mobile': isMobile,
          'layout--sidebar-open': isSidebarOpen,
        },
        className
      )}
      data-theme={theme.palette.mode}
    >
      {/* Skip Link for Accessibility */}
      <a
        ref={skipLinkRef}
        href="#main-content"
        className="skip-link"
        onClick={handleSkipLinkClick}
      >
        Skip to main content
      </a>

      {/* Header */}
      {config.showHeader && (
        <Header
          onMenuClick={handleSidebarToggle}
          isScrolled={isScrolled}
          isMobile={isMobile}
        />
      )}

      {/* Navigation */}
      {config.showNavigation && (
        <Navigation
          variant={isMobile ? 'mobile' : 'desktop'}
          onClose={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Main Content */}
      <main
        ref={mainContentRef}
        id="main-content"
        className={classNames('layout__main', {
          'layout__main--full-width': config.fullWidth,
        })}
        style={{
          maxWidth: config.maxWidth,
          padding: config.padding,
        }}
        tabIndex={-1}
        role="main"
        aria-label="Main content"
      >
        {isLoading ? (
          <Loading
            size="large"
            text="Loading content..."
            ariaLabel="Loading page content"
          />
        ) : (
          children
        )}
      </main>

      {/* Sidebar */}
      {config.showSidebar && (
        <Sidebar
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
        />
      )}
    </div>
  );
};

export type { LayoutProps, LayoutConfig };
export default Layout;