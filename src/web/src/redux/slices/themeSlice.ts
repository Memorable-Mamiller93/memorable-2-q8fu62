/**
 * @fileoverview Redux slice for theme management in the Memorable platform
 * Implements comprehensive theme state management with Material Design 3.0
 * principles, accessibility features, and theme persistence
 * @version 1.0.0
 */

import { createSlice, PayloadAction } from '@reduxjs/toolkit'; // v1.9.5
import { Theme, ThemeMode } from '../../types/theme.types';

/**
 * Accessibility preferences interface
 */
interface AccessibilityPreferences {
  highContrast: boolean;
  reducedMotion: boolean;
}

/**
 * Theme state interface
 */
interface ThemeState {
  currentTheme: Theme | null;
  themeMode: ThemeMode;
  accessibility: AccessibilityPreferences;
  version: number;
  lastUpdated: number;
}

/**
 * Initial theme state with accessibility defaults
 */
const initialState: ThemeState = {
  currentTheme: null,
  themeMode: ThemeMode.LIGHT,
  accessibility: {
    highContrast: false,
    reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  },
  version: 1,
  lastUpdated: Date.now(),
};

/**
 * Theme persistence utilities
 */
const themeStorage = {
  save: (state: ThemeState) => {
    try {
      localStorage.setItem('memorable_theme', JSON.stringify({
        themeMode: state.themeMode,
        accessibility: state.accessibility,
        version: state.version,
      }));
    } catch (error) {
      console.error('Failed to persist theme settings:', error);
    }
  },
  load: (): Partial<ThemeState> => {
    try {
      const stored = localStorage.getItem('memorable_theme');
      return stored ? JSON.parse(stored) : {};
    } catch (error) {
      console.error('Failed to load theme settings:', error);
      return {};
    }
  },
};

/**
 * Theme validation utility
 */
const validateTheme = (theme: Theme): boolean => {
  return (
    theme &&
    theme.id &&
    theme.settings &&
    theme.settings.colors &&
    theme.settings.typography &&
    theme.settings.layout
  );
};

/**
 * Theme slice with enhanced accessibility support
 */
const themeSlice = createSlice({
  name: 'theme',
  initialState: { ...initialState, ...themeStorage.load() },
  reducers: {
    /**
     * Set current theme with validation and version control
     */
    setTheme: (state, action: PayloadAction<Theme>) => {
      const theme = action.payload;
      
      if (!validateTheme(theme)) {
        console.error('Invalid theme configuration');
        return;
      }

      state.currentTheme = {
        ...theme,
        settings: {
          ...theme.settings,
          mode: state.themeMode,
          motion: state.accessibility.reducedMotion ? 'reduced' : 'no-preference',
        },
      };
      
      state.lastUpdated = Date.now();
      themeStorage.save(state);

      // Emit theme change event for analytics
      window.dispatchEvent(new CustomEvent('themeChange', {
        detail: { themeId: theme.id, mode: state.themeMode }
      }));
    },

    /**
     * Toggle between theme modes with accessibility considerations
     */
    toggleThemeMode: (state) => {
      const modes = [ThemeMode.LIGHT, ThemeMode.DARK];
      if (state.accessibility.highContrast) {
        modes.push(ThemeMode.HIGH_CONTRAST);
      }

      const currentIndex = modes.indexOf(state.themeMode);
      state.themeMode = modes[(currentIndex + 1) % modes.length];

      if (state.currentTheme) {
        state.currentTheme.settings.mode = state.themeMode;
      }

      state.lastUpdated = Date.now();
      themeStorage.save(state);
    },

    /**
     * Update accessibility preferences with immediate effect
     */
    setAccessibilityPreferences: (
      state,
      action: PayloadAction<AccessibilityPreferences>
    ) => {
      state.accessibility = action.payload;

      if (state.currentTheme) {
        state.currentTheme.settings.motion = 
          action.payload.reducedMotion ? 'reduced' : 'no-preference';
      }

      // Update theme mode if high contrast is toggled
      if (action.payload.highContrast && state.themeMode !== ThemeMode.HIGH_CONTRAST) {
        state.themeMode = ThemeMode.HIGH_CONTRAST;
      } else if (!action.payload.highContrast && state.themeMode === ThemeMode.HIGH_CONTRAST) {
        state.themeMode = ThemeMode.LIGHT;
      }

      state.lastUpdated = Date.now();
      themeStorage.save(state);

      // Emit accessibility change event
      window.dispatchEvent(new CustomEvent('accessibilityChange', {
        detail: action.payload
      }));
    },
  },
});

/**
 * Memoized selectors for theme state
 */
export const themeSelectors = {
  selectCurrentTheme: (state: { theme: ThemeState }) => state.theme.currentTheme,
  selectThemeMode: (state: { theme: ThemeState }) => state.theme.themeMode,
  selectAccessibilityPreferences: (state: { theme: ThemeState }) => 
    state.theme.accessibility,
  selectThemeWithAccessibility: (state: { theme: ThemeState }) => ({
    theme: state.theme.currentTheme,
    mode: state.theme.themeMode,
    accessibility: state.theme.accessibility,
  }),
};

export const { setTheme, toggleThemeMode, setAccessibilityPreferences } = 
  themeSlice.actions;

export default themeSlice.reducer;