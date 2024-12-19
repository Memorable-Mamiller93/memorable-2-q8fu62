import React, { useEffect, useCallback, useRef } from 'react';
import classNames from 'classnames';
import { card, cardElevated, cardInteractive, cardTouchFeedback } from '../../styles/components.css';

/**
 * Interface for Card component props with comprehensive accessibility support
 */
interface CardProps {
  /** Content to be rendered inside the card */
  children: React.ReactNode;
  /** Visual style variant of the card */
  variant?: 'default' | 'elevated' | 'outlined';
  /** Elevation level affecting shadow depth */
  elevation?: 'low' | 'medium' | 'high';
  /** Whether the card is interactive (clickable/focusable) */
  interactive?: boolean;
  /** Click handler for interactive cards */
  onClick?: (event: React.MouseEvent<HTMLDivElement>) => void;
  /** Keyboard event handler for accessibility */
  onKeyDown?: (event: React.KeyboardEvent<HTMLDivElement>) => void;
  /** Additional CSS classes */
  className?: string;
  /** Accessible label for screen readers */
  ariaLabel?: string;
  /** ARIA role for semantic meaning */
  ariaRole?: string;
  /** ARIA live region setting */
  ariaLive?: 'polite' | 'assertive' | 'off';
  /** Whether the card can receive focus */
  focusable?: boolean;
  /** Whether to respect reduced motion preferences */
  reduceMotion?: boolean;
}

/**
 * Generates class names for the card component based on props and state
 */
const getCardClasses = (
  variant: string,
  elevation: string,
  interactive: boolean,
  className?: string,
  reduceMotion?: boolean
): string => {
  return classNames(
    card,
    {
      [cardElevated]: variant === 'elevated',
      [`card-elevation-${elevation}`]: elevation,
      [cardInteractive]: interactive,
      [cardTouchFeedback]: interactive && !reduceMotion,
      'reduce-motion': reduceMotion,
      'card-outlined': variant === 'outlined',
      'card-rtl': document.dir === 'rtl'
    },
    className
  );
};

/**
 * Card component implementing Material Design 3.0 principles with comprehensive accessibility
 */
export const Card: React.FC<CardProps> = ({
  children,
  variant = 'default',
  elevation = 'medium',
  interactive = false,
  onClick,
  onKeyDown,
  className,
  ariaLabel,
  ariaRole = 'region',
  ariaLive = 'off',
  focusable = true,
  reduceMotion = false,
}) => {
  const cardRef = useRef<HTMLDivElement>(null);

  // Handle keyboard navigation for accessibility
  const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    if (interactive && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      onClick?.(event as unknown as React.MouseEvent<HTMLDivElement>);
    }
    onKeyDown?.(event);
  }, [interactive, onClick, onKeyDown]);

  // Clean up event listeners on unmount
  useEffect(() => {
    const currentRef = cardRef.current;
    return () => {
      if (currentRef) {
        currentRef.removeEventListener('keydown', handleKeyDown as unknown as EventListener);
      }
    };
  }, [handleKeyDown]);

  // Handle touch feedback for mobile devices
  const handleTouchStart = useCallback(() => {
    if (interactive && !reduceMotion) {
      cardRef.current?.classList.add('touch-active');
    }
  }, [interactive, reduceMotion]);

  const handleTouchEnd = useCallback(() => {
    if (interactive && !reduceMotion) {
      cardRef.current?.classList.remove('touch-active');
    }
  }, [interactive, reduceMotion]);

  return (
    <div
      ref={cardRef}
      className={getCardClasses(variant, elevation, interactive, className, reduceMotion)}
      onClick={interactive ? onClick : undefined}
      onKeyDown={handleKeyDown}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      role={ariaRole}
      aria-label={ariaLabel}
      aria-live={ariaLive}
      tabIndex={interactive && focusable ? 0 : undefined}
      data-testid="card"
    >
      {children}
    </div>
  );
};

export default Card;