/**
 * @fileoverview Comprehensive test suite for authentication Redux slice
 * Tests user authentication state management, actions, reducers, token handling,
 * and cross-tab synchronization
 * @version 1.0.0
 */

import { configureStore } from '@reduxjs/toolkit'; // v1.9.5
import { describe, it, expect, beforeEach, jest, afterEach } from '@jest/globals'; // v29.5.0

import authReducer, {
  loginUser,
  registerUser,
  logoutUser,
  refreshUserToken,
  selectAuth,
  updatePremiumStatus,
  updateSessionExpiry,
  updateLastActivity,
  clearError,
  resetState
} from '../../../src/redux/slices/authSlice';

import type {
  User,
  LoginCredentials,
  RegisterData,
  AuthState,
  AuthResponse,
  UserRole
} from '../../../src/types/user.types';

// Mock API functions
jest.mock('../../../src/api/auth.api', () => ({
  login: jest.fn(),
  register: jest.fn(),
  logout: jest.fn(),
  refreshToken: jest.fn()
}));

// Mock auth utilities
jest.mock('../../../src/utils/auth.utils', () => ({
  setAuthTokens: jest.fn(),
  clearAuthTokens: jest.fn(),
  handleTokenRefresh: jest.fn(),
  getDeviceFingerprint: jest.fn().mockResolvedValue('mock-device-id'),
  broadcastAuthEvent: jest.fn()
}));

