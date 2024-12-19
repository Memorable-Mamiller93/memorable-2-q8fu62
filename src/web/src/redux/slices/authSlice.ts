/**
 * @fileoverview Enhanced Redux slice for authentication state management
 * Implements comprehensive auth features including session management,
 * token refresh, premium status tracking, and cross-tab synchronization
 * @version 1.0.0
 */

import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'; // v1.9.5
import { 
  AuthState, 
  User, 
  LoginCredentials, 
  RegisterData, 
  AuthResponse, 
  PremiumStatus,
  SessionStatus,
  AuthError 
} from '../../types/user.types';
import { 
  login, 
  register, 
  logout, 
  refreshToken, 
  validateSession 
} from '../../api/auth.api';
import {
  setAuthTokens,
  clearAuthTokens,
  handleTokenRefresh,
  getDeviceFingerprint,
  broadcastAuthEvent
} from '../../utils/auth.utils';

// Initial state with comprehensive session tracking
const initialState: AuthState = {
  user: null,
  isAuthenticated: false,
  loading: false,
  error: null,
  sessionExpiry: null,
  refreshing: false,
  lastActivity: null,
  premiumStatus: 'none'
};

// Enhanced async thunk for user login with device fingerprinting
export const loginUser = createAsyncThunk<AuthResponse, LoginCredentials>(
  'auth/login',
  async (credentials, { rejectWithValue }) => {
    try {
      const deviceFingerprint = await getDeviceFingerprint();
      const response = await login({
        ...credentials,
        deviceFingerprint
      });

      await setAuthTokens(response, credentials.rememberMe);
      broadcastAuthEvent('login', response.user.id);

      return response;
    } catch (error) {
      return rejectWithValue({
        code: error.code || 'AUTH_ERROR',
        message: error.message || 'Login failed',
        details: error.details
      } as AuthError);
    }
  }
);

// Enhanced async thunk for user registration with immediate session setup
export const registerUser = createAsyncThunk<AuthResponse, RegisterData>(
  'auth/register',
  async (data, { rejectWithValue }) => {
    try {
      const deviceFingerprint = await getDeviceFingerprint();
      const response = await register({
        ...data,
        deviceFingerprint
      });

      await setAuthTokens(response, true);
      broadcastAuthEvent('register', response.user.id);

      return response;
    } catch (error) {
      return rejectWithValue({
        code: error.code || 'REGISTRATION_ERROR',
        message: error.message || 'Registration failed',
        details: error.details
      } as AuthError);
    }
  }
);

// Enhanced async thunk for secure logout across all tabs
export const logoutUser = createAsyncThunk<void, void>(
  'auth/logout',
  async (_, { rejectWithValue }) => {
    try {
      await logout();
      await clearAuthTokens();
      broadcastAuthEvent('logout');
    } catch (error) {
      return rejectWithValue({
        code: error.code || 'LOGOUT_ERROR',
        message: error.message || 'Logout failed',
        details: error.details
      } as AuthError);
    }
  }
);

// Enhanced async thunk for preemptive token refresh
export const refreshUserToken = createAsyncThunk<AuthResponse, void>(
  'auth/refresh',
  async (_, { rejectWithValue }) => {
    try {
      const response = await handleTokenRefresh();
      return response;
    } catch (error) {
      return rejectWithValue({
        code: error.code || 'REFRESH_ERROR',
        message: error.message || 'Token refresh failed',
        details: error.details
      } as AuthError);
    }
  }
);

// Enhanced auth slice with comprehensive state management
const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setUser: (state, action: PayloadAction<User>) => {
      state.user = action.payload;
      state.isAuthenticated = true;
    },
    updatePremiumStatus: (state, action: PayloadAction<PremiumStatus>) => {
      state.premiumStatus = action.payload;
    },
    updateSessionExpiry: (state, action: PayloadAction<number>) => {
      state.sessionExpiry = action.payload;
    },
    updateLastActivity: (state) => {
      state.lastActivity = Date.now();
    },
    clearError: (state) => {
      state.error = null;
    },
    resetState: () => initialState
  },
  extraReducers: (builder) => {
    // Login cases
    builder.addCase(loginUser.pending, (state) => {
      state.loading = true;
      state.error = null;
    });
    builder.addCase(loginUser.fulfilled, (state, action) => {
      state.loading = false;
      state.isAuthenticated = true;
      state.user = action.payload.user;
      state.sessionExpiry = new Date(action.payload.expiresAt).getTime();
      state.lastActivity = Date.now();
      state.premiumStatus = action.payload.user.role === 'PREMIUM_USER' ? 'active' : 'none';
    });
    builder.addCase(loginUser.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload as AuthError;
    });

    // Register cases
    builder.addCase(registerUser.pending, (state) => {
      state.loading = true;
      state.error = null;
    });
    builder.addCase(registerUser.fulfilled, (state, action) => {
      state.loading = false;
      state.isAuthenticated = true;
      state.user = action.payload.user;
      state.sessionExpiry = new Date(action.payload.expiresAt).getTime();
      state.lastActivity = Date.now();
    });
    builder.addCase(registerUser.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload as AuthError;
    });

    // Logout cases
    builder.addCase(logoutUser.pending, (state) => {
      state.loading = true;
    });
    builder.addCase(logoutUser.fulfilled, () => initialState);
    builder.addCase(logoutUser.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload as AuthError;
    });

    // Token refresh cases
    builder.addCase(refreshUserToken.pending, (state) => {
      state.refreshing = true;
    });
    builder.addCase(refreshUserToken.fulfilled, (state, action) => {
      state.refreshing = false;
      state.sessionExpiry = new Date(action.payload.expiresAt).getTime();
      state.lastActivity = Date.now();
    });
    builder.addCase(refreshUserToken.rejected, (state, action) => {
      state.refreshing = false;
      state.error = action.payload as AuthError;
      state.isAuthenticated = false;
      state.user = null;
    });
  }
});

// Export actions
export const {
  setUser,
  updatePremiumStatus,
  updateSessionExpiry,
  updateLastActivity,
  clearError,
  resetState
} = authSlice.actions;

// Enhanced selectors with memoization potential
export const selectAuth = (state: { auth: AuthState }) => state.auth;
export const selectPremiumStatus = (state: { auth: AuthState }) => state.auth.premiumStatus;
export const selectSessionStatus = (state: { auth: AuthState }): SessionStatus => {
  const { sessionExpiry, lastActivity } = state.auth;
  if (!sessionExpiry || !lastActivity) return 'inactive';
  if (Date.now() > sessionExpiry) return 'expired';
  if (Date.now() - lastActivity > 30 * 60 * 1000) return 'idle';
  return 'active';
};

export default authSlice.reducer;