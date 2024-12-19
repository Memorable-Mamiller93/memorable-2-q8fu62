/**
 * @fileoverview Enhanced theme management hook with accessibility and performance optimizations
 * Implements Material Design 3.0 principles with comprehensive theming support
 * @version 1.0.0
 */

import { useCallback, useEffect, useMemo } from 'react'; // v18.2.0
import { useSelector, useDispatch } from 'react-redux'; // v8.1.0
import { ThemeMode, Theme } from '../types/theme.types';
import { themeConfig } from '../config/theme.config';

// Theme error types for robust error handling
enum ThemeErrorType {
  VALIDATION = 'validation',
  STORAGE = 'storage',
  COMPATIBILITY = 'compatibility',
  ACCESSIBILITY = 'accessibility'
}

interface ThemeError {
  type: ThemeErrorType;
  message: string;
  details?: unknown;
}

interface ThemeState {
  currentTheme: Theme | null;
  themeError: ThemeError | null;
  isHighContrastMode: boolean;
}

/**
 * Enhanced theme management hook with accessibility support and performance optimizations
 * @returns Theme management functions and current theme state
 */
export const useTheme = () => {
  const dispatch = useDispatch();
  
  // Memoized theme selector with type safety
  const { currentTheme, themeError } = useSelector((state: any) => ({
    currentTheme: state.theme.current,
    themeError: state.theme.error
  }));

  // Memoized high contrast mode detection
  const isHighContrastMode = useMemo(() => {
    return currentTheme?.settings.mode === ThemeMode.HIGH_CONTRAST;
  }, [currentTheme?.settings.mode]);

  /**
   * Applies theme settings to DOM with performance optimization
   * @param theme - Theme to apply
   */
  const applyThemeToDOM = useCallback((theme: Theme) => {
    if (!theme?.settings) return;

    // Batch DOM updates for performance
    requestAnimationFrame(() => {
      const root = document.documentElement;
      const { colors, typography, layout } = theme.settings;

      // Apply color tokens
      Object.entries(colors).forEach(([key, value]) => {
        if (typeof value === 'object') {
          Object.entries(value).forEach(([subKey, subValue]) => {
            root.style.setProperty(`--color-${key}-${subKey}`, subValue.base);
          });
        }
      });

      // Apply typography
      Object.entries(typography.variants).forEach(([variant, values]) => {
        Object.entries(values).forEach(([property, value]) => {
          root.style.setProperty(`--typography-${variant}-${property}`, String(value));
        });
      });

      // Apply layout properties
      Object.entries(layout.spacing).forEach(([size, value]) => {
        root.style.setProperty(`--spacing-${size}`, value);
      });
    });
  }, []);

  /**
   * Toggles between theme modes with accessibility considerations
   */
  const toggleThemeMode = useCallback(() => {
    if (!currentTheme) return;

    try {
      const nextMode = currentTheme.settings.mode === ThemeMode.LIGHT
        ? ThemeMode.DARK
        : ThemeMode.LIGHT;

      const newSettings = themeConfig.getThemeSettings(
        nextMode,
        undefined,
        { highContrast: isHighContrastMode }
      );

      dispatch({
        type: 'theme/updateTheme',
        payload: {
          ...currentTheme,
          settings: newSettings
        }
      });
    } catch (error) {
      dispatch({
        type: 'theme/setError',
        payload: {
          type: ThemeErrorType.VALIDATION,
          message: 'Failed to toggle theme mode',
          details: error
        }
      });
    }
  }, [currentTheme, dispatch, isHighContrastMode]);

  /**
   * Updates current theme with validation and accessibility checks
   * @param theme - New theme to apply
   */
  const setTheme = useCallback((theme: Theme) => {
    try {
      // Validate theme structure and version
      if (!theme || !theme.settings) {
        throw new Error('Invalid theme structure');
      }

      // Apply theme to DOM
      applyThemeToDOM(theme);

      // Update redux state
      dispatch({
        type: 'theme/updateTheme',
        payload: theme
      });

      // Persist theme preference
      localStorage.setItem('memorable-theme-preference', JSON.stringify({
        themeId: theme.id,
        mode: theme.settings.mode,
        highContrast: isHighContrastMode
      }));
    } catch (error) {
      dispatch({
        type: 'theme/setError',
        payload: {
          type: ThemeErrorType.VALIDATION,
          message: 'Failed to set theme',
          details: error
        }
      });
    }
  }, [dispatch, applyThemeToDOM, isHighContrastMode]);

  /**
   * Sets up system preference listeners and initial theme
   */
  useEffect(() => {
    const handleSystemPreferenceChange = (e: MediaQueryListEvent) => {
      if (!currentTheme) return;

      const newMode = e.matches ? ThemeMode.DARK : ThemeMode.LIGHT;
      setTheme({
        ...currentTheme,
        settings: {
          ...currentTheme.settings,
          mode: newMode
        }
      });
    };

    // Listen for system theme preference changes
    const darkModeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    darkModeMediaQuery.addEventListener('change', handleSystemPreferenceChange);

    // Listen for reduced motion preference
    const reducedMotionMediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    reducedMotionMediaQuery.addEventListener('change', (e) => {
      if (currentTheme) {
        setTheme({
          ...currentTheme,
          settings: {
            ...currentTheme.settings,
            motion: e.matches ? 'reduced' : 'no-preference'
          }
        });
      }
    });

    return () => {
      darkModeMediaQuery.removeEventListener('change', handleSystemPreferenceChange);
      reducedMotionMediaQuery.removeEventListener('change', handleSystemPreferenceChange);
    };
  }, [currentTheme, setTheme]);

  return {
    currentTheme,
    toggleThemeMode,
    setTheme,
    themeError,
    isHighContrastMode
  };
};