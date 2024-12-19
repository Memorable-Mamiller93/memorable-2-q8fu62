/**
 * @fileoverview Enhanced dashboard layout component implementing Material Design 3.0 principles
 * with comprehensive accessibility features and responsive design patterns
 * @version 1.0.0
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import classNames from 'classnames';

// Internal imports
import Header from '../components/layout/Header';
import Sidebar from '../components/layout/Sidebar';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';

// Types
interface DashboardLayoutProps {
  children: React.ReactNode;
  className?: string;
  showSidebar?: boolean;
  initialFocusRef?: React.RefObject<HTMLElement>;
}

/**
 * Enhanced dashboard layout component with accessibility and responsive features
 */
export const DashboardLayout: React.FC<DashboardLayoutProps> = ({
  children,
  className,
  showSidebar = true,
  initialFocusRef
}) => {
  // Hooks
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, checkSessionTimeout } = useAuth();
  const { currentTheme } = useTheme();

  // State
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth >= 1024);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const mainContentRef = useRef<HTMLDivElement>(null);
  const lastFocusedElementRef = useRef<HTMLElement | null>(null);

  /**
   * Handles sidebar toggle with animation and accessibility updates
   */
  const handleSidebarToggle = useCallback(() => {
    setIsTransitioning(true);
    setIsSidebarOpen(prev => !prev);
    
    // Store last focused element for focus restoration
    lastFocusedElementRef.current = document.activeElement as HTMLElement;

    // Update ARIA attributes
    const mainContent = mainContentRef.current;
    if (mainContent) {
      mainContent.setAttribute('aria-expanded', (!isSidebarOpen).toString());
    }
  }, [isSidebarOpen]);

  /**
   * Handles keyboard navigation and shortcuts
   */
  const handleKeyboardNavigation = useCallback((event: KeyboardEvent) => {
    // Close sidebar on escape
    if (event.key === 'Escape' && isSidebarOpen) {
      handleSidebarToggle();
      return;
    }

    // Handle keyboard shortcuts
    if (event.ctrlKey || event.metaKey) {
      switch (event.key) {
        case 'b': // Toggle sidebar
          event.preventDefault();
          handleSidebarToggle();
          break;
        case 'm': // Focus main content
          event.preventDefault();
          mainContentRef.current?.focus();
          break;
      }
    }
  }, [isSidebarOpen, handleSidebarToggle]);

  /**
   * Handles responsive layout adjustments
   */
  useEffect(() => {
    const handleResize = () => {
      const isDesktop = window.innerWidth >= 1024;
      setIsSidebarOpen(isDesktop);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  /**
   * Sets up keyboard navigation and accessibility
   */
  useEffect(() => {
    document.addEventListener('keydown', handleKeyboardNavigation);
    return () => document.removeEventListener('keydown', handleKeyboardNavigation);
  }, [handleKeyboardNavigation]);

  /**
   * Handles authentication and session checks
   */
  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/auth/login', { state: { returnUrl: location.pathname } });
      return;
    }

    const sessionCheckInterval = setInterval(checkSessionTimeout, 60000); // Check every minute
    return () => clearInterval(sessionCheckInterval);
  }, [isAuthenticated, navigate, location.pathname, checkSessionTimeout]);

  /**
   * Manages focus after sidebar transitions
   */
  useEffect(() => {
    if (isTransitioning) {
      const timer = setTimeout(() => {
        setIsTransitioning(false);
        if (!isSidebarOpen && lastFocusedElementRef.current) {
          lastFocusedElementRef.current.focus();
        }
      }, 300); // Match transition duration
      return () => clearTimeout(timer);
    }
  }, [isTransitioning, isSidebarOpen]);

  /**
   * Sets initial focus when component mounts
   */
  useEffect(() => {
    if (initialFocusRef?.current) {
      initialFocusRef.current.focus();
    }
  }, [initialFocusRef]);

  return (
    <div
      className={classNames(
        'dashboard-layout',
        {
          'dashboard-layout--sidebar-open': isSidebarOpen,
          'dashboard-layout--transitioning': isTransitioning,
          [`theme-${currentTheme?.settings.mode}`]: currentTheme?.settings.mode,
        },
        className
      )}
      data-testid="dashboard-layout"
    >
      <Header
        className="dashboard-layout__header"
        onMenuClick={handleSidebarToggle}
      />

      <div className="dashboard-layout__container">
        {showSidebar && (
          <Sidebar
            isOpen={isSidebarOpen}
            onClose={handleSidebarToggle}
            className="dashboard-layout__sidebar"
          />
        )}

        <main
          ref={mainContentRef}
          className={classNames('dashboard-layout__main', {
            'dashboard-layout__main--shifted': isSidebarOpen && showSidebar
          })}
          role="main"
          tabIndex={-1}
          aria-label="Main content"
        >
          {children}
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;