/**
 * @fileoverview Font asset management and configuration for the application
 * Implements Material Design 3.0 typography principles with WCAG 2.1 Level AA compliance
 * @version 1.0.0
 */

// @fontsource/roboto ^5.0.0 - Primary font family
import '@fontsource/roboto/300.css';
import '@fontsource/roboto/400.css';
import '@fontsource/roboto/500.css';
import '@fontsource/roboto/700.css';
import '@fontsource/roboto/300-italic.css';
import '@fontsource/roboto/400-italic.css';
import '@fontsource/roboto/500-italic.css';
import '@fontsource/roboto/700-italic.css';

// @fontsource/playfair-display ^5.0.0 - Secondary font family
import '@fontsource/playfair-display/400.css';
import '@fontsource/playfair-display/500.css';
import '@fontsource/playfair-display/600.css';
import '@fontsource/playfair-display/700.css';
import '@fontsource/playfair-display/400-italic.css';
import '@fontsource/playfair-display/500-italic.css';
import '@fontsource/playfair-display/600-italic.css';
import '@fontsource/playfair-display/700-italic.css';

/**
 * Standard font weights following Material Design guidelines
 */
export const FONT_WEIGHTS = {
  light: 300,
  regular: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
} as const;

/**
 * Available font styles
 */
export const FONT_STYLES = {
  normal: 'normal',
  italic: 'italic',
} as const;

/**
 * Font display strategies for performance optimization
 */
export const FONT_DISPLAY_STRATEGIES = {
  swap: 'swap',
  block: 'block',
  fallback: 'fallback',
  optional: 'optional',
} as const;

/**
 * Type definitions for font configuration
 */
interface FontConfig {
  family: string;
  weights: typeof FONT_WEIGHTS;
  styles: typeof FONT_STYLES;
  fallback: string;
  display: keyof typeof FONT_DISPLAY_STRATEGIES;
}

/**
 * Primary font configuration (Roboto)
 * Used for main UI elements and body text
 */
export const primaryFont: FontConfig = {
  family: 'Roboto',
  weights: FONT_WEIGHTS,
  styles: FONT_STYLES,
  fallback: '-apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif',
  display: 'swap',
};

/**
 * Secondary font configuration (Playfair Display)
 * Used for headings and decorative elements
 */
export const secondaryFont: FontConfig = {
  family: 'Playfair Display',
  weights: {
    regular: FONT_WEIGHTS.regular,
    medium: FONT_WEIGHTS.medium,
    semibold: FONT_WEIGHTS.semibold,
    bold: FONT_WEIGHTS.bold,
  },
  styles: FONT_STYLES,
  fallback: 'Georgia, "Times New Roman", serif',
  display: 'swap',
};

/**
 * Error types for font validation
 */
export enum FontValidationError {
  INVALID_FAMILY = 'Invalid font family',
  UNSUPPORTED_WEIGHT = 'Unsupported font weight',
  INVALID_STYLE = 'Invalid font style',
  MISSING_FALLBACK = 'Missing fallback fonts',
  INVALID_DISPLAY = 'Invalid display strategy',
}

/**
 * Validates font configuration for compliance and support
 * @param fontConfig - Font configuration object to validate
 * @returns {boolean} Validation result
 * @throws {Error} Validation error with details
 */
export const validateFontConfig = (fontConfig: FontConfig): boolean => {
  if (!fontConfig.family) {
    throw new Error(FontValidationError.INVALID_FAMILY);
  }

  const validWeights = Object.values(FONT_WEIGHTS);
  const configWeights = Object.values(fontConfig.weights);
  const hasValidWeights = configWeights.every(weight => validWeights.includes(weight));
  if (!hasValidWeights) {
    throw new Error(FontValidationError.UNSUPPORTED_WEIGHT);
  }

  const validStyles = Object.values(FONT_STYLES);
  const configStyles = Object.values(fontConfig.styles);
  const hasValidStyles = configStyles.every(style => validStyles.includes(style));
  if (!hasValidStyles) {
    throw new Error(FontValidationError.INVALID_STYLE);
  }

  if (!fontConfig.fallback || fontConfig.fallback.trim() === '') {
    throw new Error(FontValidationError.MISSING_FALLBACK);
  }

  if (!Object.keys(FONT_DISPLAY_STRATEGIES).includes(fontConfig.display)) {
    throw new Error(FontValidationError.INVALID_DISPLAY);
  }

  return true;
};

/**
 * Retrieves the path to a specific font file
 * @param fontFamily - Font family name
 * @param weight - Font weight
 * @param style - Font style
 * @param display - Font display strategy
 * @returns {string} Complete path to the font file
 */
export const getFontPath = (
  fontFamily: string,
  weight: number,
  style: keyof typeof FONT_STYLES = 'normal',
  display: keyof typeof FONT_DISPLAY_STRATEGIES = 'swap'
): string => {
  const normalizedFamily = fontFamily.toLowerCase().replace(/\s+/g, '-');
  const styleSegment = style === 'italic' ? '-italic' : '';
  
  return `@fontsource/${normalizedFamily}/${weight}${styleSegment}.css?display=${display}`;
};

// Export type definitions for TypeScript support
export type { FontConfig };
export { FONT_WEIGHTS as weights, FONT_STYLES as styles };