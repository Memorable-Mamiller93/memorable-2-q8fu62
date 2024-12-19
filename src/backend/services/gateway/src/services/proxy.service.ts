/**
 * @fileoverview Enhanced proxy service for API Gateway with reliability patterns
 * @version 1.0.0
 * @license MIT
 */

import axios, { AxiosError, AxiosRequestConfig } from 'axios'; // ^1.4.0
import { Request, Response, NextFunction } from 'express'; // ^4.18.2
import { createProxyMiddleware, Options } from 'http-proxy-middleware'; // ^2.0.6
import winston from 'winston'; // ^3.10.0
import CircuitBreaker from 'opossum'; // ^7.1.0
import { RateLimiterRedis, RateLimiterRes } from 'rate-limiter-flexible'; // ^3.0.0
import { v4 as uuidv4 } from 'uuid'; // ^9.0.0

import { gatewayConfig, ServiceConfig } from '../config/gateway.config';
import { createErrorResponse } from '../utils/response.utils';

/**
 * Enhanced proxy options with reliability patterns
 */
interface ProxyOptions extends Options {
  circuitBreaker?: {
    failureThreshold: number;
    resetTimeout: number;
    maxFailures: number;
  };
  retry?: {
    attempts: number;
    delay: number;
  };
  rateLimit?: {
    windowMs: number;
    max: number;
  };
  healthCheck?: {
    path: string;
    interval: number;
  };
}

/**
 * Service metrics for monitoring and alerting
 */
interface ServiceMetrics {
  requestCount: number;
  errorCount: number;
  latency: number[];
  lastError?: Date;
  circuitBreakerStatus: string;
}

/**
 * Enhanced proxy service with reliability patterns and monitoring
 */
export class ProxyService {
  private readonly logger: winston.Logger;
  private readonly services: Record<string, ServiceConfig>;
  private readonly circuitBreakers: Map<string, CircuitBreaker>;
  private readonly rateLimiters: Map<string, RateLimiterRedis>;
  private readonly metrics: Map<string, ServiceMetrics>;

