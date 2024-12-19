import React, { useEffect, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom';
import classNames from 'classnames';
import { Button } from './Button';
import styles from '../../styles/components.css';
import theme from '../../styles/theme.css';
import animations from '../../styles/animations.css';

// Modal Props Interface
interface ModalProps {
  /** Controls modal visibility */
  isOpen: boolean;
  /** Callback when modal should close */
  onClose: () => void;
  /** Modal content */
  children: React.ReactNode;
  /** Modal title for accessibility */
  title: string;
  /** Modal size variant */
  size?: 'small' | 'medium' | 'large';
  /** Theme variant */
  theme?: 'light' | 'dark' | 'system';
  /** Animation type */
  animation?: 'fade' | 'slide' | 'scale' | 'none';
  /** Show close button */
  showCloseButton?: boolean;
  /** Close on overlay click */
  closeOnOverlayClick?: boolean;
  /** Close on Escape key */
  closeOnEscape?: boolean;
  /** Prevent body scroll when open */
  preventScroll?: boolean;
  /** Overlay opacity (0-1) */
  overlayOpacity?: number;
  /** Additional modal class */
  className?: string;
  /** Additional content class */
  contentClassName?: string;
  /** Accessibility label */
  ariaLabel?: string;
  /** Accessibility description ID */
  ariaDescribedBy?: string;
  /** Initial focus element ref */
  initialFocus?: React.RefObject<HTMLElement>;
  /** Animation complete callback */
  onAnimationComplete?: () => void;
  /** Test ID for testing */
  testId?: string;
}

// Focus trap hook
const useFocusTrap = (
  isOpen: boolean,
  modalRef: React.RefObject<HTMLElement>,
  initialFocus?: React.RefObject<HTMLElement>
) => {
  const previousActiveElement = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      // Store current active element
      previousActiveElement.current = document.activeElement as HTMLElement;

      // Set initial focus
      if (initialFocus?.current) {
        initialFocus.current.focus();
      } else if (modalRef.current) {
        const firstFocusable = modalRef.current.querySelector<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        firstFocusable?.focus();
      }
    } else if (previousActiveElement.current) {
      // Restore focus on close
      previousActiveElement.current.focus();
    }
  }, [isOpen, initialFocus]);

  // Handle tab key navigation
  const handleTab = useCallback((e: KeyboardEvent) => {
    if (!modalRef.current || !isOpen) return;

    const focusableElements = modalRef.current.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const firstFocusable = focusableElements[0];
    const lastFocusable = focusableElements[focusableElements.length - 1];

    if (e.shiftKey) {
      if (document.activeElement === firstFocusable) {
        lastFocusable.focus();
        e.preventDefault();
      }
    } else {
      if (document.activeElement === lastFocusable) {
        firstFocusable.focus();
        e.preventDefault();
      }
    }
  }, [isOpen]);

  useEffect(() => {
    document.addEventListener('keydown', handleTab);
    return () => document.removeEventListener('keydown', handleTab);
  }, [handleTab]);
};

// Scroll lock hook
const useScrollLock = (isOpen: boolean, preventScroll: boolean) => {
  useEffect(() => {
    if (!preventScroll) return;

    const originalStyle = window.getComputedStyle(document.body).overflow;
    
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.body.style.overflow = originalStyle;
    };
  }, [isOpen, preventScroll]);
};

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  children,
  title,
  size = 'medium',
  theme = 'system',
  animation = 'fade',
  showCloseButton = true,
  closeOnOverlayClick = true,
  closeOnEscape = true,
  preventScroll = true,
  overlayOpacity = 0.5,
  className,
  contentClassName,
  ariaLabel,
  ariaDescribedBy,
  initialFocus,
  onAnimationComplete,
  testId,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);

  // Use custom hooks
  useFocusTrap(isOpen, modalRef, initialFocus);
  useScrollLock(isOpen, preventScroll);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (closeOnEscape && e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
    }

    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, closeOnEscape, onClose]);

  // Handle overlay click
  const handleOverlayClick = (e: React.MouseEvent) => {
    if (closeOnOverlayClick && e.target === e.currentTarget) {
      onClose();
    }
  };

  // Generate class names
  const modalClasses = classNames(
    styles.modal,
    theme && theme[`theme-${theme}`],
    animation && animations[`animation-${animation}`],
    styles[`modal-${size}`],
    className
  );

  const contentClasses = classNames(
    styles['modal-content'],
    contentClassName
  );

  if (!isOpen) return null;

  // Portal render
  return ReactDOM.createPortal(
    <div
      className={styles['modal-overlay']}
      onClick={handleOverlayClick}
      style={{ backgroundColor: `rgba(0, 0, 0, ${overlayOpacity})` }}
      data-testid={`${testId}-overlay`}
      aria-hidden="true"
    >
      <div
        ref={modalRef}
        className={modalClasses}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        aria-describedby={ariaDescribedBy}
        aria-label={ariaLabel}
        data-theme={theme}
        data-testid={testId}
        onAnimationEnd={onAnimationComplete}
      >
        <header className={styles['modal-header']}>
          <h2 id="modal-title" className={styles['modal-title']}>
            {title}
          </h2>
          {showCloseButton && (
            <Button
              variant="text"
              onClick={onClose}
              ariaLabel="Close modal"
              className={styles['modal-close']}
              theme={theme === 'system' ? 'light' : theme}
            >
              <span aria-hidden="true">&times;</span>
            </Button>
          )}
        </header>
        <div className={contentClasses}>
          {children}
        </div>
      </div>
    </div>,
    document.getElementById('modal-root') || document.body
  );
};

export default Modal;