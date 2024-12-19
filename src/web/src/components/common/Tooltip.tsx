import React, { useState, useRef, useEffect, useCallback, memo } from 'react';
import { createPortal } from 'react-dom';
import styles from '../../styles/components.css';
import animations from '../../styles/animations.css';

// Types
export type TooltipPosition = 'top' | 'right' | 'bottom' | 'left';
export type ThemeMode = 'light' | 'dark' | 'system';
export type TouchBehavior = 'press' | 'longPress' | 'tap';

export interface TooltipProps {
  /** The content to display in the tooltip */
  content: string;
  /** The element that triggers the tooltip */
  children: React.ReactNode;
  /** The preferred position of the tooltip */
  position?: TooltipPosition;
  /** Delay before showing tooltip (ms) */
  delay?: number;
  /** Whether the tooltip is disabled */
  disabled?: boolean;
  /** Theme mode for the tooltip */
  theme?: ThemeMode;
  /** Whether the tooltip is interactive */
  interactive?: boolean;
  /** Touch device behavior */
  touchBehavior?: TouchBehavior;
}

/**
 * A reusable tooltip component that provides contextual information with enhanced accessibility.
 * Implements Material Design 3.0 principles and supports theme customization.
 *
 * @version 1.0.0
 */
export const Tooltip = memo(({
  content,
  children,
  position = 'top',
  delay = 200,
  disabled = false,
  theme = 'system',
  interactive = false,
  touchBehavior = 'press'
}: TooltipProps) => {
  // State and refs
  const [isVisible, setIsVisible] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const targetRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<number>();
  const touchStartRef = useRef<number>();

  // Intersection observer for viewport detection
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0].isIntersecting && isVisible) {
          setIsVisible(false);
        }
      },
      { threshold: 0.1 }
    );

    if (targetRef.current) {
      observer.observe(targetRef.current);
    }

    return () => observer.disconnect();
  }, [isVisible]);

  // Calculate tooltip position
  const calculatePosition = useCallback(() => {
    if (!targetRef.current || !tooltipRef.current) return;

    const targetRect = targetRef.current.getBoundingClientRect();
    const tooltipRect = tooltipRef.current.getBoundingClientRect();
    const spacing = 8; // Gap between tooltip and target

    let top = 0;
    let left = 0;

    switch (position) {
      case 'top':
        top = targetRect.top - tooltipRect.height - spacing;
        left = targetRect.left + (targetRect.width - tooltipRect.width) / 2;
        break;
      case 'bottom':
        top = targetRect.bottom + spacing;
        left = targetRect.left + (targetRect.width - tooltipRect.width) / 2;
        break;
      case 'left':
        top = targetRect.top + (targetRect.height - tooltipRect.height) / 2;
        left = targetRect.left - tooltipRect.width - spacing;
        break;
      case 'right':
        top = targetRect.top + (targetRect.height - tooltipRect.height) / 2;
        left = targetRect.right + spacing;
        break;
    }

    // Viewport boundary checks
    const viewport = {
      width: window.innerWidth,
      height: window.innerHeight
    };

    // Adjust horizontal position
    if (left < 0) left = spacing;
    if (left + tooltipRect.width > viewport.width) {
      left = viewport.width - tooltipRect.width - spacing;
    }

    // Adjust vertical position
    if (top < 0) top = spacing;
    if (top + tooltipRect.height > viewport.height) {
      top = viewport.height - tooltipRect.height - spacing;
    }

    setCoords({ top, left });
  }, [position]);

  // Show tooltip handler
  const showTooltip = useCallback(() => {
    if (disabled) return;
    
    window.clearTimeout(timeoutRef.current);
    timeoutRef.current = window.setTimeout(() => {
      setIsVisible(true);
      calculatePosition();
    }, delay);
  }, [disabled, delay, calculatePosition]);

  // Hide tooltip handler
  const hideTooltip = useCallback(() => {
    window.clearTimeout(timeoutRef.current);
    setIsVisible(false);
  }, []);

  // Touch event handlers
  const handleTouchStart = useCallback(() => {
    if (disabled || touchBehavior !== 'longPress') return;
    touchStartRef.current = Date.now();
  }, [disabled, touchBehavior]);

  const handleTouchEnd = useCallback(() => {
    if (disabled || !touchStartRef.current) return;

    const touchDuration = Date.now() - touchStartRef.current;
    
    switch (touchBehavior) {
      case 'press':
        showTooltip();
        break;
      case 'longPress':
        if (touchDuration > 500) showTooltip();
        break;
      case 'tap':
        if (touchDuration < 500) showTooltip();
        break;
    }
    
    touchStartRef.current = undefined;
  }, [disabled, touchBehavior, showTooltip]);

  // Update position on window resize
  useEffect(() => {
    if (!isVisible) return;

    const handleResize = () => {
      calculatePosition();
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isVisible, calculatePosition]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      window.clearTimeout(timeoutRef.current);
    };
  }, []);

  // Theme-aware class names
  const tooltipClassName = `
    ${styles.tooltip}
    ${isVisible ? styles['tooltip--visible'] : ''}
    ${styles[`tooltip--theme-${theme}`]}
    ${animations['fade-in']}
  `.trim();

  return (
    <div
      ref={targetRef}
      className={styles.tooltip}
      onMouseEnter={showTooltip}
      onMouseLeave={hideTooltip}
      onFocus={showTooltip}
      onBlur={hideTooltip}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      aria-describedby={isVisible ? 'tooltip' : undefined}
    >
      {children}
      {isVisible && createPortal(
        <div
          ref={tooltipRef}
          id="tooltip"
          role="tooltip"
          className={tooltipClassName}
          style={{
            position: 'fixed',
            top: `${coords.top}px`,
            left: `${coords.left}px`,
            zIndex: 'var(--z-index-tooltip)'
          }}
          aria-hidden={!isVisible}
        >
          {content}
        </div>,
        document.body
      )}
    </div>
  );
});

Tooltip.displayName = 'Tooltip';

export default Tooltip;