  constructor() {
    // Initialize logger with enhanced formatting
    this.logger = winston.createLogger({
      level: gatewayConfig.monitoring.logLevel,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'proxy-error.log', level: 'error' })
      ]
    });

    this.services = gatewayConfig.services;
    this.circuitBreakers = new Map();
    this.rateLimiters = new Map();
    this.metrics = new Map();

    this.initializeServices();
  }

  /**
   * Initialize services with reliability patterns
   */
  private initializeServices(): void {
    Object.entries(this.services).forEach(([name, config]) => {
      // Initialize circuit breaker
      if (config.circuitBreaker) {
        this.circuitBreakers.set(
          name,
          new CircuitBreaker(this.executeRequest.bind(this), {
            timeout: config.timeout,
            errorThresholdPercentage: config.circuitBreaker.failureThreshold * 100,
            resetTimeout: config.circuitBreaker.resetTimeout,
            rollingCountTimeout: config.circuitBreaker.monitorInterval
          })
        );
      }

      // Initialize rate limiter
      if (config.rateLimit) {
        this.rateLimiters.set(
          name,
          new RateLimiterRedis({
            storeClient: this.createRedisClient(),
            points: config.rateLimit.max,
            duration: config.rateLimit.windowMs / 1000,
            keyPrefix: `rl:${name}:`
          })
        );
      }

      // Initialize metrics
      this.metrics.set(name, {
        requestCount: 0,
        errorCount: 0,
        latency: [],
        circuitBreakerStatus: 'CLOSED'
      });
    });
  }

  /**
   * Create proxy middleware for a service
   */
  public createProxyMiddleware(serviceName: string, options: ProxyOptions) {
    const service = this.services[serviceName];
    if (!service) {
      throw new Error(`Service ${serviceName} not configured`);
    }

    return async (req: Request, res: Response, next: NextFunction) => {
      const traceId = uuidv4();
      req.headers['X-Trace-ID'] = traceId;

      try {
        // Rate limiting check
        if (this.rateLimiters.has(serviceName)) {
          await this.checkRateLimit(serviceName, req);
        }

        // Circuit breaker handling
        const circuitBreaker = this.circuitBreakers.get(serviceName);
        if (circuitBreaker) {
          const response = await circuitBreaker.fire({
            method: req.method,
            url: `${service.url}${req.path}`,
            headers: req.headers,
            data: req.body
          });
          return this.handleResponse(response, res, serviceName, traceId);
        }

        // Default proxy handling
        const proxyMiddleware = createProxyMiddleware({
          target: service.url,
          changeOrigin: true,
          pathRewrite: options.pathRewrite,
          onProxyReq: this.handleProxyRequest.bind(this),
          onProxyRes: this.handleProxyResponse.bind(this, serviceName),
          onError: (err, req, res) => this.handleProxyError(err, req, res, serviceName, traceId)
        });

        return proxyMiddleware(req, res, next);

      } catch (error) {
        return this.handleServiceError(error, serviceName, traceId, res);
      }
    };
  }

  /**
   * Execute HTTP request with retry logic
   */
  private async executeRequest(config: AxiosRequestConfig): Promise<any> {
    const service = this.services[config.url?.split('/')[2] || ''];
    let attempts = 0;

    while (attempts < (service?.retry?.attempts || 1)) {
      try {
        const startTime = Date.now();
        const response = await axios(config);
        this.updateMetrics(service.name, Date.now() - startTime);
        return response;
      } catch (error) {
        attempts++;
        if (attempts === (service?.retry?.attempts || 1)) {
          throw error;
        }
        await new Promise(resolve => setTimeout(resolve, service?.retry?.delay || 1000));
      }
    }
  }

  /**
   * Check rate limit for service
   */
  private async checkRateLimit(serviceName: string, req: Request): Promise<void> {
    const rateLimiter = this.rateLimiters.get(serviceName);
    if (!rateLimiter) return;

    try {
      await rateLimiter.consume(req.ip);
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      const rateLimitError = new Error('Rate limit exceeded');
      rateLimitError.name = 'RateLimitError';
      throw rateLimitError;
    }
  }

  /**
   * Handle proxy request modifications
   */
  private handleProxyRequest(proxyReq: any, req: Request): void {
    // Add correlation headers
    proxyReq.setHeader('X-Correlation-ID', req.headers['x-trace-id']);
    proxyReq.setHeader('X-Forwarded-For', req.ip);

    // Handle body modifications for POST/PUT requests
    if (['POST', 'PUT'].includes(req.method) && req.body) {
      const bodyData = JSON.stringify(req.body);
      proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData));
      proxyReq.write(bodyData);
    }
  }

  /**
   * Handle proxy response modifications
   */
  private handleProxyResponse(serviceName: string, proxyRes: any, req: Request, res: Response): void {
    // Update service metrics
    const metrics = this.metrics.get(serviceName);
    if (metrics) {
      metrics.requestCount++;
      if (proxyRes.statusCode >= 400) {
        metrics.errorCount++;
      }
    }

    // Add response headers
    res.setHeader('X-Service', serviceName);
    if (this.rateLimiters.has(serviceName)) {
      res.setHeader('X-RateLimit-Limit', this.services[serviceName].rateLimit?.max || 0);
      res.setHeader('X-RateLimit-Remaining', this.services[serviceName].rateLimit?.max || 0);
    }
  }

  /**
   * Handle proxy errors with enhanced error reporting
   */
  private handleProxyError(
    err: Error,
    req: Request,
    res: Response,
    serviceName: string,
    traceId: string
  ): void {
    this.logger.error({
      message: 'Proxy error occurred',
      error: err,
      service: serviceName,
      traceId,
      path: req.path
    });

    const metrics = this.metrics.get(serviceName);
    if (metrics) {
      metrics.errorCount++;
      metrics.lastError = new Date();
    }

    const errorResponse = createErrorResponse(
      err,
      502,
      'https://api.memorable.com/errors/proxy-error',
      req.path,
      {
        retryable: true,
        code: 'PROXY_ERROR',
        logLevel: 'error'
      }
    );

    res.status(502).json(errorResponse);
  }

  /**
   * Handle service errors with proper error mapping
   */
  private handleServiceError(
    error: any,
    serviceName: string,
    traceId: string,
    res: Response
  ): void {
    const status = error.response?.status || 500;
    const errorResponse = createErrorResponse(
      error,
      status,
      'https://api.memorable.com/errors/service-error',
      res.req?.path || '/unknown',
      {
        retryable: status >= 500,
        code: error.code || 'SERVICE_ERROR',
        logLevel: status >= 500 ? 'error' : 'warn'
      }
    );

    res.status(status).json(errorResponse);
  }

  /**
   * Update service metrics
   */
  private updateMetrics(serviceName: string, latency: number): void {
    const metrics = this.metrics.get(serviceName);
    if (metrics) {
      metrics.latency.push(latency);
      if (metrics.latency.length > 100) {
        metrics.latency.shift();
      }
    }
  }

  /**
   * Create Redis client for rate limiting
   */
  private createRedisClient() {
    // Implementation would go here - using the same Redis client
    // configuration as defined in rate-limit.config.ts
    return null; // Placeholder
  }
}

export default ProxyService;