/// <reference types="vite/client" /> // @version ^4.4.0

/**
 * Type definitions for Vite environment variables and client types.
 * Extends the base ImportMetaEnv interface to include custom environment variables
 * used throughout the React.js frontend application.
 */
interface ImportMetaEnv extends Record<string, unknown> {
  /**
   * Base URL for API endpoints
   * @example 'https://api.memorable.com'
   */
  readonly VITE_API_URL: string;

  /**
   * OpenAI API key for story generation
   * @security API Key must be kept secure and not exposed to client
   */
  readonly VITE_OPENAI_API_KEY: string;

  /**
   * Stripe publishable key for payment processing
   * @security Only publishable key should be used on client side
   */
  readonly VITE_STRIPE_PUBLIC_KEY: string;

  /**
   * Current deployment environment
   */
  readonly VITE_ENVIRONMENT: 'development' | 'staging' | 'production';

  /**
   * Application version from package.json
   * @example '1.0.0'
   */
  readonly VITE_APP_VERSION: string;

  /**
   * Build timestamp for cache busting
   * @example '2023-08-10T10:00:00Z'
   */
  readonly VITE_BUILD_TIMESTAMP: string;

  /**
   * Flag to enable/disable analytics tracking
   */
  readonly VITE_ENABLE_ANALYTICS: boolean;

  /**
   * CDN base URL for static assets
   * @example 'https://cdn.memorable.com'
   */
  readonly VITE_CDN_URL: string;

  /**
   * Maximum allowed file size for uploads in bytes
   * @example 5242880 (5MB)
   */
  readonly VITE_MAX_FILE_SIZE: number;

  /**
   * Comma-separated list of supported locale codes
   * @example 'en-US,en-GB'
   */
  readonly VITE_SUPPORTED_LOCALES: string;
}

/**
 * Extends the ImportMeta interface to include Vite-specific properties
 * and hot module replacement types.
 */
interface ImportMeta {
  /**
   * Environment variables available at runtime
   */
  readonly env: ImportMetaEnv;

  /**
   * Hot module replacement API
   * Only available in development mode
   */
  readonly hot?: {
    /**
     * Accept handler for hot module replacement
     * @param cb Callback function that receives the updated module
     */
    readonly accept: (cb: (mod: any) => void) => void;
  };
}

// Export the ImportMetaEnv interface to be used across the application
export type { ImportMetaEnv };