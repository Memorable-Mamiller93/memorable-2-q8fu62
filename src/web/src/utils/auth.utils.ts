/**
 * @fileoverview Advanced authentication utilities for secure token management and session handling
 * Implements comprehensive security measures including encryption, token rotation, and cross-tab synchronization
 * @version 1.0.0
 */

import jwtDecode from 'jwt-decode'; // v3.1.2
import * as CryptoJS from 'crypto-js'; // v4.1.1

import { AuthResponse, User } from '../types/user.types';
import { login, refreshToken, logout } from '../api/auth.api';
import { setSecureStorage, getSecureStorage, removeSecureStorage } from './storage.utils';

// Constants for token management
const TOKEN_EXPIRY_BUFFER = 5 * 60 * 1000; // 5 minutes in milliseconds
const MAX_REFRESH_RETRIES = 3;
const REFRESH_RETRY_DELAY = 1000; // 1 second
const TOKEN_ENCRYPTION_KEY = process.env.REACT_APP_TOKEN_ENCRYPTION_KEY || '';

// Storage keys for tokens
const STORAGE_KEYS = {
  ACCESS_TOKEN: 'auth_access_token',
  REFRESH_TOKEN: 'auth_refresh_token',
  TOKEN_FINGERPRINT: 'auth_token_fingerprint'
};

/**
 * Interface for stored authentication tokens
 */
interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  tokenFingerprint: string;
  expiresAt: number;
}

/**
 * Securely stores authentication tokens with encryption and cross-tab synchronization
 * @param authResponse - Authentication response from server
 * @param rememberMe - Whether to persist tokens for extended session
 */
export const setAuthTokens = async (
  authResponse: AuthResponse,
  rememberMe: boolean = false
): Promise<void> => {
  try {
    // Generate token fingerprint for security validation
    const tokenFingerprint = CryptoJS.SHA256(
      authResponse.accessToken + navigator.userAgent
    ).toString();

    // Encrypt tokens before storage
    const encryptedAccessToken = CryptoJS.AES.encrypt(
      authResponse.accessToken,
      TOKEN_ENCRYPTION_KEY
    ).toString();

    const encryptedRefreshToken = CryptoJS.AES.encrypt(
      authResponse.refreshToken,
      TOKEN_ENCRYPTION_KEY
    ).toString();

    const tokens: AuthTokens = {
      accessToken: encryptedAccessToken,
      refreshToken: encryptedRefreshToken,
      tokenFingerprint,
      expiresAt: Date.now() + TOKEN_EXPIRY_BUFFER
    };

    // Store tokens securely
    await setSecureStorage(STORAGE_KEYS.ACCESS_TOKEN, tokens.accessToken, { persistent: rememberMe });
    await setSecureStorage(STORAGE_KEYS.REFRESH_TOKEN, tokens.refreshToken, { persistent: rememberMe });
    await setSecureStorage(STORAGE_KEYS.TOKEN_FINGERPRINT, tokenFingerprint, { persistent: rememberMe });

    // Set up token refresh timer
    scheduleTokenRefresh(tokens.expiresAt);

    // Broadcast storage event for cross-tab synchronization
    window.dispatchEvent(new StorageEvent('storage', {
      key: STORAGE_KEYS.ACCESS_TOKEN,
      newValue: JSON.stringify(tokens)
    }));
  } catch (error) {
    console.error('Error storing auth tokens:', error);
    throw new Error('Failed to securely store authentication tokens');
  }
};

/**
 * Retrieves and decrypts stored authentication tokens
 * @returns Decrypted authentication tokens
 */
