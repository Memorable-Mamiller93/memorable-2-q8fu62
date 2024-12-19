/**
 * @fileoverview Enhanced theme selection component with accessibility and performance optimizations
 * Implements Material Design 3.0 principles with comprehensive theming support
 * @version 1.0.0
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import classNames from 'classnames'; // v2.3.2
import { useInView } from 'react-intersection-observer'; // v9.0.0
import { Theme } from '../../types/theme.types';
import { useTheme } from '../../hooks/useTheme';
import { THEME_VARIANTS } from '../../constants/theme.constants';
import styles from './ThemeSelector.module.css';

interface ThemeSelectorProps {
  onThemeSelect: (theme: Theme) => void;
  selectedThemeId: string | null;
  className?: string;
  ariaLabel?: string;
  reduceMotion?: boolean;
  highContrast?: boolean;
  focusable?: boolean;
}

/**
 * Enhanced theme selection component with accessibility and performance optimizations
 */
const ThemeSelector: React.FC<ThemeSelectorProps> = ({
  onThemeSelect,
  selectedThemeId,
  className = '',
  ariaLabel = 'Theme Selection',
  reduceMotion = false,
  highContrast = false,
  focusable = true
}) => {
  const { currentTheme, setTheme, themeError } = useTheme();
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);
  const gridRef = useRef<HTMLDivElement>(null);
  const liveRegionRef = useRef<HTMLDivElement>(null);

  // Intersection observer for lazy loading
  const { ref: observerRef, inView } = useInView({
    threshold: 0.1,
    triggerOnce: true
  });

  // Theme variants for the grid
  const themeVariants = Object.values(THEME_VARIANTS);

  /**
   * Handles theme selection with accessibility announcements
   */
  const handleThemeSelect = useCallback((theme: Theme) => {
    try {
      setTheme(theme);
      onThemeSelect(theme);

      // Announce selection to screen readers
      if (liveRegionRef.current) {
        liveRegionRef.current.textContent = `Selected theme: ${theme.name}`;
      }
    } catch (error) {
      console.error('Theme selection error:', error);
      if (liveRegionRef.current) {
        liveRegionRef.current.textContent = 'Error selecting theme. Please try again.';
      }
    }
  }, [setTheme, onThemeSelect]);

  /**
   * Handles keyboard navigation for accessibility
   */
  const handleKeyboardNavigation = useCallback((event: React.KeyboardEvent) => {
    const { key } = event;
    const maxIndex = themeVariants.length - 1;

    switch (key) {
      case 'ArrowRight':
      case 'ArrowDown':
        event.preventDefault();
        setFocusedIndex(prev => Math.min(prev + 1, maxIndex));
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        event.preventDefault();
        setFocusedIndex(prev => Math.max(prev - 1, 0));
        break;
      case 'Enter':
      case ' ':
        event.preventDefault();
        if (focusedIndex >= 0 && currentTheme) {
          handleThemeSelect(currentTheme);
        }
        break;
      default:
        break;
    }
  }, [focusedIndex, currentTheme, handleThemeSelect]);

  // Focus management
  useEffect(() => {
    if (focusedIndex >= 0 && gridRef.current) {
      const themeCards = gridRef.current.querySelectorAll('[role="radio"]');
      (themeCards[focusedIndex] as HTMLElement)?.focus();
    }
  }, [focusedIndex]);

  return (
    <div
      className={classNames(styles.container, className, {
        [styles.reduceMotion]: reduceMotion,
        [styles.highContrast]: highContrast
      })}
      ref={observerRef}
    >
      <div
        ref={gridRef}
        role="radiogroup"
        aria-label={ariaLabel}
        className={styles.grid}
        onKeyDown={handleKeyboardNavigation}
        tabIndex={focusable ? 0 : -1}
      >
        {themeVariants.map((variant, index) => (
          <div
            key={variant}
            role="radio"
            aria-checked={selectedThemeId === variant}
            tabIndex={focusedIndex === index ? 0 : -1}
            className={classNames(styles.themeCard, {
              [styles.selected]: selectedThemeId === variant,
              [styles.focused]: focusedIndex === index,
              [styles.visible]: inView
            })}
            onClick={() => currentTheme && handleThemeSelect(currentTheme)}
            onFocus={() => setFocusedIndex(index)}
          >
            <div className={styles.preview}>
              {inView && (
                <img
                  src={`/themes/${variant}-preview.jpg`}
                  alt={`${variant} theme preview`}
                  loading="lazy"
                  className={styles.previewImage}
                />
              )}
            </div>
            <div className={styles.info}>
              <h3 className={styles.title}>
                {variant.charAt(0).toUpperCase() + variant.slice(1)}
              </h3>
              <p className={styles.description}>
                {getThemeDescription(variant)}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Error handling */}
      {themeError && (
        <div role="alert" className={styles.error}>
          {themeError.message}
        </div>
      )}

      {/* Live region for screen reader announcements */}
      <div
        ref={liveRegionRef}
        role="status"
        aria-live="polite"
        className={styles.visuallyHidden}
      />
    </div>
  );
};

/**
 * Helper function to get theme descriptions
 */
const getThemeDescription = (variant: string): string => {
  switch (variant) {
    case THEME_VARIANTS.MAGICAL:
      return 'Enchanting and whimsical design for magical stories';
    case THEME_VARIANTS.ADVENTURE:
      return 'Bold and exciting design for adventure tales';
    case THEME_VARIANTS.EDUCATIONAL:
      return 'Clear and engaging design for learning stories';
    default:
      return '';
  }
};

export default ThemeSelector;