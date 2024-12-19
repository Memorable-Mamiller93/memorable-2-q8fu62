// External imports with versions
import express, { Express, Request, Response, NextFunction } from 'express'; // @version ^4.18.2
import cors from 'cors'; // @version ^2.8.5
import helmet from 'helmet'; // @version ^7.0.0
import compression from 'compression'; // @version ^1.7.4
import morgan from 'morgan'; // @version ^1.10.0
import rateLimit from 'express-rate-limit'; // @version ^6.9.0

// Internal imports
import { authConfig } from './config/auth.config';
import { databaseConfig, pool } from './config/database.config';
import { router as authRouter } from './routes/auth.routes';
import { securityHeaders, rateLimiter } from './middleware/auth.middleware';

// Initialize Express app
const app: Express = express();

/**
 * Initializes and configures comprehensive Express middleware stack
 * with enhanced security features
 * @param app Express application instance
 */
const initializeMiddleware = (app: Express): void => {
  // Security middleware configuration
  app.use(helmet({
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
    dnsPrefetchControl: true,
    frameguard: { action: 'deny' },
    hidePoweredBy: true,
    hsts: true,
    ieNoOpen: true,
    noSniff: true,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    xssFilter: true
  }));

  // CORS configuration with dynamic origin validation
  app.use(cors({
    origin: (origin, callback) => {
      const allowedOrigins = authConfig.session.allowedOrigins;
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    credentials: true,
    maxAge: 86400 // 24 hours
  }));

  // Request parsing middleware with size limits
  app.use(express.json({ limit: '10kb' }));
  app.use(express.urlencoded({ extended: true, limit: '10kb' }));

  // Compression middleware for response optimization
  app.use(compression());

  // Security-focused request logging
  app.use(morgan('[:date[iso]] :method :url :status :response-time ms - :res[content-length] - :remote-addr - :user-agent', {
    skip: (req) => req.url === '/health'
  }));

  // Request correlation ID middleware
  app.use((req: Request, res: Response, next: NextFunction) => {
    const correlationId = req.get('X-Correlation-ID') || crypto.randomUUID();
    res.set('X-Correlation-ID', correlationId);
    next();
  });
};

/**
 * Configures authentication service routes with security middleware
 * @param app Express application instance
 */
const initializeRoutes = (app: Express): void => {
  // Health check endpoint
  app.get('/health', (req: Request, res: Response) => {
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: pool.totalCount > 0 ? 'connected' : 'disconnected'
    });
  });

  // Mount authentication routes with security middleware
  app.use('/api/v1/auth',
    rateLimiter,
    securityHeaders,
    authRouter
  );

  // 404 handler
  app.use((req: Request, res: Response) => {
    res.status(404).json({
      error: 'Not Found',
      path: req.path
    });
  });

  // Global error handler
  app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    console.error('Unhandled error:', err);
    res.status(500).json({
      error: 'Internal Server Error',
      message: process.env.NODE_ENV === 'production' ? 'An unexpected error occurred' : err.message,
      correlationId: res.get('X-Correlation-ID')
    });
  });
};

/**
 * Starts the Express server with enhanced security and monitoring
 * @param app Express application instance
 */
const startServer = async (app: Express): Promise<void> => {
  try {
    const port = process.env.PORT || 3001;

    // Validate database connection
    await pool.query('SELECT 1');
    console.log('Database connection established');

    // Configure graceful shutdown
    const server = app.listen(port, () => {
      console.log(`Auth service listening on port ${port}`);
    });

    const gracefulShutdown = async (signal: string) => {
      console.log(`${signal} received. Starting graceful shutdown...`);
      
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
        console.error('Forced shutdown due to timeout');
        process.exit(1);
      }, parseInt(process.env.SHUTDOWN_TIMEOUT || '10000', 10));
    };

    // Register shutdown handlers
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Initialize application
initializeMiddleware(app);
initializeRoutes(app);

// Start server if not in test environment
if (process.env.NODE_ENV !== 'test') {
  startServer(app);
}

// Export app instance for testing
export { app };