// External dependencies
import express, { Express, Request, Response, NextFunction } from 'express'; // ^4.18.2
import cors from 'cors'; // ^2.8.5
import helmet from 'helmet'; // ^7.0.0
import compression from 'compression'; // ^1.7.4
import morgan from 'morgan'; // ^1.10.0
import rateLimit from 'express-rate-limit'; // ^6.9.0
import CircuitBreaker from 'opossum'; // ^7.1.0
import pino from 'pino'; // ^8.15.0

// Internal dependencies
import { configureRoutes } from './routes/book.routes';
import { sequelize } from './config/database.config';
import { storageConfig } from './config/storage.config';
import { BookController } from './controllers/book.controller';
import { BookService } from './services/book.service';
import { StorageService } from './services/storage.service';

// Initialize logger
const logger = pino({
    level: process.env.LOG_LEVEL || 'info',
    formatters: {
        level: (label) => ({ level: label }),
    },
    timestamp: () => `,"time":"${new Date().toISOString()}"`,
});

// Environment variables
const PORT = process.env.PORT || 3002;
const NODE_ENV = process.env.NODE_ENV || 'development';
const MAX_REQUEST_SIZE = process.env.MAX_REQUEST_SIZE || '10mb';

// Initialize services
const storageService = new StorageService(logger);
const bookService = new BookService(storageService, logger);
const bookController = new BookController(bookService, logger);

/**
 * Initializes and configures the Express application with comprehensive security
 * and monitoring features
 */
async function initializeApp(): Promise<Express> {
    const app = express();

    // Security middleware
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
        crossOriginResourcePolicy: { policy: "same-site" }
    }));

    // CORS configuration
    app.use(cors({
        origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization'],
        credentials: true,
        maxAge: 86400 // 24 hours
    }));

    // Request parsing and compression
    app.use(express.json({ limit: MAX_REQUEST_SIZE }));
    app.use(express.urlencoded({ extended: true, limit: MAX_REQUEST_SIZE }));
    app.use(compression());

    // Request logging
    app.use(morgan('combined', {
        stream: { write: (message) => logger.info(message.trim()) }
    }));

    // Rate limiting
    const limiter = rateLimit({
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 100, // Limit each IP to 100 requests per windowMs
        standardHeaders: true,
        legacyHeaders: false,
        message: { error: 'Too many requests, please try again later.' }
    });
    app.use(limiter);

    // Health check endpoint
    app.get('/health', (req: Request, res: Response) => {
        res.status(200).json({
            status: 'ok',
            timestamp: new Date().toISOString(),
            environment: NODE_ENV,
            version: process.env.npm_package_version
        });
    });

    // Configure book routes
    app.use('/api/v1', configureRoutes(bookController));

    // Global error handler
    app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
        logger.error({
            err,
            req: {
                method: req.method,
                url: req.url,
                headers: req.headers,
                body: req.body
            }
        });

        res.status(500).json({
            error: 'Internal Server Error',
            message: NODE_ENV === 'development' ? err.message : 'An unexpected error occurred',
            requestId: req.headers['x-request-id']
        });
    });

    return app;
}

/**
 * Starts the server with resilience patterns and monitoring
 */
async function startServer(): Promise<void> {
    try {
        // Initialize database connection
        await sequelize.authenticate();
        logger.info('Database connection established successfully');

        // Verify storage configuration
        if (!storageConfig.bucketName || !storageConfig.region) {
            throw new Error('Invalid storage configuration');
        }

        // Initialize application
        const app = await initializeApp();

        // Configure circuit breaker for external services
        const breaker = new CircuitBreaker(async () => {
            // External service health checks
            await Promise.all([
                sequelize.authenticate(),
                storageService.checkConnection()
            ]);
        }, {
            timeout: 3000,
            errorThresholdPercentage: 50,
            resetTimeout: 30000
        });

        breaker.fallback(() => {
            logger.warn('Circuit breaker fallback triggered');
        });

        // Start server
        const server = app.listen(PORT, () => {
            logger.info(`Book service started on port ${PORT} in ${NODE_ENV} mode`);
        });

        // Graceful shutdown handling
        const shutdown = async () => {
            logger.info('Shutting down gracefully...');
            
            server.close(async () => {
                try {
                    await sequelize.close();
                    logger.info('Database connections closed');
                    process.exit(0);
                } catch (error) {
                    logger.error('Error during shutdown:', error);
                    process.exit(1);
                }
            });

            // Force shutdown after timeout
            setTimeout(() => {
                logger.error('Forced shutdown after timeout');
                process.exit(1);
            }, 10000);
        };

        process.on('SIGTERM', shutdown);
        process.on('SIGINT', shutdown);

    } catch (error) {
        logger.error('Failed to start server:', error);
        process.exit(1);
    }
}

// Start the server
if (require.main === module) {
    startServer();
}

// Export for testing
export { initializeApp };