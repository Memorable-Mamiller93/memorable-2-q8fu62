/**
 * @fileoverview Integration and unit tests for API Gateway service
 * @version 1.0.0
 * @license MIT
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals'; // ^29.6.2
import request from 'supertest'; // ^6.3.3
import nock from 'nock'; // ^13.3.2
import Redis from 'ioredis'; // ^5.3.2
import { StatusCodes } from 'http-status-codes'; // ^2.2.0

import app from '../src/app';
import { errorHandler, ValidationError } from '../src/middleware/error.middleware';
import { createRateLimitMiddleware } from '../src/middleware/rate-limit.middleware';
import { gatewayConfig } from '../src/config/gateway.config';

// Test configuration
const TEST_TIMEOUT = 30000;
const RATE_LIMIT_WINDOW = 60000;
const MAX_REQUESTS = 5;

// Mock Redis client for rate limiting tests
let redisClient: Redis;

/**
 * Test server setup and configuration
 */
const setupTestServer = async (): Promise<void> => {
  // Initialize Redis client for testing
  redisClient = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: Number(process.env.REDIS_PORT) || 6379,
    db: 15, // Use separate DB for testing
    lazyConnect: true
  });

  // Clear all rate limit keys
  await redisClient.flushdb();

  // Reset HTTP mocks
  nock.cleanAll();

  // Configure service mocks
  const servicesMock = {
    auth: nock(gatewayConfig.services.auth.url),
    book: nock(gatewayConfig.services.book.url),
    ai: nock(gatewayConfig.services.ai.url),
    order: nock(gatewayConfig.services.order.url),
    print: nock(gatewayConfig.services.print.url)
  };

  // Setup basic service health checks
  Object.values(servicesMock).forEach(mock => {
    mock.get('/health').reply(200, { status: 'healthy' });
  });
};

/**
 * Test server cleanup
 */
const cleanupTestServer = async (): Promise<void> => {
  await redisClient.quit();
  nock.cleanAll();
};

describe('API Gateway Integration Tests', () => {
  beforeEach(setupTestServer);
  afterEach(cleanupTestServer);

  describe('Request Routing', () => {
    test('should route requests to correct services with proper headers', async () => {
      const correlationId = '123e4567-e89b-12d3-a456-426614174000';
      const testToken = 'Bearer test-token';

      // Mock service endpoints
      nock(gatewayConfig.services.book.url)
        .get('/api/v1/books')
        .matchHeader('x-correlation-id', correlationId)
        .matchHeader('authorization', testToken)
        .reply(200, { books: [] });

      const response = await request(app)
        .get('/api/v1/books')
        .set('Authorization', testToken)
        .set('x-correlation-id', correlationId);

      expect(response.status).toBe(StatusCodes.OK);
      expect(response.body.success).toBe(true);
      expect(response.headers['content-type']).toContain('application/problem+json');
    }, TEST_TIMEOUT);

    test('should handle service timeouts with circuit breaker', async () => {
      // Mock slow service with timeout
      nock(gatewayConfig.services.ai.url)
        .post('/api/v1/generate/story')
        .delay(6000) // Exceed service timeout
        .reply(200);

      const response = await request(app)
        .post('/api/v1/generate/story')
        .send({ prompt: 'test story' });

      expect(response.status).toBe(StatusCodes.GATEWAY_TIMEOUT);
      expect(response.body.error.type).toBe('https://api.memorable.com/errors/timeout');
      expect(response.body.error.retryable).toBe(true);
    }, TEST_TIMEOUT);
  });

  describe('Rate Limiting', () => {
    test('should enforce rate limits for AI endpoints', async () => {
      const endpoint = '/api/v1/generate/illustration';
      const requests = Array(MAX_REQUESTS + 1).fill(null);

      // Mock AI service response
      nock(gatewayConfig.services.ai.url)
        .post('/api/v1/generate/illustration')
        .times(MAX_REQUESTS)
        .reply(200, { url: 'test-url' });

      // Send requests up to limit
      for (let i = 0; i < MAX_REQUESTS; i++) {
        const response = await request(app)
          .post(endpoint)
          .send({ prompt: 'test illustration' });

        expect(response.status).toBe(StatusCodes.OK);
        expect(response.headers['x-ratelimit-remaining']).toBe(String(MAX_REQUESTS - i - 1));
      }

      // Verify rate limit exceeded
      const limitExceededResponse = await request(app)
        .post(endpoint)
        .send({ prompt: 'test illustration' });

      expect(limitExceededResponse.status).toBe(StatusCodes.TOO_MANY_REQUESTS);
      expect(limitExceededResponse.body.error.type).toBe('https://api.memorable.com/errors/rate-limit');
      expect(limitExceededResponse.headers['retry-after']).toBeDefined();
    }, TEST_TIMEOUT);

    test('should reset rate limits after window expires', async () => {
      const endpoint = '/api/v1/generate/story';

      // Mock service response
      nock(gatewayConfig.services.ai.url)
        .post('/api/v1/generate/story')
        .reply(200, { story: 'test story' });

      // Exhaust rate limit
      for (let i = 0; i < MAX_REQUESTS; i++) {
        await request(app).post(endpoint).send({ prompt: 'test' });
      }

      // Wait for rate limit window to expire
      await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_WINDOW));

      // Verify limit reset
      const response = await request(app)
        .post(endpoint)
        .send({ prompt: 'test story' });

      expect(response.status).toBe(StatusCodes.OK);
      expect(response.headers['x-ratelimit-remaining']).toBe(String(MAX_REQUESTS - 1));
    }, TEST_TIMEOUT * 2);
  });

  describe('Error Handling', () => {
    test('should return RFC 7807 compliant error responses', async () => {
      const validationError = new ValidationError('Invalid request parameters');
      validationError.validationErrors = [
        { field: 'prompt', message: 'Required field missing', code: 'FIELD_REQUIRED', constraint: 'required', value: undefined }
      ];

      const response = await request(app)
        .post('/api/v1/generate/story')
        .send({});

      expect(response.status).toBe(StatusCodes.BAD_REQUEST);
      expect(response.body.error).toMatchObject({
        type: 'https://api.memorable.com/errors/validation',
        title: 'ValidationError',
        status: StatusCodes.BAD_REQUEST,
        errors: validationError.validationErrors
      });
      expect(response.headers['content-type']).toContain('application/problem+json');
    });

    test('should sanitize error messages in production', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      // Mock service error
      nock(gatewayConfig.services.book.url)
        .get('/api/v1/books/123')
        .reply(500, { message: 'Internal database error' });

      const response = await request(app)
        .get('/api/v1/books/123');

      expect(response.status).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
      expect(response.body.error.detail).toBe('An unexpected error occurred');
      expect(response.body.error.type).toBe('https://api.memorable.com/errors/internal-error');

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('Performance Monitoring', () => {
    test('should track request processing time', async () => {
      const response = await request(app)
        .get('/health');

      expect(response.status).toBe(StatusCodes.OK);
      expect(response.body.metadata.processingTime).toBeDefined();
      expect(typeof response.body.metadata.processingTime).toBe('number');
      expect(response.body.metadata.processingTime).toBeLessThan(3000); // 3s SLA
    });
  });
});