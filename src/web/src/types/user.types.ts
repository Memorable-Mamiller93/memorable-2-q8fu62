/**
 * @fileoverview User-related TypeScript interfaces and types for the Memorable platform frontend
 * Implements comprehensive user data structures, authentication, and user management types
 * @version 1.0.0
 */

import { ApiResponse } from './api.types';

/**
 * Enumeration of available user roles in the system
 * Supports basic, premium, and administrative access levels
 */
export enum UserRole {
  USER = 'USER',
  PREMIUM_USER = 'PREMIUM_USER',
  ADMIN = 'ADMIN'
}

/**
 * Interface for notification preference settings
 */
interface NotificationPreferences {
  email: boolean;
  push: boolean;
  orderUpdates: boolean;
  marketing: boolean;
}

/**
 * Interface for default book creation preferences
 */
interface BookPreferences {
  defaultTheme: string;
  paperQuality: string;
  coverType: string;
  fontSize: number;
}

/**
 * Interface for user customization and preference settings
 */
export interface UserPreferences {
  theme: string;
  notifications: NotificationPreferences;
  defaultBookSettings: BookPreferences;
}

/**
 * Core user data structure with comprehensive user information
 */
export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phoneNumber?: string;
  role: UserRole;
  isVerified: boolean;
  preferences?: UserPreferences;
  lastLoginAt?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Login request data structure with remember me option
 */
export interface LoginCredentials {
  email: string;
  password: string;
  rememberMe: boolean;
}

/**
 * Extended registration request data structure
 */
export interface RegisterData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phoneNumber?: string;
}

/**
 * Enhanced authentication response with token expiration
 */
export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
}

/**
 * Extended Redux auth state with comprehensive session management
 */
export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  loading: boolean;
  refreshing: boolean;
  sessionExpiry: string | null;
  error: string | null;
}

/**
 * Password reset request data structure
 */
export interface PasswordResetData {
  email: string;
  token: string;
  newPassword: string;
}

/**
 * Email verification request data structure
 */
export interface EmailVerificationData {
  email: string;
  token: string;
}

/**
 * Type for auth-related API responses
 */
export type AuthApiResponse<T> = ApiResponse<T>;