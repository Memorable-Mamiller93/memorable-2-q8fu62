/**
 * @fileoverview Enhanced authentication hook for the Memorable platform
 * Implements secure session management, device fingerprinting, and cross-tab synchronization
 * @version 1.0.0
 */

import { useEffect, useCallback, useRef } from 'react'; // v18.2.0
import { useAppDispatch, useAppSelector } from '../redux/hooks';
import {
  loginUser,
  registerUser,
  logoutUser,
  refreshUserToken,
  selectAuth,
  updateLastActivity,
  updateSessionExpiry,
  clearError
} from '../redux/slices/authSlice';
import type {
  LoginCredentials,
  RegisterData,
  User,
  AuthResponse,
  AuthError
} from '../types/user.types';
import {
  isTokenValid,
  handleTokenRefresh,
  generateDeviceFingerprint,
  encryptToken,
  decryptToken
} from '../utils/auth.utils';

// Constants
const TOKEN_REFRESH_INTERVAL = 4 * 60 * 1000; // 4 minutes
const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes
const ACTIVITY_UPDATE_INTERVAL = 60 * 1000; // 1 minute
const MAX_REFRESH_RETRIES = 3;

/**
 * Enhanced authentication hook with comprehensive security features
 * @returns Authentication state and methods
 */
export const useAuth = () => {
  const dispatch = useAppDispatch();
  const auth = useAppSelector(selectAuth);
  const refreshTimerRef = useRef<NodeJS.Timeout>();
  const activityTimerRef = useRef<NodeJS.Timeout>();
  const refreshRetryCount = useRef(0);

  /**
   * Handles user login with enhanced security
   */
  const login = useCallback(async (credentials: LoginCredentials): Promise<void> => {
    try {
      // Generate device fingerprint
      const deviceFingerprint = await generateDeviceFingerprint();
      
      const response = await dispatch(loginUser({
        ...credentials,
        deviceFingerprint
      })).unwrap();

      // Initialize session monitoring
      initializeSessionMonitoring(response);
      
      // Set up cross-tab synchronization
      broadcastAuthEvent('login', response.user.id);
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    }
  }, [dispatch]);

  /**
   * Handles user registration with security measures
   */
  const register = useCallback(async (data: RegisterData): Promise<void> => {
    try {
      const deviceFingerprint = await generateDeviceFingerprint();
      
      const response = await dispatch(registerUser({
        ...data,
        deviceFingerprint
      })).unwrap();

      initializeSessionMonitoring(response);
      broadcastAuthEvent('register', response.user.id);
    } catch (error) {
      console.error('Registration failed:', error);
      throw error;
    }
  }, [dispatch]);

  /**
   * Handles secure logout across all tabs
   */
  const logout = useCallback(async (): Promise<void> => {
    try {
      await dispatch(logoutUser()).unwrap();
      clearSessionMonitoring();
      broadcastAuthEvent('logout');
    } catch (error) {
      console.error('Logout failed:', error);
      throw error;
    }
  }, [dispatch]);

  /**
   * Handles token refresh with retry logic
   */
  const refreshToken = useCallback(async (): Promise<void> => {
    try {
      if (refreshRetryCount.current >= MAX_REFRESH_RETRIES) {
        await logout();
        return;
      }

      const response = await dispatch(refreshUserToken()).unwrap();
      refreshRetryCount.current = 0;
      updateSessionTimers(response);
    } catch (error) {
      refreshRetryCount.current++;
      console.error('Token refresh failed:', error);
      throw error;
    }
  }, [dispatch, logout]);

  /**
   * Initializes session monitoring
   */
  const initializeSessionMonitoring = useCallback((response: AuthResponse) => {
    // Set up token refresh timer
    const refreshInterval = Math.max(
      0,
      new Date(response.expiresAt).getTime() - Date.now() - TOKEN_REFRESH_INTERVAL
    );
    
    refreshTimerRef.current = setInterval(() => {
      refreshToken();
    }, refreshInterval);

    // Set up activity monitoring
    activityTimerRef.current = setInterval(() => {
      dispatch(updateLastActivity());
    }, ACTIVITY_UPDATE_INTERVAL);

    // Update session expiry
    dispatch(updateSessionExpiry(new Date(response.expiresAt).getTime()));
  }, [dispatch, refreshToken]);

  /**
   * Updates session timers
   */
  const updateSessionTimers = useCallback((response: AuthResponse) => {
    if (refreshTimerRef.current) {
      clearInterval(refreshTimerRef.current);
    }

    initializeSessionMonitoring(response);
  }, [initializeSessionMonitoring]);

  /**
   * Clears session monitoring timers
   */
  const clearSessionMonitoring = useCallback(() => {
    if (refreshTimerRef.current) {
      clearInterval(refreshTimerRef.current);
    }
    if (activityTimerRef.current) {
      clearInterval(activityTimerRef.current);
    }
  }, []);

  /**
   * Broadcasts authentication events for cross-tab synchronization
   */
  const broadcastAuthEvent = (event: string, userId?: string) => {
    window.localStorage.setItem('auth_event', JSON.stringify({
      event,
      userId,
      timestamp: Date.now()
    }));
  };

  /**
   * Handles storage events for cross-tab synchronization
   */
  const handleStorageEvent = useCallback((event: StorageEvent) => {
    if (event.key === 'auth_event') {
      const data = JSON.parse(event.newValue || '{}');
      
      switch (data.event) {
        case 'logout':
          clearSessionMonitoring();
          break;
        case 'login':
        case 'register':
          if (data.userId && data.userId !== auth.user?.id) {
            refreshToken();
          }
          break;
      }
    }
  }, [auth.user?.id, clearSessionMonitoring, refreshToken]);

  // Set up event listeners and cleanup
  useEffect(() => {
    window.addEventListener('storage', handleStorageEvent);
    
    // Set up activity tracking
    const trackActivity = () => {
      if (auth.isAuthenticated) {
        dispatch(updateLastActivity());
      }
    };

    window.addEventListener('mousemove', trackActivity);
    window.addEventListener('keydown', trackActivity);

    return () => {
      window.removeEventListener('storage', handleStorageEvent);
      window.removeEventListener('mousemove', trackActivity);
      window.removeEventListener('keydown', trackActivity);
      clearSessionMonitoring();
    };
  }, [auth.isAuthenticated, dispatch, handleStorageEvent, clearSessionMonitoring]);

  return {
    user: auth.user,
    isAuthenticated: auth.isAuthenticated,
    loading: auth.loading,
    error: auth.error,
    isPremium: auth.user?.role === 'PREMIUM_USER',
    mfaRequired: auth.user?.mfaEnabled && !auth.user?.mfaVerified,
    sessionTimeout: SESSION_TIMEOUT,
    login,
    register,
    logout,
    refreshToken,
    clearError: () => dispatch(clearError())
  };
};

export default useAuth;