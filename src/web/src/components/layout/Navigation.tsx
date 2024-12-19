import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import classNames from 'classnames';
import { ROUTES, AUTH_ROUTES, BOOK_ROUTES, DASHBOARD_ROUTES } from '../../constants/routes.constants';
import { useAuth } from '../../hooks/useAuth';

// Interface definitions
interface NavigationProps {
  variant: 'desktop' | 'mobile';
  className?: string;
  onClose?: () => void;
  ariaLabel?: string;
}

interface NavItem {
  label: string;
  path: string;
  requiresAuth: boolean;
  requiresPremium: boolean;
  icon?: React.ReactNode;
  order?: number;
}

// Constants
const FOCUS_VISIBLE_CLASS = 'focus-visible';
const MOBILE_BREAKPOINT = 768;
const KEYBOARD_KEYS = {
  ESCAPE: 'Escape',
  TAB: 'Tab',
  ENTER: 'Enter',
  SPACE: ' ',
  ARROW_UP: 'ArrowUp',
  ARROW_DOWN: 'ArrowDown',
};

/**
 * Enhanced Navigation component with accessibility and responsive features
 */
export const Navigation: React.FC<NavigationProps> = ({
  variant,
  className,
  onClose,
  ariaLabel = 'Main navigation',
}) => {
  // Hooks
  const { isAuthenticated, isPremium } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  
  // State
  const [isOpen, setIsOpen] = useState(false);
  const [activeItem, setActiveItem] = useState<string>('');
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);
  
  // Refs
  const navRef = useRef<HTMLElement>(null);
  const itemRefs = useRef<(HTMLAnchorElement | null)[]>([]);

  /**
   * Get filtered navigation items based on auth state
   */
  const getNavigationItems = useCallback((): NavItem[] => {
    const baseItems: NavItem[] = [
      { label: 'Home', path: ROUTES.HOME, requiresAuth: false, requiresPremium: false, order: 1 },
      { label: 'Demo', path: ROUTES.DEMO, requiresAuth: false, requiresPremium: false, order: 2 },
      { label: 'Features', path: ROUTES.FEATURES, requiresAuth: false, requiresPremium: false, order: 3 },
    ];

    const authItems: NavItem[] = isAuthenticated ? [
      { label: 'My Books', path: DASHBOARD_ROUTES.BOOKS, requiresAuth: true, requiresPremium: false, order: 4 },
      { label: 'Create Book', path: BOOK_ROUTES.CREATE, requiresAuth: true, requiresPremium: false, order: 5 },
      { label: 'Orders', path: DASHBOARD_ROUTES.ORDERS, requiresAuth: true, requiresPremium: false, order: 6 },
    ] : [];

    const premiumItems: NavItem[] = isPremium ? [
      { label: 'Premium Features', path: DASHBOARD_ROUTES.PREMIUM, requiresAuth: true, requiresPremium: true, order: 7 },
    ] : [];

    return [...baseItems, ...authItems, ...premiumItems]
      .sort((a, b) => (a.order || 0) - (b.order || 0));
  }, [isAuthenticated, isPremium]);

  /**
   * Handle navigation item click with analytics
   */
  const handleNavigation = useCallback((path: string, event?: React.MouseEvent | React.KeyboardEvent) => {
    if (event) {
      event.preventDefault();
    }

    // Track navigation analytics
    window.dispatchEvent(new CustomEvent('navigation', {
      detail: { path, timestamp: Date.now() }
    }));

    // Handle mobile menu closing
    if (variant === 'mobile' && onClose) {
      onClose();
    }

    // Navigate with smooth transition
    setActiveItem(path);
    navigate(path);
  }, [variant, onClose, navigate]);

  /**
   * Handle keyboard navigation
   */
  const handleKeyboardNavigation = useCallback((event: KeyboardEvent) => {
    const items = getNavigationItems();
    
    switch (event.key) {
      case KEYBOARD_KEYS.ARROW_DOWN:
      case KEYBOARD_KEYS.ARROW_UP: {
        event.preventDefault();
        const direction = event.key === KEYBOARD_KEYS.ARROW_DOWN ? 1 : -1;
        const nextIndex = (focusedIndex + direction + items.length) % items.length;
        setFocusedIndex(nextIndex);
        itemRefs.current[nextIndex]?.focus();
        break;
      }
      case KEYBOARD_KEYS.ESCAPE: {
        if (variant === 'mobile' && onClose) {
          onClose();
        }
        break;
      }
      case KEYBOARD_KEYS.TAB: {
        // Implement focus trap for mobile menu
        if (variant === 'mobile' && isOpen) {
          const firstFocusableEl = itemRefs.current[0];
          const lastFocusableEl = itemRefs.current[items.length - 1];
          
          if (event.shiftKey && document.activeElement === firstFocusableEl) {
            event.preventDefault();
            lastFocusableEl?.focus();
          } else if (!event.shiftKey && document.activeElement === lastFocusableEl) {
            event.preventDefault();
            firstFocusableEl?.focus();
          }
        }
        break;
      }
    }
  }, [focusedIndex, getNavigationItems, variant, isOpen, onClose]);

  // Effect for keyboard event listeners
  useEffect(() => {
    document.addEventListener('keydown', handleKeyboardNavigation);
    return () => {
      document.removeEventListener('keydown', handleKeyboardNavigation);
    };
  }, [handleKeyboardNavigation]);

  // Effect for setting active item based on location
  useEffect(() => {
    setActiveItem(location.pathname);
  }, [location]);

  // Effect for focus management
  useEffect(() => {
    if (focusedIndex >= 0) {
      itemRefs.current[focusedIndex]?.focus();
    }
  }, [focusedIndex]);

  return (
    <nav
      ref={navRef}
      className={classNames(
        'navigation',
        `navigation--${variant}`,
        {
          'navigation--open': isOpen,
        },
        className
      )}
      aria-label={ariaLabel}
      role="navigation"
    >
      <ul
        className="navigation__list"
        role="menubar"
        aria-orientation={variant === 'desktop' ? 'horizontal' : 'vertical'}
      >
        {getNavigationItems().map((item, index) => (
          <li
            key={item.path}
            className="navigation__item"
            role="none"
          >
            <Link
              ref={el => itemRefs.current[index] = el}
              to={item.path}
              className={classNames(
                'navigation__link',
                {
                  'navigation__link--active': activeItem === item.path,
                  'navigation__link--focused': focusedIndex === index,
                }
              )}
              onClick={(e) => handleNavigation(item.path, e)}
              onKeyDown={(e) => {
                if (e.key === KEYBOARD_KEYS.ENTER || e.key === KEYBOARD_KEYS.SPACE) {
                  handleNavigation(item.path, e);
                }
              }}
              role="menuitem"
              aria-current={activeItem === item.path ? 'page' : undefined}
              tabIndex={focusedIndex === index ? 0 : -1}
            >
              {item.icon && (
                <span className="navigation__icon" aria-hidden="true">
                  {item.icon}
                </span>
              )}
              <span className="navigation__label">{item.label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
};

export type { NavigationProps, NavItem };
export default Navigation;