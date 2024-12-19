/**
 * @fileoverview Enterprise-grade notification component with accessibility support
 * Implements Material Design 3.0 principles and WCAG 2.1 Level AA compliance
 * @version 1.0.0
 */

import React, { useEffect, useCallback, memo } from 'react';
import { useDispatch } from 'react-redux';
import classNames from 'classnames'; // v2.3.2
import { Button } from './Button';
import { useTheme } from '../../hooks/useTheme';
import styles from '../../styles/components.css';

// Type definitions for notification variants
type NotificationType = 'success' | 'error' | 'warning' | 'info';

/**
 * Props interface for the Notification component
 */
interface NotificationProps {
  /** Unique identifier for the notification instance */
  id: string;
  /** Content of the notification message */
  message: string;
  /** Severity level determining visual style and ARIA properties */
  type?: NotificationType;
  /** Auto-dismiss duration in milliseconds */
  duration?: number;
  /** Controls whether notification can be manually dismissed */
  dismissible?: boolean;
  /** Optional callback fired on notification dismissal */
  onDismiss?: (id: string) => void;
}

/**
 * Icon mapping for notification types
 */
const NotificationIcons: Record<NotificationType, React.ReactNode> = {
  success: (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"
      />
    </svg>
  ),
  error: (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"
      />
    </svg>
  ),
  warning: (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"
      />
    </svg>
  ),
  info: (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"
      />
    </svg>
  ),
};

/**
 * Generates theme-aware CSS class names based on notification type and state
 */
const getNotificationClasses = (type: NotificationType, isVisible: boolean) => {
  const { currentTheme } = useTheme();
  const isDark = currentTheme?.settings.mode === 'dark';

  return classNames(
    styles.notification,
    styles[`notification-${type}`],
    {
      [styles['notification-visible']]: isVisible,
      [styles['notification-dark']]: isDark,
      [styles['notification-light']]: !isDark,
    }
  );
};

/**
 * Enterprise-grade notification component with accessibility support
 * Implements Material Design 3.0 principles and WCAG 2.1 Level AA compliance
 */
export const Notification: React.FC<NotificationProps> = memo(({
  id,
  message,
  type = 'info',
  duration = 5000,
  dismissible = true,
  onDismiss,
}) => {
  const dispatch = useDispatch();
  const [isVisible, setIsVisible] = React.useState(true);
  const { currentTheme } = useTheme();

  // Handle notification dismissal
  const handleDismiss = useCallback(() => {
    setIsVisible(false);
    
    // Allow animation to complete before removal
    setTimeout(() => {
      dispatch({ type: 'notifications/remove', payload: id });
      onDismiss?.(id);
    }, 300);
  }, [dispatch, id, onDismiss]);

  // Auto-dismiss timer
  useEffect(() => {
    if (duration && duration > 0) {
      const timer = setTimeout(handleDismiss, duration);
      return () => clearTimeout(timer);
    }
  }, [duration, handleDismiss]);

  // Keyboard event handler for accessibility
  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (event.key === 'Escape' && dismissible) {
      handleDismiss();
    }
  }, [dismissible, handleDismiss]);

  const notificationClasses = getNotificationClasses(type, isVisible);

  return (
    <div
      role="alert"
      aria-live={type === 'error' ? 'assertive' : 'polite'}
      aria-atomic="true"
      className={notificationClasses}
      data-testid="notification"
      data-type={type}
      onKeyDown={handleKeyDown}
      style={{
        transition: `all ${currentTheme?.settings.motion === 'reduced' ? '0.01ms' : '300ms'} var(--transition-easing-standard)`,
      }}
    >
      <div className={styles['notification-content']}>
        <span className={styles['notification-icon']} aria-hidden="true">
          {NotificationIcons[type]}
        </span>
        <span className={styles['notification-message']}>{message}</span>
        {dismissible && (
          <Button
            variant="text"
            size="small"
            onClick={handleDismiss}
            ariaLabel="Dismiss notification"
            className={styles['notification-dismiss']}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="currentColor"
                d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z"
              />
            </svg>
          </Button>
        )}
      </div>
    </div>
  );
});

Notification.displayName = 'Notification';

export default Notification;