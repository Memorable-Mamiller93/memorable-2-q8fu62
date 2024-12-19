import React, { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import classNames from 'classnames';

// Internal imports
import Button from '../common/Button';
import { DASHBOARD_ROUTES } from '../../constants/routes.constants';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../hooks/useTheme';

// Icons (assuming Material Icons)
import HomeIcon from '@mui/icons-material/Home';
import BookIcon from '@mui/icons-material/Book';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import PersonIcon from '@mui/icons-material/Person';
import LogoutIcon from '@mui/icons-material/Logout';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  className?: string;
}

interface NavItem {
  label: string;
  path: string;
  icon: React.ReactNode;
  loading?: boolean;
}

/**
 * Enhanced Sidebar component implementing Material Design 3.0 principles
 * with comprehensive accessibility support and responsive behavior
 */
export const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  onClose,
  className
}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, isLoading } = useAuth();
  const { currentTheme } = useTheme();
  const [activeItem, setActiveItem] = useState<string>('');
  const [loadingStates, setLoadingStates] = useState<Record<string, boolean>>({});

  // Navigation items configuration
  const navItems: NavItem[] = [
    {
      label: 'My Books',
      path: DASHBOARD_ROUTES.BOOKS,
      icon: <BookIcon aria-hidden="true" />,
      loading: loadingStates[DASHBOARD_ROUTES.BOOKS]
    },
    {
      label: 'My Orders',
      path: DASHBOARD_ROUTES.ORDERS,
      icon: <ShoppingCartIcon aria-hidden="true" />,
      loading: loadingStates[DASHBOARD_ROUTES.ORDERS]
    },
    {
      label: 'Profile',
      path: DASHBOARD_ROUTES.PROFILE,
      icon: <PersonIcon aria-hidden="true" />,
      loading: loadingStates[DASHBOARD_ROUTES.PROFILE]
    }
  ];

  /**
   * Handles navigation with loading states and accessibility
   */
  const handleNavigation = useCallback(async (path: string) => {
    try {
      setLoadingStates(prev => ({ ...prev, [path]: true }));
      await navigate(path);
      setActiveItem(path);
      
      if (window.innerWidth < 768) {
        onClose();
      }
    } finally {
      setLoadingStates(prev => ({ ...prev, [path]: false }));
    }
  }, [navigate, onClose]);

  /**
   * Handles user logout with loading state
   */
  const handleLogout = useCallback(async () => {
    try {
      setLoadingStates(prev => ({ ...prev, logout: true }));
      await logout();
      navigate('/');
    } finally {
      setLoadingStates(prev => ({ ...prev, logout: false }));
    }
  }, [logout, navigate]);

  // Update active item based on current location
  useEffect(() => {
    setActiveItem(location.pathname);
  }, [location]);

  // Handle escape key for accessibility
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  return (
    <aside
      className={classNames(
        'sidebar',
        {
          'sidebar--open': isOpen,
          'sidebar--dark': currentTheme?.settings.mode === 'dark'
        },
        className
      )}
      role="navigation"
      aria-label="Main navigation"
      aria-hidden={!isOpen}
    >
      <div className="sidebar__content">
        {/* User Profile Section */}
        <div className="sidebar__profile" role="banner">
          <div className="sidebar__avatar">
            <PersonIcon aria-hidden="true" />
          </div>
          <div className="sidebar__user-info">
            <p className="sidebar__user-name">{user?.firstName} {user?.lastName}</p>
            <p className="sidebar__user-email">{user?.email}</p>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="sidebar__nav">
          <ul role="menubar" className="sidebar__nav-list">
            {navItems.map((item) => (
              <li
                key={item.path}
                role="none"
                className="sidebar__nav-item"
              >
                <Button
                  variant="text"
                  className={classNames('sidebar__nav-button', {
                    'sidebar__nav-button--active': activeItem === item.path
                  })}
                  onClick={() => handleNavigation(item.path)}
                  startIcon={item.icon}
                  loading={item.loading}
                  ariaLabel={item.label}
                  role="menuitem"
                  aria-current={activeItem === item.path ? 'page' : undefined}
                >
                  {item.label}
                </Button>
              </li>
            ))}
          </ul>
        </nav>

        {/* Logout Section */}
        <div className="sidebar__footer">
          <Button
            variant="text"
            className="sidebar__logout-button"
            onClick={handleLogout}
            startIcon={<LogoutIcon aria-hidden="true" />}
            loading={loadingStates.logout}
            ariaLabel="Logout"
            fullWidth
          >
            Logout
          </Button>
        </div>
      </div>

      {/* Mobile Overlay */}
      {isOpen && (
        <div
          className="sidebar__overlay"
          onClick={onClose}
          role="presentation"
          aria-hidden="true"
        />
      )}
    </aside>
  );
};

export default Sidebar;