/**
 * @fileoverview Theme configuration constants for the Memorable platform
 * Implements Material Design 3.0 principles with comprehensive theming support
 * @version 1.0.0
 */

import { ThemeMode, ThemeColors } from '../types/theme.types';

/**
 * Theme version for tracking updates and compatibility
 */
export const THEME_VERSION = '1.0.0';

/**
 * Local storage keys for theme preferences
 */
export const THEME_STORAGE_KEY = 'memorable-theme-preference';
export const HIGH_CONTRAST_STORAGE_KEY = 'memorable-high-contrast-preference';
export const ANIMATION_REDUCED_STORAGE_KEY = 'memorable-reduced-motion-preference';

/**
 * Available book theme variants
 */
export enum THEME_VARIANTS {
  MAGICAL = 'magical',
  ADVENTURE = 'adventure',
  EDUCATIONAL = 'educational'
}

/**
 * Comprehensive color palettes following Material Design color system
 */
export const THEME_COLORS: Record<ThemeMode, Record<THEME_VARIANTS, ThemeColors>> = {
  [ThemeMode.LIGHT]: {
    [THEME_VARIANTS.MAGICAL]: {
      primary: {
        base: '#6200EE',
        light: '#7F39FB',
        dark: '#4B00B5',
        contrast: '#FFFFFF'
      },
      secondary: {
        base: '#03DAC6',
        light: '#66FFF9',
        dark: '#00A896',
        contrast: '#000000'
      },
      background: {
        base: '#FFFFFF',
        light: '#FAFAFA',
        dark: '#F5F5F5',
        contrast: '#000000'
      },
      surface: {
        default: { base: '#FFFFFF', light: '#FAFAFA', dark: '#F5F5F5' },
        elevated: { base: '#FFFFFF', light: '#FFFFFF', dark: '#F8F8F8' }
      },
      text: {
        primary: { base: '#000000', light: '#1F1F1F', dark: '#000000' },
        secondary: { base: '#666666', light: '#757575', dark: '#424242' }
      },
      accent: {
        base: '#FF4081',
        light: '#FF79B0',
        dark: '#C60055',
        contrast: '#FFFFFF'
      },
      states: {
        hover: { base: 'rgba(0, 0, 0, 0.04)' },
        active: { base: 'rgba(0, 0, 0, 0.12)' },
        disabled: { base: 'rgba(0, 0, 0, 0.38)' },
        focus: { base: 'rgba(0, 0, 0, 0.12)' }
      },
      semantic: {
        success: { base: '#4CAF50', light: '#81C784', dark: '#388E3C' },
        warning: { base: '#FFC107', light: '#FFD54F', dark: '#FFA000' },
        error: { base: '#F44336', light: '#E57373', dark: '#D32F2F' },
        info: { base: '#2196F3', light: '#64B5F6', dark: '#1976D2' }
      }
    },
    // Similar structure for ADVENTURE and EDUCATIONAL themes...
  },
  [ThemeMode.DARK]: {
    [THEME_VARIANTS.MAGICAL]: {
      primary: {
        base: '#BB86FC',
        light: '#E7B9FF',
        dark: '#8858C8',
        contrast: '#000000'
      },
      secondary: {
        base: '#03DAC6',
        light: '#66FFF9',
        dark: '#00A896',
        contrast: '#000000'
      },
      background: {
        base: '#121212',
        light: '#1E1E1E',
        dark: '#000000',
        contrast: '#FFFFFF'
      },
      surface: {
        default: { base: '#121212', light: '#1E1E1E', dark: '#000000' },
        elevated: { base: '#1E1E1E', light: '#2C2C2C', dark: '#1E1E1E' }
      },
      text: {
        primary: { base: '#FFFFFF', light: '#FAFAFA', dark: '#F5F5F5' },
        secondary: { base: '#B3B3B3', light: '#CCCCCC', dark: '#999999' }
      },
      accent: {
        base: '#CF6679',
        light: '#FF93A3',
        dark: '#9B3F52',
        contrast: '#000000'
      },
      states: {
        hover: { base: 'rgba(255, 255, 255, 0.04)' },
        active: { base: 'rgba(255, 255, 255, 0.12)' },
        disabled: { base: 'rgba(255, 255, 255, 0.38)' },
        focus: { base: 'rgba(255, 255, 255, 0.12)' }
      },
      semantic: {
        success: { base: '#81C784', light: '#A5D6A7', dark: '#66BB6A' },
        warning: { base: '#FFD54F', light: '#FFE082', dark: '#FFC107' },
        error: { base: '#E57373', light: '#EF9A9A', dark: '#EF5350' },
        info: { base: '#64B5F6', light: '#90CAF9', dark: '#42A5F5' }
      }
    },
    // Similar structure for ADVENTURE and EDUCATIONAL themes...
  }
};