describe('Auth Slice', () => {
  let store: ReturnType<typeof createTestStore>;
  
  // Mock user data
  const mockUser: User = {
    id: 'test-id',
    email: 'test@example.com',
    firstName: 'Test',
    lastName: 'User',
    role: UserRole.USER,
    isVerified: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  // Mock auth response
  const mockAuthResponse: AuthResponse = {
    user: mockUser,
    accessToken: 'mock-access-token',
    refreshToken: 'mock-refresh-token',
    expiresAt: new Date(Date.now() + 3600000).toISOString() // 1 hour from now
  };

  // Create test store
  const createTestStore = () => {
    return configureStore({
      reducer: {
        auth: authReducer
      }
    });
  };

  beforeEach(() => {
    store = createTestStore();
    jest.clearAllMocks();
  });

  describe('Initial State', () => {
    it('should have correct initial state', () => {
      const state = store.getState().auth;
      expect(state).toEqual({
        user: null,
        isAuthenticated: false,
        loading: false,
        error: null,
        sessionExpiry: null,
        refreshing: false,
        lastActivity: null,
        premiumStatus: 'none'
      });
    });
  });

  describe('Authentication Flow', () => {
    const mockLoginCredentials: LoginCredentials = {
      email: 'test@example.com',
      password: 'password123',
      rememberMe: true
    };

    const mockRegisterData: RegisterData = {
      email: 'test@example.com',
      password: 'password123',
      firstName: 'Test',
      lastName: 'User'
    };

    describe('Login', () => {
      it('should handle successful login', async () => {
        // Mock successful login
        require('../../../src/api/auth.api').login.mockResolvedValueOnce(mockAuthResponse);

        // Dispatch login action
        await store.dispatch(loginUser(mockLoginCredentials));
        const state = store.getState().auth;

        // Verify state updates
        expect(state.user).toEqual(mockUser);
        expect(state.isAuthenticated).toBe(true);
        expect(state.loading).toBe(false);
        expect(state.error).toBeNull();
        expect(state.sessionExpiry).toBeDefined();
        expect(state.lastActivity).toBeDefined();
      });

      it('should handle login failure', async () => {
        const mockError = {
          code: 'AUTH_ERROR',
          message: 'Invalid credentials',
          details: {}
        };

        // Mock failed login
        require('../../../src/api/auth.api').login.mockRejectedValueOnce(mockError);

        // Dispatch login action
        await store.dispatch(loginUser(mockLoginCredentials));
        const state = store.getState().auth;

        // Verify error state
        expect(state.user).toBeNull();
        expect(state.isAuthenticated).toBe(false);
        expect(state.loading).toBe(false);
        expect(state.error).toEqual(mockError);
      });
    });

    describe('Registration', () => {
      it('should handle successful registration', async () => {
        // Mock successful registration
        require('../../../src/api/auth.api').register.mockResolvedValueOnce(mockAuthResponse);

        // Dispatch register action
        await store.dispatch(registerUser(mockRegisterData));
        const state = store.getState().auth;

        // Verify state updates
        expect(state.user).toEqual(mockUser);
        expect(state.isAuthenticated).toBe(true);
        expect(state.loading).toBe(false);
        expect(state.error).toBeNull();
      });

      it('should handle registration failure', async () => {
        const mockError = {
          code: 'REGISTRATION_ERROR',
          message: 'Email already exists',
          details: {}
        };

        // Mock failed registration
        require('../../../src/api/auth.api').register.mockRejectedValueOnce(mockError);

        // Dispatch register action
        await store.dispatch(registerUser(mockRegisterData));
        const state = store.getState().auth;

        // Verify error state
        expect(state.user).toBeNull();
        expect(state.isAuthenticated).toBe(false);
        expect(state.loading).toBe(false);
        expect(state.error).toEqual(mockError);
      });
    });

    describe('Logout', () => {
      it('should handle successful logout', async () => {
        // Set initial authenticated state
        store.dispatch({ type: 'auth/setUser', payload: mockUser });

        // Mock successful logout
        require('../../../src/api/auth.api').logout.mockResolvedValueOnce(undefined);

        // Dispatch logout action
        await store.dispatch(logoutUser());
        const state = store.getState().auth;

        // Verify state reset
        expect(state.user).toBeNull();
        expect(state.isAuthenticated).toBe(false);
        expect(state.loading).toBe(false);
        expect(state.error).toBeNull();
      });
    });

    describe('Token Refresh', () => {
      it('should handle successful token refresh', async () => {
        // Mock successful token refresh
        require('../../../src/utils/auth.utils').handleTokenRefresh.mockResolvedValueOnce(mockAuthResponse);

        // Dispatch refresh action
        await store.dispatch(refreshUserToken());
        const state = store.getState().auth;

        // Verify state updates
        expect(state.refreshing).toBe(false);
        expect(state.sessionExpiry).toBeDefined();
        expect(state.lastActivity).toBeDefined();
      });

      it('should handle token refresh failure', async () => {
        const mockError = {
          code: 'REFRESH_ERROR',
          message: 'Token refresh failed',
          details: {}
        };

        // Mock failed token refresh
        require('../../../src/utils/auth.utils').handleTokenRefresh.mockRejectedValueOnce(mockError);

        // Dispatch refresh action
        await store.dispatch(refreshUserToken());
        const state = store.getState().auth;

        // Verify error state
        expect(state.refreshing).toBe(false);
        expect(state.error).toEqual(mockError);
        expect(state.isAuthenticated).toBe(false);
        expect(state.user).toBeNull();
      });
    });
  });

  describe('State Updates', () => {
    it('should update premium status', () => {
      store.dispatch(updatePremiumStatus('active'));
      const state = store.getState().auth;
      expect(state.premiumStatus).toBe('active');
    });

    it('should update session expiry', () => {
      const expiryTime = Date.now() + 3600000;
      store.dispatch(updateSessionExpiry(expiryTime));
      const state = store.getState().auth;
      expect(state.sessionExpiry).toBe(expiryTime);
    });

    it('should update last activity', () => {
      const before = Date.now();
      store.dispatch(updateLastActivity());
      const state = store.getState().auth;
      const after = Date.now();
      
      expect(state.lastActivity).toBeGreaterThanOrEqual(before);
      expect(state.lastActivity).toBeLessThanOrEqual(after);
    });

    it('should clear error state', () => {
      // Set initial error state
      store.dispatch({ 
        type: 'auth/loginUser/rejected',
        payload: { code: 'AUTH_ERROR', message: 'Test error' }
      });

      store.dispatch(clearError());
      const state = store.getState().auth;
      expect(state.error).toBeNull();
    });

    it('should reset state', () => {
      // Set some state
      store.dispatch({ type: 'auth/setUser', payload: mockUser });
      
      store.dispatch(resetState());
      const state = store.getState().auth;
      expect(state).toEqual({
        user: null,
        isAuthenticated: false,
        loading: false,
        error: null,
        sessionExpiry: null,
        refreshing: false,
        lastActivity: null,
        premiumStatus: 'none'
      });
    });
  });

  describe('Selectors', () => {
    it('should select auth state', () => {
      const state = store.getState();
      const authState = selectAuth(state);
      expect(authState).toBe(state.auth);
    });
  });
});