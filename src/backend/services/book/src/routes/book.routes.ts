// External dependencies
import { Router } from 'express'; // ^4.17.1
import multer from 'multer'; // ^1.4.5-lts.1
import winston from 'winston'; // ^3.8.2
import rateLimit from 'express-rate-limit'; // ^6.7.0

// Internal dependencies
import { BookController } from '../controllers/book.controller';
import { validateBookCreation, validatePageUpdate } from '../middleware/validation.middleware';
import { authenticate } from '../../auth/src/middleware/auth.middleware';

// Initialize logger
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    defaultMeta: { service: 'book-routes' },
    transports: [
        new winston.transports.File({ filename: 'logs/book-routes.log' }),
        new winston.transports.Console()
    ]
});

// Configure multer for file uploads
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB limit
        files: 1
    },
    fileFilter: (req, file, cb) => {
        // Allow only image files
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only images are allowed.'), false);
        }
    }
});

// Rate limiting configurations
const createBookLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 10, // 10 requests per minute
    message: { error: 'Too many book creation requests. Please try again later.' }
});

const updateBookLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 30,
    message: { error: 'Too many update requests. Please try again later.' }
});

const uploadLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 20,
    message: { error: 'Too many upload requests. Please try again later.' }
});

/**
 * Configures and returns the book routes with comprehensive middleware and error handling
 * @param bookController Instance of BookController for handling book operations
 * @returns Configured Express router
 */
export function configureRoutes(bookController: BookController): Router {
    const router = Router();

    // Health check endpoint
    router.get('/health', (req, res) => {
        res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
    });

    // Protected routes requiring authentication
    router.use(authenticate);

    // Book creation endpoint with validation and rate limiting
    router.post('/books',
        createBookLimiter,
        validateBookCreation,
        async (req, res, next) => {
            try {
                logger.info('Book creation request received', {
                    userId: req.user?.id,
                    requestId: req.headers['x-request-id']
                });
                await bookController.createBook(req, res);
            } catch (error) {
                logger.error('Book creation failed', {
                    error,
                    userId: req.user?.id,
                    requestId: req.headers['x-request-id']
                });
                next(error);
            }
        }
    );

    // Get specific book endpoint with caching headers
    router.get('/books/:id', async (req, res, next) => {
        try {
            // Set cache control headers
            res.set('Cache-Control', 'private, max-age=300'); // 5 minutes cache
            await bookController.getBook(req, res);
        } catch (error) {
            logger.error('Book retrieval failed', {
                error,
                bookId: req.params.id,
                userId: req.user?.id
            });
            next(error);
        }
    });

    // Get user's books with pagination
    router.get('/books', async (req, res, next) => {
        try {
            await bookController.getUserBooks(req, res);
        } catch (error) {
            logger.error('User books retrieval failed', {
                error,
                userId: req.user?.id
            });
            next(error);
        }
    });

    // Update book endpoint with validation and rate limiting
    router.put('/books/:id',
        updateBookLimiter,
        async (req, res, next) => {
            try {
                await bookController.updateBook(req, res);
            } catch (error) {
                logger.error('Book update failed', {
                    error,
                    bookId: req.params.id,
                    userId: req.user?.id
                });
                next(error);
            }
        }
    );

    // Update book pages endpoint with validation
    router.put('/books/:id/pages',
        updateBookLimiter,
        validatePageUpdate,
        async (req, res, next) => {
            try {
                await bookController.updateBookPages(req, res);
            } catch (error) {
                logger.error('Book pages update failed', {
                    error,
                    bookId: req.params.id,
                    userId: req.user?.id
                });
                next(error);
            }
        }
    );

    // Upload book assets endpoint with file handling and rate limiting
    router.post('/books/:id/assets',
        uploadLimiter,
        upload.single('file'),
        async (req, res, next) => {
            try {
                if (!req.file) {
                    throw new Error('No file uploaded');
                }
                await bookController.uploadBookAsset(req, res);
            } catch (error) {
                logger.error('Asset upload failed', {
                    error,
                    bookId: req.params.id,
                    userId: req.user?.id
                });
                next(error);
            }
        }
    );

    // Error handling middleware
    router.use((error: any, req: any, res: any, next: any) => {
        logger.error('Route error handler', {
            error,
            path: req.path,
            method: req.method,
            userId: req.user?.id
        });

        if (error.type === 'entity.too.large') {
            return res.status(413).json({
                error: 'File too large',
                maxSize: '5MB'
            });
        }

        res.status(error.status || 500).json({
            error: error.message || 'Internal server error',
            requestId: req.headers['x-request-id']
        });
    });

    return router;
}

export default configureRoutes;