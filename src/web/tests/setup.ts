import { expect, vi } from 'vitest'; // v0.32.0
import * as matchers from '@testing-library/jest-dom'; // v5.16.5

// Extend Vitest's expect with DOM-specific matchers
expect.extend(matchers);

// Configure global test environment
declare global {
  // Define types for mocked browser APIs
  interface Window {
    IS_REACT_ACT_ENVIRONMENT: boolean;
    matchMedia: (query: string) => MediaQueryList;
  }

  // Define types for mocked observers
  interface IntersectionObserverCallback {
    (entries: IntersectionObserverEntry[], observer: IntersectionObserver): void;
  }

  interface IntersectionObserverEntry {
    boundingClientRect: DOMRectReadOnly;
    intersectionRatio: number;
    intersectionRect: DOMRectReadOnly;
    isIntersecting: boolean;
    rootBounds: DOMRectReadOnly | null;
    target: Element;
    time: number;
  }
}

/**
 * Configures the global test environment with comprehensive settings,
 * mocks, and utilities for React component testing
 */
function setupTestEnvironment(): void {
  // Configure React environment for proper act() behavior
  window.IS_REACT_ACT_ENVIRONMENT = true;

  // Mock ResizeObserver
  global.ResizeObserver = class ResizeObserver {
    constructor(callback: ResizeObserverCallback) {
      this.callback = callback;
    }
    observe() { /* Mock implementation */ }
    unobserve() { /* Mock implementation */ }
    disconnect() { /* Mock implementation */ }
    private callback: ResizeObserverCallback;
  };

  // Mock IntersectionObserver
  global.IntersectionObserver = class IntersectionObserver {
    constructor(callback: IntersectionObserverCallback) {
      this.callback = callback;
    }
    observe() { /* Mock implementation */ }
    unobserve() { /* Mock implementation */ }
    disconnect() { /* Mock implementation */ }
    private callback: IntersectionObserverCallback;
  };

  // Mock fetch API
  global.fetch = vi.fn(async (input: RequestInfo, init?: RequestInit): Promise<Response> => {
    return {
      ok: true,
      status: 200,
      json: async () => ({}),
      text: async () => '',
      blob: async () => new Blob(),
      headers: new Headers(),
    } as Response;
  });

  // Mock window.matchMedia
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));

  // Mock storage APIs
  const mockStorage = {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
    key: vi.fn(),
    length: 0,
  };

  Object.defineProperty(window, 'localStorage', {
    value: mockStorage,
  });

  Object.defineProperty(window, 'sessionStorage', {
    value: mockStorage,
  });

  // Configure custom error messages for common test failures
  Error.stackTraceLimit = 100;

  // Mock console methods for cleaner test output
  console.error = vi.fn();
  console.warn = vi.fn();
  console.log = vi.fn();

  // Configure viewport size
  Object.defineProperty(window, 'innerWidth', {
    writable: true,
    value: 1024,
  });

  Object.defineProperty(window, 'innerHeight', {
    writable: true,
    value: 768,
  });

  // Mock scroll behavior
  Object.defineProperty(window, 'scrollTo', {
    value: vi.fn(),
  });

  // Configure MutationObserver mock
  global.MutationObserver = class {
    constructor(callback: MutationCallback) {
      this.callback = callback;
    }
    observe() { /* Mock implementation */ }
    disconnect() { /* Mock implementation */ }
    takeRecords() { return []; }
    private callback: MutationCallback;
  };

  // Configure custom matchers for enhanced assertions
  expect.extend({
    toHaveBeenCalledWithMatch(received: any, ...expected: any[]) {
      const pass = vi.mocked(received).mock.calls.some(
        call => JSON.stringify(call) === JSON.stringify(expected)
      );
      return {
        pass,
        message: () =>
          `expected ${received.getMockName()} to have been called with ${JSON.stringify(expected)}`,
      };
    },
  });
}

// Initialize test environment
setupTestEnvironment();

// Export configured test utilities
export {
  expect,
  vi,
};