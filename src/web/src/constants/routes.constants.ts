/**
 * @fileoverview Route constants for the Memorable platform frontend
 * @version 1.0.0
 * 
 * This file defines all application routes used for navigation and URL management.
 * Routes are organized into logical groupings (public, auth, book, dashboard, order)
 * to maintain clear separation and support proper access control.
 */

/**
 * Public accessible main application routes
 * These routes are available to all users without authentication
 */
export const ROUTES = {
  HOME: '/',
  DEMO: '/demo',
  FEATURES: '/features',
  PRICING: '/pricing',
  ABOUT: '/about',
  CONTACT: '/contact',
} as const;

/**
 * Authentication and security-related routes
 * Handles user authentication, registration, and security flows
 */
export const AUTH_ROUTES = {
  LOGIN: '/auth/login',
  REGISTER: '/auth/register',
  RESET_PASSWORD: '/auth/reset-password',
  VERIFY_EMAIL: '/auth/verify-email/:token',
  MFA_SETUP: '/auth/mfa-setup',
} as const;

/**
 * Book creation and management routes
 * Supports the core book creation flow with dynamic URL parameters
 * @param id - Book identifier for specific book operations
 */
export const BOOK_ROUTES = {
  CREATE: '/book/create',
  EDIT: '/book/edit/:id',
  PREVIEW: '/book/preview/:id',
  CUSTOMIZE: '/book/customize/:id',
  THEME_SELECTION: '/book/themes',
} as const;

/**
 * Protected dashboard routes
 * Requires authentication to access user-specific features and management
 */
export const DASHBOARD_ROUTES = {
  BOOKS: '/dashboard/books',
  ORDERS: '/dashboard/orders',
  PROFILE: '/dashboard/profile',
  SETTINGS: '/dashboard/settings',
  BILLING: '/dashboard/billing',
} as const;

/**
 * Order processing and tracking routes
 * Handles the complete order lifecycle from checkout to tracking
 * @param id - Order identifier for specific order operations
 */
export const ORDER_ROUTES = {
  CHECKOUT: '/order/checkout/:id',
  REVIEW: '/order/review/:id',
  CONFIRMATION: '/order/confirmation/:id',
  TRACKING: '/order/tracking/:id',
} as const;

/**
 * Helper function to replace dynamic parameters in routes
 * @param route - Route pattern containing parameters
 * @param params - Object containing parameter values
 * @returns Resolved route with replaced parameters
 */
export const resolveRoute = (route: string, params: Record<string, string>): string => {
  let resolvedRoute = route;
  Object.entries(params).forEach(([key, value]) => {
    resolvedRoute = resolvedRoute.replace(`:${key}`, value);
  });
  return resolvedRoute;
};

/**
 * Type definitions for route parameters to ensure type safety
 */
export type BookRouteParams = {
  id: string;
};

export type OrderRouteParams = {
  id: string;
};

export type AuthRouteParams = {
  token: string;
};

// Freeze all route objects to prevent accidental modifications
Object.freeze(ROUTES);
Object.freeze(AUTH_ROUTES);
Object.freeze(BOOK_ROUTES);
Object.freeze(DASHBOARD_ROUTES);
Object.freeze(ORDER_ROUTES);