export const getAuthTokens = async (): Promise<AuthTokens | null> => {
  try {
    const encryptedAccessToken = await getSecureStorage<string>(STORAGE_KEYS.ACCESS_TOKEN);
    const encryptedRefreshToken = await getSecureStorage<string>(STORAGE_KEYS.REFRESH_TOKEN);
    const storedFingerprint = await getSecureStorage<string>(STORAGE_KEYS.TOKEN_FINGERPRINT);

    if (!encryptedAccessToken || !encryptedRefreshToken || !storedFingerprint) {
      return null;
    }

    // Decrypt tokens
    const accessToken = CryptoJS.AES.decrypt(
      encryptedAccessToken,
      TOKEN_ENCRYPTION_KEY
    ).toString(CryptoJS.enc.Utf8);

    const refreshToken = CryptoJS.AES.decrypt(
      encryptedRefreshToken,
      TOKEN_ENCRYPTION_KEY
    ).toString(CryptoJS.enc.Utf8);

    // Validate token fingerprint
    const currentFingerprint = CryptoJS.SHA256(
      accessToken + navigator.userAgent
    ).toString();

    if (currentFingerprint !== storedFingerprint) {
      await clearAuthTokens();
      throw new Error('Invalid token fingerprint');
    }

    return {
      accessToken,
      refreshToken,
      tokenFingerprint: storedFingerprint,
      expiresAt: getTokenExpiryTime(accessToken)
    };
  } catch (error) {
    console.error('Error retrieving auth tokens:', error);
    return null;
  }
};

/**
 * Handles token refresh with retry logic and error handling
 * @returns New access token
 */
export const handleTokenRefresh = async (): Promise<string> => {
  let retryCount = 0;
  let lastError: Error | null = null;

  while (retryCount < MAX_REFRESH_RETRIES) {
    try {
      const tokens = await getAuthTokens();
      if (!tokens) {
        throw new Error('No refresh token available');
      }

      const response = await refreshToken();
      await setAuthTokens(response, true);
      return response.accessToken;
    } catch (error) {
      lastError = error;
      retryCount++;

      if (retryCount === MAX_REFRESH_RETRIES) {
        await clearAuthTokens();
        await logout();
        break;
      }

      // Exponential backoff
      await new Promise(resolve => 
        setTimeout(resolve, REFRESH_RETRY_DELAY * Math.pow(2, retryCount))
      );
    }
  }

  throw new Error(`Token refresh failed after ${MAX_REFRESH_RETRIES} attempts: ${lastError?.message}`);
};

/**
 * Validates token and checks expiration
 * @param token - JWT token to validate
 * @returns Boolean indicating token validity
 */
export const isTokenValid = (token: string): boolean => {
  try {
    const decoded = jwtDecode<{ exp: number }>(token);
    const currentTime = Date.now() / 1000;

    return decoded.exp > currentTime + (TOKEN_EXPIRY_BUFFER / 1000);
  } catch {
    return false;
  }
};

/**
 * Clears all stored authentication tokens
 */
const clearAuthTokens = async (): Promise<void> => {
  await removeSecureStorage(STORAGE_KEYS.ACCESS_TOKEN);
  await removeSecureStorage(STORAGE_KEYS.REFRESH_TOKEN);
  await removeSecureStorage(STORAGE_KEYS.TOKEN_FINGERPRINT);
};

/**
 * Schedules token refresh before expiration
 * @param expiresAt - Token expiration timestamp
 */
const scheduleTokenRefresh = (expiresAt: number): void => {
  const refreshTime = expiresAt - Date.now() - TOKEN_EXPIRY_BUFFER;
  if (refreshTime > 0) {
    setTimeout(async () => {
      try {
        await handleTokenRefresh();
      } catch (error) {
        console.error('Scheduled token refresh failed:', error);
      }
    }, refreshTime);
  }
};

/**
 * Gets token expiration time from JWT
 * @param token - JWT token
 * @returns Expiration timestamp
 */
const getTokenExpiryTime = (token: string): number => {
  const decoded = jwtDecode<{ exp: number }>(token);
  return decoded.exp * 1000; // Convert to milliseconds
};

/**
 * Initializes cross-tab authentication synchronization
 */
const initAuthSync = (): void => {
  window.addEventListener('storage', async (event) => {
    if (event.key === STORAGE_KEYS.ACCESS_TOKEN) {
      if (!event.newValue) {
        await clearAuthTokens();
      } else {
        const tokens: AuthTokens = JSON.parse(event.newValue);
        scheduleTokenRefresh(tokens.expiresAt);
      }
    }
  });
};

// Initialize cross-tab synchronization
initAuthSync();