import React, { useEffect, useState } from 'react';
import { rotate } from '../../styles/animations.css';
import '../../styles/components.css';

// Size configuration with touch-friendly dimensions
const SPINNER_SIZES = {
  small: '24px',
  medium: '40px', // Default size meeting minimum touch target
  large: '56px'
} as const;

interface LoadingProps {
  /**
   * Size variant of the loading spinner
   * @default 'medium'
   */
  size?: keyof typeof SPINNER_SIZES;
  /**
   * Custom color for the spinner. Uses theme primary color if not specified
   */
  color?: string;
  /**
   * Optional text to display below the spinner
   */
  text?: string;
  /**
   * Whether to display the loading spinner in fullscreen mode
   * @default false
   */
  fullScreen?: boolean;
  /**
   * Additional CSS classes to apply
   */
  className?: string;
  /**
   * Whether to use reduced motion animations
   * @default false
   */
  reducedMotion?: boolean;
  /**
   * Custom ARIA label for accessibility
   * @default 'Loading'
   */
  ariaLabel?: string;
}

/**
 * A reusable loading component that provides visual feedback during asynchronous operations.
 * Implements Material Design 3.0 principles and comprehensive accessibility features.
 */
const Loading: React.FC<LoadingProps> = ({
  size = 'medium',
  color,
  text,
  fullScreen = false,
  className = '',
  reducedMotion = false,
  ariaLabel = 'Loading'
}) => {
  // Track reduced motion preference
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(reducedMotion);

  // Monitor system motion preference changes
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches || reducedMotion);

    const handleChange = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches || reducedMotion);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [reducedMotion]);

  // Get spinner size based on prop
  const getSpinnerSize = (): string => {
    return SPINNER_SIZES[size] || SPINNER_SIZES.medium;
  };

  // Generate spinner styles
  const spinnerStyle: React.CSSProperties = {
    width: getSpinnerSize(),
    height: getSpinnerSize(),
    borderWidth: size === 'small' ? '2px' : '3px',
    borderStyle: 'solid',
    borderColor: `${color || 'var(--color-primary)'} transparent transparent transparent`,
    borderRadius: '50%',
    animation: prefersReducedMotion ? 'none' : undefined,
    opacity: prefersReducedMotion ? 0.6 : 1,
  };

  // Generate container styles
  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 'var(--spacing-sm)',
    ...(fullScreen && {
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'var(--color-overlay)',
      zIndex: 'var(--z-index-modal)',
    }),
  };

  // Generate text styles
  const textStyle: React.CSSProperties = {
    color: 'var(--color-text-primary)',
    fontSize: 'var(--font-size-sm)',
    marginTop: 'var(--spacing-xs)',
    textAlign: 'center',
  };

  return (
    <div
      style={containerStyle}
      className={`loading ${className}`}
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={ariaLabel}
    >
      <div 
        className={prefersReducedMotion ? '' : rotate}
        style={spinnerStyle}
        aria-hidden="true"
      />
      {text && (
        <span style={textStyle}>
          {text}
        </span>
      )}
      <span className="sr-only">
        {ariaLabel}
      </span>
    </div>
  );
};

export default Loading;