import React from 'react';
import classNames from 'classnames';
import styles from '../../styles/components.css';

// Button Props Interface with comprehensive type definitions
interface ButtonProps {
  /** The content to be rendered inside the button */
  children: React.ReactNode;
  /** Button visual style variant */
  variant?: 'primary' | 'secondary' | 'text';
  /** Button size with minimum touch target considerations */
  size?: 'small' | 'medium' | 'large';
  /** Whether the button should take full width of container */
  fullWidth?: boolean;
  /** Disabled state of the button */
  disabled?: boolean;
  /** Loading state of the button */
  loading?: boolean;
  /** Optional icon to show before button content */
  startIcon?: React.ReactNode;
  /** Optional icon to show after button content */
  endIcon?: React.ReactNode;
  /** Click handler function */
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  /** Button type attribute */
  type?: 'button' | 'submit' | 'reset';
  /** Additional CSS classes */
  className?: string;
  /** Accessible label for screen readers */
  ariaLabel?: string;
  /** Theme variant */
  theme?: 'light' | 'dark';
  /** Theme transition duration in milliseconds */
  transitionDuration?: number;
  /** Enforce minimum touch target size */
  minTouchTarget?: boolean;
}

/**
 * Enhanced class name generator with theme and accessibility support
 */
const getButtonClasses = (
  variant: string = 'primary',
  size: string = 'medium',
  fullWidth: boolean = false,
  disabled: boolean = false,
  className?: string,
  theme: string = 'light',
  minTouchTarget: boolean = true
): string => {
  return classNames(
    styles.btn,
    styles[`btn-${variant}`],
    {
      [styles['btn-full-width']]: fullWidth,
      [styles['btn-disabled']]: disabled,
      [styles['btn-min-touch']]: minTouchTarget,
      [styles[`btn-${size}`]]: size,
      [styles[`theme-${theme}`]]: theme,
    },
    className
  );
};

/**
 * Button Component
 * 
 * An accessible, themeable button component following Material Design 3.0 principles.
 * Features enhanced touch targets, keyboard navigation, and ARIA support.
 */
export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'medium',
  fullWidth = false,
  disabled = false,
  loading = false,
  startIcon,
  endIcon,
  onClick,
  type = 'button',
  className,
  ariaLabel,
  theme = 'light',
  transitionDuration = 200,
  minTouchTarget = true,
}) => {
  // Generate combined class names
  const buttonClasses = getButtonClasses(
    variant,
    size,
    fullWidth,
    disabled,
    className,
    theme,
    minTouchTarget
  );

  // Handle button click with loading state
  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (!disabled && !loading && onClick) {
      onClick(event);
    }
  };

  return (
    <button
      type={type}
      className={buttonClasses}
      onClick={handleClick}
      disabled={disabled || loading}
      aria-disabled={disabled || loading}
      aria-label={ariaLabel}
      aria-busy={loading}
      role="button"
      data-theme={theme}
      style={{ 
        transition: `all ${transitionDuration}ms var(--transition-easing-standard)`,
        minHeight: minTouchTarget ? '44px' : undefined,
        minWidth: minTouchTarget ? '44px' : undefined,
      }}
    >
      {/* Loading Spinner */}
      {loading && (
        <span className={styles.rotate} aria-hidden="true">
          {/* Material Design loading spinner */}
          <svg viewBox="0 0 24 24" width="18" height="18">
            <circle
              cx="12"
              cy="12"
              r="10"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeDasharray="32"
              strokeLinecap="round"
            />
          </svg>
        </span>
      )}

      {/* Button Content */}
      <span className={styles['btn-content']}>
        {startIcon && (
          <span className={styles['btn-icon-start']} aria-hidden="true">
            {startIcon}
          </span>
        )}
        <span className={styles['btn-text']}>{children}</span>
        {endIcon && (
          <span className={styles['btn-icon-end']} aria-hidden="true">
            {endIcon}
          </span>
        )}
      </span>
    </button>
  );
};

export default Button;