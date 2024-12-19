/**
 * @fileoverview Enhanced header component implementing Material Design 3.0 principles
 * with comprehensive accessibility, security, and performance optimizations
 * @version 1.0.0
 */

import React, { useCallback, useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom'; // v6.11.0
import classNames from 'classnames'; // v2.3.2

// Internal imports
import { Button } from '../common/Button';
import { Dropdown } from '../common/Dropdown';
import { useAuth } from '../../hooks/useAuth';
import { useAppDispatch, useAppSelector } from '../../redux/hooks';
import { selectTheme, toggleTheme } from '../../redux/slices/themeSlice';
import { ValidationUtils } from '../../utils/validation.utils';

// Types
interface HeaderProps {
  className?: string;
  ariaLabel?: string;
  testId?: string;
}

// Constants
const SCROLL_THRESHOLD = 50;
const RESIZE_DEBOUNCE = 150;
const MOBILE_BREAKPOINT = 768;

/**
 * Enhanced header component with Material Design 3.0 principles
 */
export const Header: React.FC<HeaderProps> = ({
  className = '',
  ariaLabel = 'Main navigation',
  testId = 'header-component'
}) => {
  // Hooks
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { user, isAuthenticated, logout } = useAuth();
  const theme = useAppSelector(selectTheme);

  // Local state
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < MOBILE_BREAKPOINT);

  // Memoized values
  const userMenuItems = useMemo(() => [
    { value: 'profile', label: 'Profile Settings' },
    { value: 'orders', label: 'My Orders' },
    { value: 'logout', label: 'Sign Out' }
  ], []);

  // Event handlers
  const handleLogin = useCallback(() => {
    navigate('/auth/login', { 
      state: { returnUrl: window.location.pathname }
    });
  }, [navigate]);

  const handleRegister = useCallback(() => {
    navigate('/auth/register', {
      state: { returnUrl: window.location.pathname }
    });
  }, [navigate]);

  const handleLogout = useCallback(async () => {
    try {
      await logout();
      navigate('/', { replace: true });
    } catch (error) {
      console.error('Logout failed:', error);
    }
  }, [logout, navigate]);

  const handleUserMenuSelect = useCallback((value: string) => {
    switch (value) {
      case 'profile':
        navigate('/settings/profile');
        break;
      case 'orders':
        navigate('/orders');
        break;
      case 'logout':
        handleLogout();
        break;
    }
  }, [navigate, handleLogout]);

  const handleThemeToggle = useCallback(() => {
    dispatch(toggleTheme());
  }, [dispatch]);

  // Scroll handler with performance optimization
  useEffect(() => {
    const handleScroll = () => {
      requestAnimationFrame(() => {
        setIsScrolled(window.scrollY > SCROLL_THRESHOLD);
      });
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Resize handler with debounce
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    const handleResize = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
      }, RESIZE_DEBOUNCE);
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(timeoutId);
    };
  }, []);

  // Close menu on escape key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isMenuOpen) {
        setIsMenuOpen(false);
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isMenuOpen]);

  return (
    <header
      className={classNames(
        'header',
        {
          'header--scrolled': isScrolled,
          'header--mobile': isMobile
        },
        className
      )}
      role="banner"
      aria-label={ariaLabel}
      data-testid={testId}
    >
      <div className="header__container">
        {/* Logo Section */}
        <div className="header__logo">
          <a 
            href="/"
            aria-label="Memorable - Home"
            className="header__logo-link"
          >
            Memorable
          </a>
        </div>

        {/* Navigation Section */}
        <nav 
          className="header__nav"
          role="navigation"
          aria-label="Main navigation"
        >
          {!isMobile && (
            <ul className="header__nav-list">
              <li><a href="/create">Create Book</a></li>
              <li><a href="/themes">Themes</a></li>
              <li><a href="/pricing">Pricing</a></li>
            </ul>
          )}
        </nav>

        {/* Controls Section */}
        <div className="header__controls">
          {/* Theme Toggle */}
          <button
            className="header__theme-toggle"
            onClick={handleThemeToggle}
            aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
          >
            <span className="header__theme-icon" aria-hidden="true">
              {theme === 'light' ? '🌙' : '☀️'}
            </span>
          </button>

          {/* User Controls */}
          {isAuthenticated ? (
            <Dropdown
              options={userMenuItems}
              value=""
              onChange={handleUserMenuSelect}
              className="header__user-menu"
              aria-label="User menu"
            />
          ) : (
            <div className="header__auth-buttons">
              <Button
                variant="text"
                onClick={handleLogin}
                className="header__login-btn"
                ariaLabel="Sign in"
              >
                Sign In
              </Button>
              <Button
                variant="primary"
                onClick={handleRegister}
                className="header__register-btn"
                ariaLabel="Create account"
              >
                Get Started
              </Button>
            </div>
          )}

          {/* Mobile Menu Toggle */}
          {isMobile && (
            <button
              className="header__menu-toggle"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              aria-expanded={isMenuOpen}
              aria-controls="mobile-menu"
              aria-label={isMenuOpen ? 'Close menu' : 'Open menu'}
            >
              <span className="header__menu-icon" aria-hidden="true">
                {isMenuOpen ? '✕' : '☰'}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Mobile Menu */}
      {isMobile && (
        <div
          id="mobile-menu"
          className={classNames('header__mobile-menu', {
            'header__mobile-menu--open': isMenuOpen
          })}
          aria-hidden={!isMenuOpen}
        >
          <nav className="header__mobile-nav">
            <ul className="header__mobile-nav-list">
              <li><a href="/create">Create Book</a></li>
              <li><a href="/themes">Themes</a></li>
              <li><a href="/pricing">Pricing</a></li>
            </ul>
          </nav>
        </div>
      )}
    </header>
  );
};

export default Header;