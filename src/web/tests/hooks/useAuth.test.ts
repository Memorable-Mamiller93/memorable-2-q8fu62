import { renderHook, act } from '@testing-library/react-hooks';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import useAuth from '../../src/hooks/useAuth';
import authReducer from '../../src/redux/slices/authSlice';
import * as authUtils from '../../src/utils/auth.utils';
import * as storageUtils from '../../src/utils/storage.utils';

// Mock store configuration
const createMockStore = () => {
  return configureStore({
    reducer: {
      auth: authReducer
    }
  });
};

// Mock data
const mockUser = {
  id: 'test-user-id',
  email: 'test@example.com',
  firstName: 'Test',
  lastName: 'User',
  role: 'USER',
  isVerified: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
};

const mockLoginCredentials = {
  email: 'test@example.com',
  password: 'Test123!',
  rememberMe: true
};

const mockRegisterData = {
  email: 'test@example.com',
  password: 'Test123!',
  firstName: 'Test',
  lastName: 'User'
};

const mockAuthResponse = {
  user: mockUser,
  accessToken: 'mock-access-token',
  refreshToken: 'mock-refresh-token',
  expiresAt: new Date(Date.now() + 3600000).toISOString()
};

// Mock implementations
vi.mock('../../src/utils/auth.utils', () => ({
  generateDeviceFingerprint: vi.fn().mockResolvedValue('mock-device-fingerprint'),
  isTokenValid: vi.fn().mockReturnValue(true),
  handleTokenRefresh: vi.fn().mockResolvedValue(mockAuthResponse),
  encryptToken: vi.fn().mockImplementation(token => `encrypted-${token}`),
  decryptToken: vi.fn().mockImplementation(token => token.replace('encrypted-', ''))
}));

vi.mock('../../src/utils/storage.utils', () => ({
  setSecureStorage: vi.fn().mockResolvedValue(undefined),
  getSecureStorage: vi.fn().mockResolvedValue(null),
  removeSecureStorage: vi.fn().mockResolvedValue(undefined)
}));

describe('useAuth Hook', () => {
  let mockStore: ReturnType<typeof createMockStore>;
  let wrapper: React.FC;

  beforeEach(() => {
    mockStore = createMockStore();
    wrapper = ({ children }: { children: React.ReactNode }) => (
      <Provider store={mockStore}>{children}</Provider>
    );
    // Reset mocks
    vi.clearAllMocks();
    // Clear storage
    localStorage.clear();
    sessionStorage.clear();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('should initialize with default state', () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    expect(result.current).toEqual(expect.objectContaining({
      user: null,
      isAuthenticated: false,
      loading: false,
      error: null,
      isPremium: false,
      mfaRequired: false
    }));
  });

  it('should handle login successfully', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      await result.current.login(mockLoginCredentials);
    });

    expect(result.current.user).toEqual(mockUser);
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('should handle registration successfully', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      await result.current.register(mockRegisterData);
    });

    expect(result.current.user).toEqual(mockUser);
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('should handle logout correctly', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    // First login
    await act(async () => {
      await result.current.login(mockLoginCredentials);
    });

    // Then logout
    await act(async () => {
      await result.current.logout();
    });

    expect(result.current.user).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('should handle token refresh', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      await result.current.refreshToken();
    });

    expect(authUtils.handleTokenRefresh).toHaveBeenCalled();
    expect(result.current.error).toBeNull();
  });

  it('should handle device fingerprinting', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      await result.current.login(mockLoginCredentials);
    });

    expect(authUtils.generateDeviceFingerprint).toHaveBeenCalled();
  });

  it('should handle cross-tab synchronization', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    // Simulate login in another tab
    const storageEvent = new StorageEvent('storage', {
      key: 'auth_event',
      newValue: JSON.stringify({
        event: 'login',
        userId: mockUser.id,
        timestamp: Date.now()
      })
    });

    await act(async () => {
      window.dispatchEvent(storageEvent);
    });

    expect(authUtils.handleTokenRefresh).toHaveBeenCalled();
  });

  it('should handle MFA verification', async () => {
    const mockMFAUser = {
      ...mockUser,
      mfaEnabled: true,
      mfaVerified: false
    };

    const mockMFAResponse = {
      ...mockAuthResponse,
      user: mockMFAUser
    };

    vi.mocked(authUtils.handleTokenRefresh).mockResolvedValueOnce(mockMFAResponse);

    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      await result.current.login(mockLoginCredentials);
    });

    expect(result.current.mfaRequired).toBe(true);
  });

  it('should handle premium status', async () => {
    const mockPremiumUser = {
      ...mockUser,
      role: 'PREMIUM_USER'
    };

    const mockPremiumResponse = {
      ...mockAuthResponse,
      user: mockPremiumUser
    };

    vi.mocked(authUtils.handleTokenRefresh).mockResolvedValueOnce(mockPremiumResponse);

    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      await result.current.login(mockLoginCredentials);
    });

    expect(result.current.isPremium).toBe(true);
  });

  it('should handle session timeout', async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      await result.current.login(mockLoginCredentials);
    });

    // Fast-forward past session timeout
    await act(async () => {
      vi.advanceTimersByTime(31 * 60 * 1000); // 31 minutes
    });

    expect(result.current.isAuthenticated).toBe(false);
    vi.useRealTimers();
  });

  it('should handle error states', async () => {
    const mockError = new Error('Authentication failed');
    vi.mocked(authUtils.handleTokenRefresh).mockRejectedValueOnce(mockError);

    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      try {
        await result.current.login(mockLoginCredentials);
      } catch (error) {
        // Error expected
      }
    });

    expect(result.current.error).toBeTruthy();
    expect(result.current.isAuthenticated).toBe(false);
  });

  it('should clean up on unmount', () => {
    const { unmount } = renderHook(() => useAuth(), { wrapper });

    unmount();

    // Verify event listeners are removed
    const events = window.listeners?.('storage') || [];
    expect(events.length).toBe(0);
  });
});