import type { Config } from '@jest/types'; // v29.5.0

/**
 * Comprehensive Jest configuration for React.js frontend testing with TypeScript support.
 * This configuration includes:
 * - TypeScript and React testing environment setup
 * - Module resolution and path aliases
 * - Coverage reporting with thresholds
 * - Asset and style module mocking
 * - Watch plugins for development
 */
const createJestConfig = (): Config.InitialOptions => ({
  // Use ts-jest preset for TypeScript support
  preset: 'ts-jest',

  // Configure jsdom test environment for React component testing
  testEnvironment: 'jsdom',

  // Setup files to run after jest is initialized
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],

  // Module name mapper for path aliases and static assets
  moduleNameMapper: {
    // Path aliases matching tsconfig paths
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@components/(.*)$': '<rootDir>/src/components/$1',
    '^@pages/(.*)$': '<rootDir>/src/pages/$1',
    '^@hooks/(.*)$': '<rootDir>/src/hooks/$1',
    '^@utils/(.*)$': '<rootDir>/src/utils/$1',
    '^@api/(.*)$': '<rootDir>/src/api/$1',
    '^@redux/(.*)$': '<rootDir>/src/redux/$1',
    '^@styles/(.*)$': '<rootDir>/src/styles/$1',
    '^@assets/(.*)$': '<rootDir>/src/assets/$1',
    '^@types/(.*)$': '<rootDir>/src/types/$1',
    '^@constants/(.*)$': '<rootDir>/src/constants/$1',
    '^@config/(.*)$': '<rootDir>/src/config/$1',

    // Static asset and style mocks
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    '\\.(jpg|jpeg|png|gif|webp|svg)$': '<rootDir>/tests/__mocks__/fileMock.js'
  },

  // Transform configuration for TypeScript and JavaScript files
  transform: {
    '^.+\\.tsx?$': 'ts-jest',
    '^.+\\.jsx?$': 'babel-jest'
  },

  // Test file patterns
  testRegex: '(/__tests__/.*|(\\.|/)(test|spec))\\.[jt]sx?$',

  // File extensions to consider for testing
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],

  // Coverage configuration
  collectCoverage: true,
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/main.tsx',
    '!src/vite-env.d.ts'
  ],

  // Coverage thresholds
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },

  // Paths to ignore during testing
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/coverage/'
  ],

  // Watch plugins for improved development experience
  watchPlugins: [
    'jest-watch-typeahead/filename',
    'jest-watch-typeahead/testname'
  ],

  // Clear mocks automatically between every test
  clearMocks: true,

  // Maximum number of concurrent workers
  maxWorkers: '50%',

  // Verbose output
  verbose: true,

  // Fail tests on any error
  bail: 1,

  // Global timeout for tests
  testTimeout: 10000,

  // Display individual test results with timing
  reporters: ['default'],

  // Automatically restore mocks between every test
  restoreMocks: true
});

// Export the configuration
const jestConfig = createJestConfig();
export default jestConfig;