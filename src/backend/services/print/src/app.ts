// @package express ^4.18.2
import express, { Express, Request, Response, NextFunction } from 'express';
// @package cors ^2.8.5
import cors from 'cors';
// @package helmet ^7.0.0
import helmet from 'helmet';
// @package morgan ^1.10.0
import morgan from 'morgan';
// @package compression ^1.7.4
import compression from 'compression';
// @package express-rate-limit ^6.9.0
import rateLimit from 'express-rate-limit';

import { printRouter } from './routes/print.routes';
import { pool } from './config/database.config';
import { printerQualityConfig } from './config/printer.config';

/**
 * PrintServiceApp class implementing enterprise-grade print service
 * with ISO compliance and enhanced security measures
 */
export class PrintServiceApp {
  private readonly app: Express;
  private readonly port: number;
  private readonly healthMetrics: {
    startTime: Date;
    totalRequests: number;
    activeConnections: number;
  };

  constructor() {
    this.app = express();
    this.port = parseInt(process.env.PORT || '3004', 10);
    this.healthMetrics = {
      startTime: new Date(),
      totalRequests: 0,
      activeConnections: 0
    };
  }

  /**
   * Configures security middleware and request processing
   */
  private configureMiddleware(): void {
    // Security headers
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'"],
          imgSrc: ["'self'", 'data:', 'https:'],
          connectSrc: ["'self'"],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          frameSrc: ["'none'"]
        }
      },
      crossOriginEmbedderPolicy: true,
      crossOriginOpenerPolicy: true,
      crossOriginResourcePolicy: { policy: "same-site" },
      dnsPrefetchControl: { allow: false },
      frameguard: { action: "deny" },
      hidePoweredBy: true,
      hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
      ieNoOpen: true,
      noSniff: true,
      referrerPolicy: { policy: "strict-origin-when-cross-origin" },
      xssFilter: true
    }));

    // CORS configuration
    this.app.use(cors({
      origin: process.env.ALLOWED_ORIGINS?.split(',') || 'http://localhost:3000',
      methods: ['GET', 'POST', 'PUT', 'DELETE'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      exposedHeaders: ['Content-Range', 'X-Content-Range'],
      credentials: true,
      maxAge: 600 // 10 minutes
    }));

    // Rate limiting
    const limiter = rateLimit({
      windowMs: parseInt(process.env.RATE_LIMIT_WINDOW || '900000', 10), // 15 minutes
      max: parseInt(process.env.RATE_LIMIT_MAX || '100', 10), // limit each IP to 100 requests per windowMs
      message: 'Too many requests from this IP, please try again later',
      standardHeaders: true,
      legacyHeaders: false
    });
    this.app.use(limiter);

    // Request logging
    this.app.use(morgan('[:date[iso]] :method :url :status :response-time ms - :res[content-length]'));

    // Compression
    this.app.use(compression({
      level: 6,
      threshold: 10 * 1024, // 10KB
      filter: (req: Request, res: Response) => {
        if (req.headers['x-no-compression']) {
          return false;
        }
        return compression.filter(req, res);
      }
    }));

    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Request tracking
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      this.healthMetrics.totalRequests++;
      this.healthMetrics.activeConnections++;
      res.on('finish', () => {
        this.healthMetrics.activeConnections--;
      });
      next();
    });
  }

  /**
   * Configures health check endpoint with detailed metrics
   */
  private setupHealthCheck(): void {
    this.app.get('/health', async (req: Request, res: Response) => {
      try {
        // Check database connection
        await pool.query('SELECT 1');

        // Calculate uptime and metrics
        const uptime = Date.now() - this.healthMetrics.startTime.getTime();
        const healthStatus = {
          status: 'healthy',
          uptime: Math.floor(uptime / 1000), // seconds
          timestamp: new Date().toISOString(),
          database: 'connected',
          metrics: {
            totalRequests: this.healthMetrics.totalRequests,
            activeConnections: this.healthMetrics.activeConnections
          },
          isoCompliance: {
            colorManagement: printerQualityConfig.colorSpace === 'CMYK',
            resolution: printerQualityConfig.resolution >= 300,
            bleed: printerQualityConfig.bleed >= 3
          },
          version: process.env.npm_package_version || '1.0.0'
        };

        res.json(healthStatus);
      } catch (error) {
        res.status(503).json({
          status: 'unhealthy',
          timestamp: new Date().toISOString(),
          error: error.message
        });
      }
    });
  }

  /**
   * Configures error handling with detailed logging
   */
  private setupErrorHandling(): void {
    // 404 handler
    this.app.use((req: Request, res: Response) => {
      res.status(404).json({
        error: 'Not Found',
        message: `${req.method} ${req.path} not found`,
        path: req.path
      });
    });

    // Global error handler
    this.app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
      console.error('Unhandled error:', err);
      res.status(500).json({
        error: 'Internal Server Error',
        message: process.env.NODE_ENV === 'production' ? 
          'An unexpected error occurred' : 
          err.message,
        requestId: req.headers['x-request-id']
      });
    });
  }

  /**
   * Initializes and starts the print service
   */
  public async initialize(): Promise<void> {
    try {
      // Configure middleware
      this.configureMiddleware();

      // Set up routes
      this.app.use('/api/print', printRouter);

      // Set up health check
      this.setupHealthCheck();

      // Set up error handling
      this.setupErrorHandling();

      // Start server
      await this.startServer();

      console.log(`Print service started on port ${this.port}`);
    } catch (error) {
      console.error('Failed to start print service:', error);
      process.exit(1);
    }
  }

  /**
   * Starts the server with graceful shutdown handling
   */
  private async startServer(): Promise<void> {
    const server = this.app.listen(this.port);

    // Graceful shutdown
    const shutdown = async () => {
      console.log('Shutting down print service...');
      
      server.close(async () => {
        try {
          await pool.end();
          console.log('Database connections closed');
          process.exit(0);
        } catch (error) {
          console.error('Error during shutdown:', error);
          process.exit(1);
        }
      });

      // Force shutdown after timeout
      setTimeout(() => {
        console.error('Forced shutdown after timeout');
        process.exit(1);
      }, 30000);
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
  }
}

export default PrintServiceApp;