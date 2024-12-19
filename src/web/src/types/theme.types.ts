/**
 * @fileoverview Theme type definitions for the Memorable platform
 * Defines comprehensive type system for theme configuration, visual styles,
 * and customization options following Material Design 3.0 principles
 * @version 1.0.0
 */

/**
 * Available theme modes including accessibility options
 */
export enum ThemeMode {
  LIGHT = 'light',
  DARK = 'dark',
  HIGH_CONTRAST = 'high-contrast'
}

/**
 * Direction for RTL/LTR support
 */
export type Direction = 'ltr' | 'rtl';

/**
 * Motion preference for accessibility
 */
export type MotionPreference = 'no-preference' | 'reduced';

/**
 * Color token with base and variants
 */
export interface ColorToken {
  base: string;
  light?: string;
  dark?: string;
  contrast?: string;
}

/**
 * State-specific colors
 */
export interface StateColors {
  hover: ColorToken;
  active: ColorToken;
  disabled: ColorToken;
  focus: ColorToken;
}

/**
 * Semantic colors for feedback and status
 */
export interface SemanticColors {
  success: ColorToken;
  warning: ColorToken;
  error: ColorToken;
  info: ColorToken;
}

/**
 * Comprehensive theme color system
 */
export interface ThemeColors {
  primary: ColorToken;
  secondary: ColorToken;
  background: ColorToken;
  surface: Record<string, ColorToken>;
  text: Record<string, ColorToken>;
  accent: ColorToken;
  states: StateColors;
  semantic: SemanticColors;
}

/**
 * Responsive scale for typography and spacing
 */
export type ResponsiveScale<T> = {
  base: T;
  sm?: T;
  md?: T;
  lg?: T;
  xl?: T;
};

/**
 * Typography variant configuration
 */
export interface TypographyVariant {
  fontFamily: string;
  fontSize: string;
  fontWeight: number;
  lineHeight: number;
  letterSpacing: string;
  textTransform?: string;
}

/**
 * Comprehensive typography system
 */
export interface ThemeTypography {
  fontFamily: Record<string, string>;
  fontSize: ResponsiveScale<string>;
  fontWeight: Record<string, number>;
  lineHeight: Record<string, number>;
  letterSpacing: Record<string, string>;
  textTransform: Record<string, string>;
  variants: Record<string, TypographyVariant>;
}

/**
 * Grid system settings
 */
export interface GridSettings {
  columns: number;
  gutter: string;
  margin: string;
  container: string;
}

/**
 * Comprehensive layout system
 */
export interface ThemeLayout {
  spacing: Record<string, string>;
  borderRadius: Record<string, string>;
  breakpoints: Record<string, number>;
  containers: Record<string, string>;
  grid: GridSettings;
  zIndex: Record<string, number>;
  shadows: Record<string, string>;
}

/**
 * Theme metadata for management
 */
export interface ThemeMetadata {
  description?: string;
  version: string;
  author?: string;
  created: string;
  updated: string;
  tags?: string[];
}

/**
 * Complete theme settings
 */
export interface ThemeSettings {
  colors: ThemeColors;
  typography: ThemeTypography;
  layout: ThemeLayout;
  mode: ThemeMode;
  direction: Direction;
  motion: MotionPreference;
}

/**
 * Theme entity structure
 */
export interface Theme {
  id: string;
  name: string;
  settings: ThemeSettings;
  active: boolean;
  metadata: ThemeMetadata;
}

/**
 * Theme customization options
 */
export interface ThemeCustomization {
  colors?: Partial<ThemeColors>;
  typography?: Partial<ThemeTypography>;
  layout?: Partial<ThemeLayout>;
}

/**
 * Theme validation result
 */
export interface ThemeValidationResult {
  valid: boolean;
  errors?: string[];
  warnings?: string[];
}