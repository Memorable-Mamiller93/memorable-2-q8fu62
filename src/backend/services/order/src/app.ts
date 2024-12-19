// @package express ^4.18.0 - Web application framework
import express, { Application, Request, Response, NextFunction } from 'express';
// @package cors ^2.8.5 - Cross-origin resource sharing middleware
import cors from 'cors';
// @package helmet ^7.0.0 - Security headers middleware
import helmet from 'helmet';
// @package morgan ^1.10.0 - HTTP request logging
import morgan from 'morgan';
// @package compression ^1.7.4 - Response compression
import compression from 'compression';
// @package express-rate-limit ^6.9.0 - Rate limiting middleware
import rateLimit from 'express-rate-limit';
// @package winston ^3.10.0 - Logging framework
import winston from 'winston';

// Internal imports
import { orderRouter } from './routes/order.routes';
import { sequelize, authenticate } from './config/database.config';
import { paymentConfig } from './config/payment.config';

// Initialize Winston logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});

// Initialize Express application
const app: Application = express();

/**
 * Configures and sets up Express middleware with security and performance optimizations
 * @param app Express application instance
 */
function initializeMiddleware(app: Application): void {
  // Security middleware
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'"],
        frameSrc: ["'none'"],
        objectSrc: ["'none'"]
      }
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true
    }
  }));

  // CORS configuration with strict options
  app.use(cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['Content-Range', 'X-Content-Range'],
    credentials: true,
    maxAge: 600 // 10 minutes
  }));

  // Response compression
  app.use(compression());

  // Request logging
  app.use(morgan('combined', {
    skip: (req, res) => res.statusCode < 400,
    stream: {
      write: (message) => logger.info(message.trim())
    }
  }));

  // Request parsing middleware
  app.use(express.json({ 
    limit: '10kb',
    verify: (req: Request, res: Response, buf: Buffer) => {
      // Store raw body for Stripe webhook verification
      if (req.headers['stripe-signature']) {
        (req as any).rawBody = buf.toString();
      }
    }
  }));
  app.use(express.urlencoded({ extended: true, limit: '10kb' }));

  // Rate limiting middleware
  const limiter = rateLimit({
    windowMs: process.env.RATE_LIMIT_WINDOW ? parseInt(process.env.RATE_LIMIT_WINDOW) : 900000, // 15 minutes
    max: process.env.RATE_LIMIT_MAX ? parseInt(process.env.RATE_LIMIT_MAX) : 100,
    message: {
      error: 'Too many requests, please try again later.',
      retryAfter: '15 minutes'
    },
    standardHeaders: true,
    legacyHeaders: false
  });
  app.use('/api/', limiter);
}

/**
 * Sets up application routes with validation and error handling
 * @param app Express application instance
 */
function initializeRoutes(app: Application): void {
  // Health check endpoint
  app.get('/health', async (req: Request, res: Response) => {
    try {
      await authenticate();
      res.status(200).json({ status: 'healthy', timestamp: new Date().toISOString() });
    } catch (error) {
      res.status(503).json({ status: 'unhealthy', error: error.message });
    }
  });

  // API routes
  app.use('/api/v1/orders', orderRouter);

  // 404 handler
  app.use((req: Request, res: Response) => {
    res.status(404).json({
      error: 'Not Found',
      message: `Route ${req.method} ${req.url} not found`,
      timestamp: new Date().toISOString()
    });
  });

  // Global error handler
  app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    logger.error('Unhandled error:', {
      error: err.message,
      stack: err.stack,
      path: req.path,
      method: req.method
    });

    res.status(500).json({
      error: 'Internal Server Error',
      message: process.env.NODE_ENV === 'production' ? 
        'An unexpected error occurred' : 
        err.message,
      timestamp: new Date().toISOString(),
      requestId: req.headers['x-request-id']
    });
  });
}

/**
 * Initializes and starts the Express server with database connection
 */
async function startServer(): Promise<void> {
  try {
    // Initialize database connection
    await authenticate();
    logger.info('Database connection established successfully');

    // Initialize middleware
    initializeMiddleware(app);

    // Initialize routes
    initializeRoutes(app);

    // Start server
    const port = process.env.PORT || 3003;
    app.listen(port, () => {
      logger.info(`Order service listening on port ${port}`);
      logger.info(`Environment: ${process.env.NODE_ENV}`);
      logger.info(`PCI Compliance Mode: ${paymentConfig.security.pciMode}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Start server if not in test environment
if (process.env.NODE_ENV !== 'test') {
  startServer();
}

export default app;