/**
 * Typography scale following Material Design type system
 */
export const TYPOGRAPHY_SCALE = {
  h1: {
    fontFamily: 'var(--font-primary)',
    fontSize: { base: '2.5rem', sm: '2rem', md: '2.25rem', lg: '2.5rem' },
    fontWeight: 700,
    lineHeight: 1.2,
    letterSpacing: '-0.01562em'
  },
  h2: {
    fontFamily: 'var(--font-primary)',
    fontSize: { base: '2rem', sm: '1.75rem', md: '1.875rem', lg: '2rem' },
    fontWeight: 600,
    lineHeight: 1.3,
    letterSpacing: '-0.00833em'
  },
  body: {
    fontFamily: 'var(--font-secondary)',
    fontSize: { base: '1rem', sm: '0.875rem', md: '1rem', lg: '1rem' },
    fontWeight: 400,
    lineHeight: 1.5,
    letterSpacing: '0.00938em'
  }
};

/**
 * Spacing scale for consistent layout
 */
export const SPACING_SCALE = {
  xxs: '0.25rem', // 4px
  xs: '0.5rem',   // 8px
  sm: '1rem',     // 16px
  md: '1.5rem',   // 24px
  lg: '2rem',     // 32px
  xl: '2.5rem',   // 40px
  xxl: '3rem'     // 48px
};

/**
 * Material Design elevation constants
 */
export const ELEVATION_SCALE = {
  low: '0px 1px 3px rgba(0, 0, 0, 0.12), 0px 1px 2px rgba(0, 0, 0, 0.24)',
  medium: '0px 3px 6px rgba(0, 0, 0, 0.15), 0px 2px 4px rgba(0, 0, 0, 0.12)',
  high: '0px 10px 20px rgba(0, 0, 0, 0.15), 0px 3px 6px rgba(0, 0, 0, 0.10)',
  modal: '0px 15px 35px rgba(0, 0, 0, 0.2), 0px 5px 15px rgba(0, 0, 0, 0.12)'
};

/**
 * Animation constants for consistent motion design
 */
export const ANIMATION_CONSTANTS = {
  duration: {
    instant: 0,
    fast: 200,
    normal: 300,
    slow: 500
  },
  easing: {
    standard: 'cubic-bezier(0.4, 0.0, 0.2, 1)',
    decelerate: 'cubic-bezier(0.0, 0.0, 0.2, 1)',
    accelerate: 'cubic-bezier(0.4, 0.0, 1, 1)',
    sharp: 'cubic-bezier(0.4, 0.0, 0.6, 1)'
  }
};

/**
 * Breakpoint values for responsive design
 * Following Material Design breakpoint system
 */
export const BREAKPOINT_VALUES = {
  xs: 0,
  sm: 600,
  md: 960,
  lg: 1280,
  xl: 1920
};

/**
 * Grid system configuration
 */
export const GRID_SETTINGS = {
  columns: 12,
  gutter: {
    xs: '1rem',
    sm: '1rem',
    md: '1.5rem',
    lg: '2rem',
    xl: '2.5rem'
  },
  margin: {
    xs: '1rem',
    sm: '1rem',
    md: '1.5rem',
    lg: '2rem',
    xl: '2.5rem'
  },
  container: {
    xs: '100%',
    sm: '600px',
    md: '960px',
    lg: '1280px',
    xl: '1920px'
  }
};