import React, { useEffect, useCallback, useRef } from 'react';
import classNames from 'classnames';
import FocusTrap from 'focus-trap-react';
import Button from './Button';
import styles from '../../styles/components.css';

// Version comments for third-party dependencies
// react: ^18.2.0
// classnames: ^2.3.2
// focus-trap-react: ^10.0.0

interface DialogProps {
  /** Controls dialog visibility */
  isOpen: boolean;
  /** Callback when dialog should close */
  onClose: () => void;
  /** Dialog title text */
  title: string;
  /** Dialog content */
  children: React.ReactNode;
  /** Dialog size variant */
  size?: 'small' | 'medium' | 'large';
  /** Enable/disable backdrop click to close */
  closeOnBackdrop?: boolean;
  /** Enable/disable escape key to close */
  closeOnEscape?: boolean;
  /** Show/hide close button */
  showCloseButton?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Footer action buttons */
  actions?: React.ReactNode;
  /** Animation duration in milliseconds */
  animationDuration?: number;
  /** Animation type */
  animationType?: 'fade' | 'slide' | 'scale';
  /** Enable/disable theme awareness */
  themeAware?: boolean;
  /** Prevent body scroll when open */
  preventScroll?: boolean;
  /** ARIA describedby ID */
  ariaDescribedBy?: string;
  /** ARIA labelledby ID */
  ariaLabelledBy?: string;
  /** RTL support */
  rtl?: boolean;
}

/**
 * Enhanced Dialog Component
 * 
 * A reusable, accessible modal dialog component that follows Material Design 3.0 principles.
 * Features animations, keyboard navigation, focus management, and theme support.
 */
export const Dialog: React.FC<DialogProps> = ({
  isOpen,
  onClose,
  title,
  children,
  size = 'medium',
  closeOnBackdrop = true,
  closeOnEscape = true,
  showCloseButton = true,
  className,
  actions,
  animationDuration = 300,
  animationType = 'fade',
  themeAware = true,
  preventScroll = true,
  ariaDescribedBy,
  ariaLabelledBy,
  rtl = false,
}) => {
  // Refs for animation and cleanup
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  // Handle body scroll lock
  useEffect(() => {
    if (preventScroll && isOpen) {
      const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
      document.body.style.overflow = 'hidden';
      document.body.style.paddingRight = `${scrollbarWidth}px`;

      return () => {
        document.body.style.overflow = '';
        document.body.style.paddingRight = '';
      };
    }
  }, [isOpen, preventScroll]);

  // Store previously focused element
  useEffect(() => {
    if (isOpen) {
      previousActiveElement.current = document.activeElement as HTMLElement;
    } else if (previousActiveElement.current) {
      previousActiveElement.current.focus();
    }
  }, [isOpen]);

  // Handle escape key press
  const handleEscapeKey = useCallback((event: KeyboardEvent) => {
    if (closeOnEscape && event.key === 'Escape') {
      onClose();
    }
  }, [closeOnEscape, onClose]);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleEscapeKey);
      return () => document.removeEventListener('keydown', handleEscapeKey);
    }
  }, [isOpen, handleEscapeKey]);

  // Handle backdrop click
  const handleBackdropClick = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (closeOnBackdrop && event.target === event.currentTarget) {
      onClose();
    }
  }, [closeOnBackdrop, onClose]);

  // Generate dialog classes
  const dialogClasses = classNames(
    styles.modal,
    styles[`modal-${size}`],
    styles[`animation-${animationType}`],
    {
      [styles['theme-aware']]: themeAware,
      [styles.rtl]: rtl,
    },
    className
  );

  if (!isOpen) return null;

  return (
    <FocusTrap
      active={isOpen}
      focusTrapOptions={{
        initialFocus: false,
        escapeDeactivates: closeOnEscape,
        allowOutsideClick: true,
      }}
    >
      <div
        className={styles['modal-overlay']}
        onClick={handleBackdropClick}
        role="presentation"
        style={{
          animation: `${styles.fadeIn} ${animationDuration}ms var(--transition-easing-standard)`,
        }}
      >
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={ariaLabelledBy || 'dialog-title'}
          aria-describedby={ariaDescribedBy}
          className={dialogClasses}
          style={{
            animation: `${styles[animationType]} ${animationDuration}ms var(--transition-easing-standard)`,
            direction: rtl ? 'rtl' : 'ltr',
          }}
        >
          <header className={styles['modal-header']}>
            <h2 
              id="dialog-title"
              className={styles['modal-title']}
            >
              {title}
            </h2>
            {showCloseButton && (
              <Button
                variant="text"
                onClick={onClose}
                ariaLabel="Close dialog"
                className={styles['modal-close']}
                size="small"
              >
                <span aria-hidden="true">&times;</span>
              </Button>
            )}
          </header>

          <div className={styles['modal-content']}>
            {children}
          </div>

          {actions && (
            <footer className={styles['modal-footer']}>
              {actions}
            </footer>
          )}
        </div>
      </div>
    </FocusTrap>
  );
};

export default Dialog;