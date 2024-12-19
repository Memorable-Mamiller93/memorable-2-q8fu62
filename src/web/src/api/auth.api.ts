/**
 * @fileoverview Authentication API client implementation for the Memorable platform
 * Provides secure user authentication, registration, and session management functions
 * @version 1.0.0
 */

import { apiClient } from '../config/api.config';
import { API_ENDPOINTS } from '../constants/api.constants';
import { 
  User,
  LoginCredentials,
  RegisterData,
  AuthResponse,
  EmailVerificationData,
  PasswordResetData
} from '../types/user.types';
import { ApiResponse } from '../types/api.types';

/**
 * Authenticates user with email/password credentials and optional MFA
 * @param credentials - User login credentials
 * @param mfaCode - Optional MFA verification code
 * @returns Promise with authentication response containing user data and tokens
 */
export const login = async (
  credentials: LoginCredentials,
  mfaCode?: string
): Promise<AuthResponse> => {
  const response = await apiClient.post<AuthResponse>(
    API_ENDPOINTS.AUTH.LOGIN,
    {
      ...credentials,
      mfaCode
    }
  );
  return response.data;
};

/**
 * Registers a new user account with email verification
 * @param data - User registration data
 * @returns Promise with authentication response and verification status
 */
export const register = async (data: RegisterData): Promise<AuthResponse> => {
  const response = await apiClient.post<AuthResponse>(
    API_ENDPOINTS.AUTH.REGISTER,
    data
  );
  return response.data;
};

/**
 * Verifies user email address with verification token
 * @param data - Email verification data containing token
 * @returns Promise indicating verification success
 */
export const verifyEmail = async (data: EmailVerificationData): Promise<void> => {
  await apiClient.post<void>(
    API_ENDPOINTS.AUTH.VERIFY_EMAIL,
    data
  );
};

/**
 * Initiates or completes password reset process
 * @param data - Password reset data with token and new password
 * @returns Promise indicating reset success
 */
export const resetPassword = async (data: PasswordResetData): Promise<void> => {
  await apiClient.post<void>(
    API_ENDPOINTS.AUTH.RESET_PASSWORD,
    data
  );
};

/**
 * Updates user profile information
 * @param data - Profile update data
 * @returns Promise with updated user data
 */
export const updateProfile = async (
  data: Partial<User>
): Promise<ApiResponse<User>> => {
  const response = await apiClient.put<ApiResponse<User>>(
    API_ENDPOINTS.AUTH.CHANGE_PASSWORD,
    data
  );
  return response;
};

/**
 * Logs out current user and revokes authentication tokens
 * @returns Promise indicating logout success
 */
export const logout = async (): Promise<void> => {
  await apiClient.post<void>(
    API_ENDPOINTS.AUTH.LOGOUT
  );
};

/**
 * Refreshes authentication tokens using refresh token
 * @returns Promise with new authentication tokens
 */
export const refreshToken = async (): Promise<AuthResponse> => {
  const response = await apiClient.post<AuthResponse>(
    API_ENDPOINTS.AUTH.REFRESH
  );
  return response.data;
};

/**
 * Changes user password with current password verification
 * @param currentPassword - Current user password
 * @param newPassword - New password to set
 * @returns Promise indicating password change success
 */
export const changePassword = async (
  currentPassword: string,
  newPassword: string
): Promise<void> => {
  await apiClient.post<void>(
    API_ENDPOINTS.AUTH.CHANGE_PASSWORD,
    {
      currentPassword,
      newPassword
    }
  );
};

/**
 * Requests password reset email for user
 * @param email - User email address
 * @returns Promise indicating reset email sent
 */
export const requestPasswordReset = async (email: string): Promise<void> => {
  await apiClient.post<void>(
    API_ENDPOINTS.AUTH.RESET_PASSWORD,
    { email }
  );
};

/**
 * Resends email verification link to user
 * @param email - User email address
 * @returns Promise indicating verification email sent
 */
export const resendVerificationEmail = async (email: string): Promise<void> => {
  await apiClient.post<void>(
    API_ENDPOINTS.AUTH.VERIFY_EMAIL,
    { email }
  );
};