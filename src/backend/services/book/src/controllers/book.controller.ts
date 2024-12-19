// External dependencies
import { Request, Response } from 'express'; // ^4.18.2
import asyncHandler from 'express-async-handler'; // ^1.2.0
import rateLimit from 'express-rate-limit'; // ^6.9.0
import sanitize from 'express-sanitizer'; // ^1.0.6
import { Logger } from 'winston'; // ^3.8.0
import { MetricsCollector } from '@shared/metrics'; // ^1.0.0

// Internal dependencies
import { BookService } from '../services/book.service';
import { validateBookCreation, validatePageUpdate } from '../middleware/validation.middleware';
import { BookStatus } from '../models/book.model';

/**
 * Enhanced BookController class for handling book-related HTTP requests
 * with comprehensive security, monitoring, and error handling
 */
export class BookController {
    private readonly rateLimiters: {
        create: any;
        update: any;
        upload: any;
    };

    constructor(
        private readonly bookService: BookService,
        private readonly logger: Logger,
        private readonly metrics: MetricsCollector
    ) {
        // Initialize rate limiters for different endpoints
        this.rateLimiters = {
            create: rateLimit({
                windowMs: 60 * 1000, // 1 minute
                max: 10, // 10 requests per minute
                message: { error: 'Too many book creation requests' }
            }),
            update: rateLimit({
                windowMs: 60 * 1000,
                max: 30,
                message: { error: 'Too many update requests' }
            }),
            upload: rateLimit({
                windowMs: 60 * 1000,
                max: 20,
                message: { error: 'Too many upload requests' }
            })
        };
    }

    /**
     * Creates a new book with enhanced validation and monitoring
     */
    @asyncHandler
    public createBook = async (req: Request, res: Response): Promise<void> => {
        const startTime = Date.now();
        const requestId = req.headers['x-request-id'] || Date.now().toString();

        try {
            this.logger.info('Book creation request received', {
                requestId,
                userId: req.user?.id
            });

            // Apply rate limiting
            await this.rateLimiters.create(req, res);

            // Sanitize input
            const sanitizedData = {
                ...req.body,
                title: sanitize(req.body.title),
                metadata: {
                    ...req.body.metadata,
                    characterInfo: {
                        ...req.body.metadata.characterInfo,
                        name: sanitize(req.body.metadata.characterInfo.name)
                    }
                }
            };

            // Create book
            const book = await this.bookService.createBook({
                userId: req.user.id,
                themeId: sanitizedData.themeId,
                title: sanitizedData.title,
                metadata: sanitizedData.metadata
            });

            // Record metrics
            this.metrics.recordTiming('book_creation_duration', Date.now() - startTime);
            this.metrics.incrementCounter('books_created');

            this.logger.info('Book created successfully', {
                requestId,
                bookId: book.id
            });

            res.status(201).json({
                success: true,
                data: book
            });

        } catch (error) {
            this.logger.error('Book creation failed', {
                requestId,
                error: error.message,
                stack: error.stack
            });

            this.metrics.incrementCounter('book_creation_errors');
            throw error;
        }
    };

    /**
     * Retrieves a book by ID with caching and error handling
     */
    @asyncHandler
    public getBook = async (req: Request, res: Response): Promise<void> => {
        const startTime = Date.now();
        const { bookId } = req.params;

        try {
            const book = await this.bookService.getBookById(bookId);
            
            if (!book) {
                res.status(404).json({
                    success: false,
                    error: 'Book not found'
                });
                return;
            }

            // Verify user has access to this book
            if (book.userId !== req.user.id) {
                res.status(403).json({
                    success: false,
                    error: 'Access denied'
                });
                return;
            }

            this.metrics.recordTiming('book_retrieval_duration', Date.now() - startTime);
            res.status(200).json({
                success: true,
                data: book
            });

        } catch (error) {
            this.metrics.incrementCounter('book_retrieval_errors');
            throw error;
        }
    };

    /**
     * Updates book content with validation and security checks
     */
    @asyncHandler
    public updateBook = async (req: Request, res: Response): Promise<void> => {
        const startTime = Date.now();
        const { bookId } = req.params;

        try {
            await this.rateLimiters.update(req, res);

            const book = await this.bookService.getBookById(bookId);
            
            if (!book) {
                res.status(404).json({
                    success: false,
                    error: 'Book not found'
                });
                return;
            }

            // Verify ownership
            if (book.userId !== req.user.id) {
                res.status(403).json({
                    success: false,
                    error: 'Access denied'
                });
                return;
            }

            const updatedBook = await this.bookService.updateBook(bookId, {
                title: sanitize(req.body.title),
                metadata: req.body.metadata,
                status: req.body.status
            });

            this.metrics.recordTiming('book_update_duration', Date.now() - startTime);
            res.status(200).json({
                success: true,
                data: updatedBook
            });

        } catch (error) {
            this.metrics.incrementCounter('book_update_errors');
            throw error;
        }
    };

    /**
     * Updates book pages with content validation and optimization
     */
    @asyncHandler
    @validatePageUpdate
    public updateBookPages = async (req: Request, res: Response): Promise<void> => {
        const startTime = Date.now();
        const { bookId, pageId } = req.params;

        try {
            await this.rateLimiters.update(req, res);

            const updatedPage = await this.bookService.updateBookPages(
                bookId,
                pageId,
                {
                    content: req.body.content,
                    illustrations: req.body.illustrations
                }
            );

            this.metrics.recordTiming('page_update_duration', Date.now() - startTime);
            res.status(200).json({
                success: true,
                data: updatedPage
            });

        } catch (error) {
            this.metrics.incrementCounter('page_update_errors');
            throw error;
        }
    };

    /**
     * Handles book asset uploads with security and CDN integration
     */
    @asyncHandler
    public uploadBookAsset = async (req: Request, res: Response): Promise<void> => {
        const startTime = Date.now();
        const { bookId } = req.params;

        try {
            await this.rateLimiters.upload(req, res);

            if (!req.file) {
                res.status(400).json({
                    success: false,
                    error: 'No file provided'
                });
                return;
            }

            const cdnUrl = await this.bookService.uploadBookAsset(
                bookId,
                req.file.buffer,
                req.file.mimetype
            );

            this.metrics.recordTiming('asset_upload_duration', Date.now() - startTime);
            res.status(200).json({
                success: true,
                data: { url: cdnUrl }
            });

        } catch (error) {
            this.metrics.incrementCounter('asset_upload_errors');
            throw error;
        }
    };

    /**
     * Retrieves all books for a user with pagination and caching
     */
    @asyncHandler
    public getUserBooks = async (req: Request, res: Response): Promise<void> => {
        const startTime = Date.now();
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;

        try {
            const result = await this.bookService.getUserBooks(
                req.user.id,
                page,
                limit
            );

            this.metrics.recordTiming('user_books_retrieval_duration', Date.now() - startTime);
            res.status(200).json({
                success: true,
                data: result.books,
                pagination: {
                    total: result.total,
                    page,
                    limit
                }
            });

        } catch (error) {
            this.metrics.incrementCounter('user_books_retrieval_errors');
            throw error;
        }
    };
}

export default BookController;