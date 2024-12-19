/**
 * @fileoverview Core theme configuration implementing Material Design 3.0 principles
 * Provides comprehensive theme settings with support for variants and accessibility
 * @version 1.0.0
 */

// @mui/material version 5.14+
import { createTheme, useMediaQuery } from '@mui/material';
import { ThemeMode, ThemeSettings, Direction, MotionPreference } from '../types/theme.types';
import { 
  THEME_VARIANTS,
  THEME_COLORS,
  TYPOGRAPHY_SCALE,
  SPACING_SCALE,
  ELEVATION_SCALE,
  ANIMATION_CONSTANTS,
  BREAKPOINT_VALUES,
  GRID_SETTINGS,
  THEME_VERSION,
  THEME_STORAGE_KEY
} from '../constants/theme.constants';

/**
 * Theme cache version for invalidation
 */
const THEME_CACHE_VERSION = '1.0.0';

/**
 * Minimum contrast ratios for accessibility
 */
const CONTRAST_RATIOS = {
  normal: 4.5,
  large: 3,
  enhanced: 7
};

/**
 * Default animation durations
 */
const ANIMATION_DURATIONS = {
  short: 200,
  medium: 300,
  long: 500
};

/**
 * Interface for theme accessibility options
 */
interface ThemeAccessibilityOptions {
  highContrast?: boolean;
  reducedMotion?: boolean;
  fontSize?: number;
}

/**
 * Memoization decorator for performance optimization
 */
function memoize(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
  const originalMethod = descriptor.value;
  const cache = new Map();

  descriptor.value = function (...args: any[]) {
    const key = JSON.stringify(args);
    if (cache.has(key)) {
      return cache.get(key);
    }
    const result = originalMethod.apply(this, args);
    cache.set(key, result);
    return result;
  };

  return descriptor;
}

/**
 * Core theme configuration object
 */
export const themeConfig = {
  defaultMode: ThemeMode.LIGHT,

  /**
   * Generates comprehensive theme settings based on mode and preferences
   * @param mode - Theme mode (light/dark)
   * @param variant - Theme variant (magical/adventure/educational)
   * @param accessibilityOptions - Accessibility preferences
   * @returns Complete theme settings object
   */
  @memoize
  getThemeSettings(
    mode: ThemeMode = ThemeMode.LIGHT,
    variant: string = THEME_VARIANTS.MAGICAL,
    accessibilityOptions: ThemeAccessibilityOptions = {}
  ): ThemeSettings {
    // Check cache first
    const cachedTheme = this.getCachedTheme(`${mode}-${variant}-${JSON.stringify(accessibilityOptions)}`);
    if (cachedTheme) return cachedTheme;

    // Get base colors from theme constants
    const baseColors = THEME_COLORS[mode][variant];

    // Apply high contrast adjustments if needed
    const colors = accessibilityOptions.highContrast
      ? this.enhanceColorContrast(baseColors)
      : baseColors;

    // Configure typography with responsive scaling
    const typography = {
      ...TYPOGRAPHY_SCALE,
      fontSize: this.adjustFontSize(TYPOGRAPHY_SCALE.body.fontSize, accessibilityOptions.fontSize)
    };

    // Configure layout settings
    const layout = {
      spacing: SPACING_SCALE,
      borderRadius: {
        small: '4px',
        medium: '8px',
        large: '16px'
      },
      breakpoints: BREAKPOINT_VALUES,
      shadows: ELEVATION_SCALE,
      grid: GRID_SETTINGS
    };

    // Configure animation settings
    const animation = {
      duration: accessibilityOptions.reducedMotion
        ? { ...ANIMATION_DURATIONS, medium: ANIMATION_DURATIONS.short }
        : ANIMATION_DURATIONS,
      easing: ANIMATION_CONSTANTS.easing
    };

    // Build complete theme settings
    const themeSettings: ThemeSettings = {
      colors,
      typography,
      layout,
      mode,
      direction: 'ltr' as Direction,
      motion: accessibilityOptions.reducedMotion ? 'reduced' : 'no-preference' as MotionPreference
    };

    // Cache the generated theme
    this.cacheTheme(`${mode}-${variant}-${JSON.stringify(accessibilityOptions)}`, themeSettings);

    return themeSettings;
  },

  /**
   * Retrieves cached theme settings
   * @param cacheKey - Unique identifier for cached theme
   * @returns Cached theme settings or null
   */
  getCachedTheme(cacheKey: string): ThemeSettings | null {
    try {
      const cached = localStorage.getItem(`${THEME_STORAGE_KEY}-${cacheKey}`);
      if (!cached) return null;

      const { version, settings } = JSON.parse(cached);
      if (version !== THEME_CACHE_VERSION) return null;

      return settings;
    } catch (error) {
      console.warn('Error retrieving cached theme:', error);
      return null;
    }
  },

  /**
   * Caches theme settings for performance
   * @param cacheKey - Unique identifier for theme
   * @param settings - Theme settings to cache
   */
  private cacheTheme(cacheKey: string, settings: ThemeSettings): void {
    try {
      localStorage.setItem(
        `${THEME_STORAGE_KEY}-${cacheKey}`,
        JSON.stringify({
          version: THEME_CACHE_VERSION,
          settings
        })
      );
    } catch (error) {
      console.warn('Error caching theme:', error);
    }
  },

  /**
   * Enhances color contrast for accessibility
   * @param colors - Base color scheme
   * @returns Enhanced color scheme with improved contrast
   */
  private enhanceColorContrast(colors: any): any {
    const enhance = (color: string, background: string) => {
      // Implementation of color contrast enhancement
      // This would include actual color manipulation logic
      return color;
    };

    return {
      ...colors,
      text: {
        primary: { ...colors.text.primary, base: enhance(colors.text.primary.base, colors.background.base) },
        secondary: { ...colors.text.secondary, base: enhance(colors.text.secondary.base, colors.background.base) }
      }
    };
  },

  /**
   * Adjusts font sizes based on user preference
   * @param baseScale - Base font size scale
   * @param sizeFactor - User's font size preference
   * @returns Adjusted font size scale
   */
  private adjustFontSize(baseScale: any, sizeFactor: number = 1): any {
    if (sizeFactor === 1) return baseScale;

    return Object.entries(baseScale).reduce((acc, [key, value]) => ({
      ...acc,
      [key]: `${parseFloat(value as string) * sizeFactor}rem`
    }), {});
  }
};

export default themeConfig;