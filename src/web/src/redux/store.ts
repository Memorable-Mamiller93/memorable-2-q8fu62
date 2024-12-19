/**
 * @fileoverview Redux store configuration for the Memorable platform
 * Implements advanced state management with performance optimizations,
 * type safety, and secure state persistence
 * @version 1.0.0
 */

import { 
  configureStore, 
  combineReducers, 
  getDefaultMiddleware,
  Middleware,
  Action,
  ThunkAction
} from '@reduxjs/toolkit'; // v1.9.5
import { 
  persistStore, 
  persistReducer,
  FLUSH,
  REHYDRATE,
  PAUSE,
  PERSIST,
  PURGE,
  REGISTER,
  createTransform
} from 'redux-persist'; // v6.0.0
import storage from 'redux-persist/lib/storage'; // v6.0.0
import * as CryptoJS from 'crypto-js'; // v4.1.1

// Import reducers
import authReducer from './slices/authSlice';
import bookReducer from './slices/bookSlice';
import orderReducer from './slices/orderSlice';
import themeReducer from './slices/themeSlice';
import uiReducer from './slices/uiSlice';

// Constants
const ENCRYPTION_KEY = process.env.REACT_APP_STORE_ENCRYPTION_KEY || 'default-key';
const STORE_VERSION = 1;
const STORE_KEY = 'memorable_store';

/**
 * Custom transform for encrypting sensitive data before persistence
 */
const encryptTransform = createTransform(
  // Transform state on its way to being serialized and persisted
  (inboundState, key) => {
    if (key === 'auth') {
      const encrypted = CryptoJS.AES.encrypt(
        JSON.stringify(inboundState),
        ENCRYPTION_KEY
      ).toString();
      return { encrypted };
    }
    return inboundState;
  },
  // Transform state being rehydrated
  (outboundState, key) => {
    if (key === 'auth' && outboundState.encrypted) {
      const decrypted = CryptoJS.AES.decrypt(
        outboundState.encrypted,
        ENCRYPTION_KEY
      ).toString(CryptoJS.enc.Utf8);
      return JSON.parse(decrypted);
    }
    return outboundState;
  },
  { whitelist: ['auth'] }
);

/**
 * Redux persist configuration with selective persistence
 */
const persistConfig = {
  key: STORE_KEY,
  version: STORE_VERSION,
  storage,
  whitelist: ['auth', 'theme', 'ui'], // Only persist these reducers
  blacklist: ['book', 'order'], // Never persist these reducers
  transforms: [encryptTransform],
  migrate: (state: any) => {
    // Handle store migrations between versions
    if (state._persist.version < STORE_VERSION) {
      // Perform migration logic here
      return Promise.resolve(state);
    }
    return Promise.resolve(state);
  },
  debug: process.env.NODE_ENV === 'development',
};

/**
 * Combined root reducer with type safety
 */
const rootReducer = combineReducers({
  auth: authReducer,
  book: bookReducer,
  order: orderReducer,
  theme: themeReducer,
  ui: uiReducer,
});

/**
 * Performance monitoring middleware
 */
const performanceMiddleware: Middleware = () => next => action => {
  const start = performance.now();
  const result = next(action);
  const duration = performance.now() - start;

  if (duration > 16) { // Monitor actions taking longer than one frame (16ms)
    console.warn(`Slow action: ${action.type} took ${duration.toFixed(2)}ms`);
  }

  return result;
};

/**
 * Error tracking middleware
 */
const errorTrackingMiddleware: Middleware = () => next => action => {
  try {
    return next(action);
  } catch (error) {
    console.error('Action error:', {
      action,
      error,
      timestamp: new Date().toISOString(),
    });
    throw error;
  }
};

/**
 * Configure and create the Redux store
 */
const configureAppStore = () => {
  const persistedReducer = persistReducer(persistConfig, rootReducer);

  const middleware = getDefaultMiddleware({
    serializableCheck: {
      ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
    },
    immutableCheck: true,
    thunk: true,
  }).concat(performanceMiddleware, errorTrackingMiddleware);

  const store = configureStore({
    reducer: persistedReducer,
    middleware,
    devTools: process.env.NODE_ENV !== 'production',
    preloadedState: undefined,
    enhancers: [],
  });

  // Enable hot module replacement for reducers in development
  if (process.env.NODE_ENV === 'development' && module.hot) {
    module.hot.accept('./slices', () => {
      store.replaceReducer(persistedReducer);
    });
  }

  return store;
};

// Create store instance
export const store = configureAppStore();
export const persistor = persistStore(store);

// Export types
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
export type AppThunk<ReturnType = void> = ThunkAction<
  ReturnType,
  RootState,
  unknown,
  Action<string>
>;

// Export store instance and types
export default store;