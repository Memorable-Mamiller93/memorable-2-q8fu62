/**
 * @fileoverview Enhanced Redux hooks with type safety and performance optimizations
 * Provides strongly-typed dispatch and selector hooks with comprehensive error handling
 * and performance monitoring for the Memorable platform frontend
 * @version 1.0.0
 */

import { TypedUseSelectorHook, useDispatch, useSelector } from 'react-redux'; // v8.1.1
import { useMemo } from 'react'; // v18.2.0
import type { RootState, AppDispatch } from './store';

/**
 * Performance monitoring configuration
 */
const PERFORMANCE_CONFIG = {
  SLOW_SELECTOR_THRESHOLD: 3, // milliseconds
  ENABLE_MONITORING: process.env.NODE_ENV === 'development',
};

/**
 * Error messages for development
 */
const ERROR_MESSAGES = {
  PROVIDER_MISSING: 'Redux hooks must be used within a Provider',
  SELECTOR_ERROR: 'Selector execution failed',
  DISPATCH_ERROR: 'Action dispatch failed',
} as const;

/**
 * Enhanced dispatch hook with error boundary support and development tools
 * @throws {Error} When used outside Redux Provider
 * @returns Typed dispatch function for Redux actions
 */
export const useAppDispatch = (): AppDispatch => {
  // Validate Redux context
  const dispatch = useDispatch<AppDispatch>();
  
  if (process.env.NODE_ENV === 'development') {
    // Enhanced dispatch with development tools
    return (action: Parameters<AppDispatch>[0]) => {
      try {
        const start = performance.now();
        const result = dispatch(action);
        const duration = performance.now() - start;

        // Log slow dispatches
        if (duration > PERFORMANCE_CONFIG.SLOW_SELECTOR_THRESHOLD) {
          console.warn(
            `[Redux] Slow action dispatch: ${action.type} took ${duration.toFixed(2)}ms`
          );
        }

        return result;
      } catch (error) {
        console.error('[Redux Dispatch Error]', {
          action,
          error,
          timestamp: new Date().toISOString(),
        });
        throw new Error(ERROR_MESSAGES.DISPATCH_ERROR);
      }
    };
  }

  return dispatch;
};

/**
 * Enhanced selector hook with performance optimizations and error handling
 * @throws {Error} When used outside Redux Provider
 * @returns Typed selector hook for accessing Redux state
 */
export const useAppSelector: TypedUseSelectorHook<RootState> = <TSelected>(
  selector: (state: RootState) => TSelected,
  equalityFn?: (left: TSelected, right: TSelected) => boolean
) => {
  // Memoize selector for consistent reference
  const memoizedSelector = useMemo(() => {
    if (PERFORMANCE_CONFIG.ENABLE_MONITORING) {
      // Wrap selector with performance monitoring
      return (state: RootState) => {
        const start = performance.now();
        try {
          const result = selector(state);
          const duration = performance.now() - start;

          // Log slow selectors
          if (duration > PERFORMANCE_CONFIG.SLOW_SELECTOR_THRESHOLD) {
            console.warn(
              `[Redux] Slow selector execution took ${duration.toFixed(2)}ms`,
              { selector: selector.name || 'anonymous' }
            );
          }

          return result;
        } catch (error) {
          console.error('[Redux Selector Error]', {
            selector: selector.name || 'anonymous',
            error,
            timestamp: new Date().toISOString(),
          });
          throw new Error(ERROR_MESSAGES.SELECTOR_ERROR);
        }
      };
    }
    return selector;
  }, [selector]);

  try {
    return useSelector(memoizedSelector, equalityFn);
  } catch (error) {
    console.error('[Redux Hook Error]', {
      hook: 'useAppSelector',
      error,
      timestamp: new Date().toISOString(),
    });
    throw new Error(ERROR_MESSAGES.PROVIDER_MISSING);
  }
};