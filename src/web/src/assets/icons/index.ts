// @ts-check
import React from 'react'; // v18.2.0

// Constants for icon standardization
const DEFAULT_ICON_SIZE = 24;
const DEFAULT_ICON_COLOR = 'currentColor';
const ICON_VIEWBOX_SIZE = 24;

/**
 * Interface for standardized icon component props following Material Design 3.0
 * and WCAG 2.1 Level AA accessibility guidelines
 */
export interface IconProps {
  /** Icon size in pixels or CSS units (default: 24px) */
  size?: number | string;
  /** Icon color in CSS format (default: currentColor) */
  color?: string;
  /** Additional CSS classes for custom styling */
  className?: string;
  /** Accessibility label for screen readers */
  ariaLabel?: string;
  /** ARIA role (default: 'img') */
  role?: string;
  /** Whether icon should be focusable (default: false) */
  focusable?: boolean;
  /** Optional title for hover tooltip */
  title?: string;
}

/**
 * Factory function to create standardized, accessible icon components
 * following Material Design 3.0 specifications
 * 
 * @param SVGContent - SVG markup or React element for the icon
 * @param defaultProps - Default properties for the icon component
 * @returns Accessible React icon component
 */
const createIcon = (
  SVGContent: string | React.ReactNode,
  defaultProps: Partial<IconProps> = {}
): React.FC<IconProps> => {
  return React.memo(({
    size = DEFAULT_ICON_SIZE,
    color = DEFAULT_ICON_COLOR,
    className = '',
    ariaLabel,
    role = 'img',
    focusable = false,
    title,
    ...props
  }: IconProps) => {
    const styles = {
      display: 'inline-block',
      width: typeof size === 'number' ? `${size}px` : size,
      height: typeof size === 'number' ? `${size}px` : size,
      fill: color,
      flexShrink: 0,
      userSelect: 'none' as const,
    };

    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox={`0 0 ${ICON_VIEWBOX_SIZE} ${ICON_VIEWBOX_SIZE}`}
        style={styles}
        className={className}
        aria-label={ariaLabel}
        role={role}
        focusable={focusable}
        {...defaultProps}
        {...props}
      >
        {title && <title>{title}</title>}
        {SVGContent}
      </svg>
    );
  });
};

// Navigation Icons
export const NavigationIcons = {
  Menu: createIcon(
    <path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z" />,
    { ariaLabel: 'Menu' }
  ),
  Close: createIcon(
    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />,
    { ariaLabel: 'Close' }
  ),
  User: createIcon(
    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />,
    { ariaLabel: 'User account' }
  ),
  Back: createIcon(
    <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />,
    { ariaLabel: 'Go back' }
  ),
};

// Book Creation Icons
export const BookCreationIcons = {
  Upload: createIcon(
    <path d="M9 16h6v-6h4l-7-7-7 7h4zm-4 2h14v2H5z" />,
    { ariaLabel: 'Upload' }
  ),
  Edit: createIcon(
    <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34a.9959.9959 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />,
    { ariaLabel: 'Edit' }
  ),
  Preview: createIcon(
    <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" />,
    { ariaLabel: 'Preview' }
  ),
  Save: createIcon(
    <path d="M17 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z" />,
    { ariaLabel: 'Save' }
  ),
};

// Common Utility Icons
export const CommonIcons = {
  Loading: createIcon(
    <path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z" />,
    { ariaLabel: 'Loading', role: 'progressbar' }
  ),
  Success: createIcon(
    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />,
    { ariaLabel: 'Success', role: 'status' }
  ),
  Error: createIcon(
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />,
    { ariaLabel: 'Error', role: 'alert' }
  ),
  Info: createIcon(
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />,
    { ariaLabel: 'Information', role: 'status' }
  ),
};

// Re-export all icon sets and interfaces
export { IconProps };
export default {
  NavigationIcons,
  BookCreationIcons,
  CommonIcons,
};