// @ts-jest/types version: ^29.6.0
// ts-jest version: ^29.6.0

import type { Config } from '@jest/types';
import { pathsToModuleNameMapper } from 'ts-jest';
import { compilerOptions } from './tsconfig.json';

/**
 * Root Jest configuration for the backend monorepo.
 * Provides shared test configuration and settings for all microservices.
 * Implements comprehensive coverage reporting and AI service testing support.
 */
const jestConfig: Config.InitialOptions = {
  // Use ts-jest preset for TypeScript support
  preset: 'ts-jest',

  // Node environment for backend services
  testEnvironment: 'node',

  // Root directory for test discovery
  rootDir: '.',

  // Supported file extensions
  moduleFileExtensions: [
    'js',
    'json',
    'ts'
  ],

  // Test file pattern matching
  testRegex: '.*\\.spec\\.ts$',

  // TypeScript transformation settings
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest'
  },

  // Files to collect coverage from
  collectCoverageFrom: [
    '**/*.(t|j)s',
    '!**/node_modules/**',
    '!**/dist/**',
    '!**/coverage/**',
    '!**/*.mock.ts',
    '!**/*.interface.ts',
    '!**/*.dto.ts',
    '!**/*.entity.ts',
    '!**/index.ts'
  ],

  // Coverage output configuration
  coverageDirectory: './coverage',
  coverageReporters: [
    'json',
    'lcov',
    'text',
    'clover',
    'html'
  ],

  // Coverage thresholds enforcement
  coverageThreshold: {
    global: {
      statements: 80,
      branches: 70,
      functions: 80,
      lines: 80
    },
    './services/ai/src/': {
      statements: 85,
      branches: 75,
      functions: 85,
      lines: 85
    },
    './services/auth/src/': {
      statements: 90,
      branches: 80,
      functions: 90,
      lines: 90
    }
  },

  // Paths to ignore during testing
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/__mocks__/',
    '/coverage/',
    '/e2e/'
  ],

  // Module path mapping for service imports
  moduleNameMapper: {
    '@ai/(.*)': '<rootDir>/services/ai/src/$1',
    '@auth/(.*)': '<rootDir>/services/auth/src/$1',
    '@book/(.*)': '<rootDir>/services/book/src/$1',
    '@gateway/(.*)': '<rootDir>/services/gateway/src/$1',
    '@order/(.*)': '<rootDir>/services/order/src/$1',
    '@print/(.*)': '<rootDir>/services/print/src/$1',
    '@shared/(.*)': '<rootDir>/shared/$1',
    ...pathsToModuleNameMapper(compilerOptions.paths, { prefix: '<rootDir>/' })
  },

  // Detailed test output
  verbose: true,

  // Test timeout setting (30 seconds)
  testTimeout: 30000,

  // Multi-project configuration for microservices
  projects: [
    '<rootDir>/services/*/jest.config.ts'
  ],

  // Global settings for ts-jest
  globals: {
    'ts-jest': {
      tsconfig: './tsconfig.json',
      diagnostics: true,
      isolatedModules: true,
      astTransformers: {
        before: [
          {
            path: 'ts-jest-mock-import-meta',
            options: { metaObjectReplacement: { url: 'https://memorable.ai' } }
          }
        ]
      }
    }
  },

  // Setup files to run before tests
  setupFilesAfterEnv: [
    '<rootDir>/jest.setup.ts'
  ],

  // Parallel test execution configuration
  maxWorkers: '50%',

  // Custom test environment configuration
  testEnvironmentOptions: {
    url: 'http://localhost'
  },

  // Fail tests on any error
  bail: 1,

  // Clear mocks between tests
  clearMocks: true,

  // Display individual test results
  displayName: {
    name: 'MEMORABLE-BACKEND',
    color: 'blue'
  },

  // Enable code coverage collection
  collectCoverage: true,

  // Error on snapshot differences
  errorOnDeprecated: true,

  // Detect open handles
  detectOpenHandles: true,

  // Detect memory leaks
  detectLeaks: true,

  // Cache test results for faster reruns
  cache: true,

  // Custom reporters for CI integration
  reporters: [
    'default',
    ['jest-junit', {
      outputDirectory: 'coverage/junit',
      outputName: 'junit.xml',
      classNameTemplate: '{classname}',
      titleTemplate: '{title}',
      ancestorSeparator: ' › ',
      usePathForSuiteName: true
    }]
  ]
};

export default jestConfig;