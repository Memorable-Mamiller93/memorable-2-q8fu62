// External dependencies
import { Transaction } from 'sequelize'; // ^6.32.1
import { v4 as uuidv4 } from 'uuid'; // ^9.0.0
import CircuitBreaker from 'opossum'; // ^6.0.0
import winston from 'winston'; // ^3.8.0
import Redis from 'ioredis'; // ^5.3.0

// Internal dependencies
import { Book, BookMetadata, BookStatus } from '../models/book.model';
import { Page } from '../models/page.model';
import { Theme } from '../models/theme.model';
import { StorageService } from './storage.service';
import { sequelize } from '../config/database.config';

// Types and interfaces
interface CreateBookDTO {
    userId: string;
    themeId: string;
    title: string;
    metadata: BookMetadata;
}

interface UpdateBookDTO {
    title?: string;
    metadata?: Partial<BookMetadata>;
    status?: BookStatus;
}

interface PageUpdateDTO {
    content: string;
    illustrations: {
        primary: {
            url: string;
            width: number;
            height: number;
            format: string;
            size: number;
            cdnPath: string;
        };
    };
}

/**
 * Enhanced BookService class for managing book operations with performance optimization,
 * caching, and reliability features
 */
export class BookService {
    private readonly logger: winston.Logger;
    private readonly redis: Redis;
    private readonly circuitBreaker: CircuitBreaker;
    private readonly metricsPrefix = 'book_service_';

    constructor(
        private readonly storageService: StorageService,
        loggerInstance?: winston.Logger
    ) {
        // Initialize logger
        this.logger = loggerInstance || winston.createLogger({
            level: 'info',
            format: winston.format.json(),
            defaultMeta: { service: 'book-service' },
            transports: [
                new winston.transports.Console(),
                new winston.transports.File({ filename: 'error.log', level: 'error' })
            ]
        });

        // Initialize Redis client for caching
        this.redis = new Redis({
            host: process.env.REDIS_HOST || 'localhost',
            port: parseInt(process.env.REDIS_PORT || '6379'),
            password: process.env.REDIS_PASSWORD,
            retryStrategy: (times) => Math.min(times * 50, 2000)
        });

        // Initialize circuit breaker for external service calls
        this.circuitBreaker = new CircuitBreaker(async (operation: () => Promise<any>) => {
            return operation();
        }, {
            timeout: 10000,
            errorThresholdPercentage: 50,
            resetTimeout: 30000
        });
    }

    /**
     * Creates a new book with initial pages and optimized performance
     * @param bookData Book creation data
     * @returns Created book instance with pages
     */
    async createBook(bookData: CreateBookDTO): Promise<Book> {
        const transaction = await sequelize.transaction();
        const cacheKey = `book:create:${bookData.userId}:${Date.now()}`;

        try {
            // Validate theme existence
            const theme = await Theme.findThemeById(bookData.themeId);
            if (!theme) {
                throw new Error('Theme not found');
            }

            // Create book record
            const book = await Book.create({
                id: uuidv4(),
                ...bookData,
                status: BookStatus.DRAFT
            }, { transaction });

            // Initialize empty pages based on theme
            const pagePromises = Array.from({ length: theme.settings.narrativeTemplate.plotPoints.length })
                .map((_, index) => Page.create({
                    id: uuidv4(),
                    bookId: book.id,
                    pageNumber: index + 1,
                    content: '',
                    illustrations: { primary: {} },
                    version: 1
                }, { transaction }));

            await Promise.all(pagePromises);

            // Cache the new book data
            await this.redis.setex(
                cacheKey,
                3600, // 1 hour cache
                JSON.stringify(book)
            );

            await transaction.commit();
            this.logger.info('Book created successfully', { bookId: book.id });
            return book;

        } catch (error) {
            await transaction.rollback();
            this.logger.error('Error creating book', { error, userData: bookData.userId });
            throw error;
        }
    }

    /**
     * Retrieves a book by ID with caching and performance optimization
     * @param bookId Book identifier
     * @returns Book instance with pages and theme
     */
    async getBookById(bookId: string): Promise<Book | null> {
        const cacheKey = `book:${bookId}`;

        try {
            // Check cache first
            const cachedBook = await this.redis.get(cacheKey);
            if (cachedBook) {
                return JSON.parse(cachedBook);
            }

            // Fetch from database if not in cache
            const book = await this.circuitBreaker.fire(async () => {
                return Book.findBookById(bookId);
            });

            if (book) {
                await this.redis.setex(cacheKey, 3600, JSON.stringify(book));
            }

            return book;

        } catch (error) {
            this.logger.error('Error fetching book', { error, bookId });
            throw error;
        }
    }

    /**
     * Updates book metadata and content with transaction support
     * @param bookId Book identifier
     * @param updateData Book update data
     * @returns Updated book instance
     */
    async updateBook(bookId: string, updateData: UpdateBookDTO): Promise<Book> {
        const transaction = await sequelize.transaction();

        try {
            const book = await Book.findBookById(bookId);
            if (!book) {
                throw new Error('Book not found');
            }

            // Update book properties
            if (updateData.title) book.title = updateData.title;
            if (updateData.status) book.status = updateData.status;
            if (updateData.metadata) {
                book.metadata = {
                    ...book.metadata,
                    ...updateData.metadata
                };
            }

            await book.save({ transaction });

            // Invalidate cache
            await this.redis.del(`book:${bookId}`);
            await this.redis.del(`user:${book.userId}:books`);

            await transaction.commit();
            this.logger.info('Book updated successfully', { bookId });
            return book;

        } catch (error) {
            await transaction.rollback();
            this.logger.error('Error updating book', { error, bookId });
            throw error;
        }
    }

    /**
     * Updates book pages with optimistic locking and validation
     * @param bookId Book identifier
     * @param pageId Page identifier
     * @param pageData Page update data
     * @returns Updated page instance
     */
    async updateBookPages(
        bookId: string,
        pageId: string,
        pageData: PageUpdateDTO
    ): Promise<Page> {
        const transaction = await sequelize.transaction();

        try {
            const page = await Page.findPagesByBookId(bookId, {
                limit: 1,
                offset: 0,
                orderBy: 'pageNumber'
            }, transaction);

            if (!page.rows.length) {
                throw new Error('Page not found');
            }

            const updatedPage = await Page.updatePageContent(
                pageId,
                pageData.content,
                pageData.illustrations,
                transaction
            );

            // Invalidate related caches
            await this.redis.del(`book:${bookId}`);
            await this.redis.del(`page:${pageId}`);

            await transaction.commit();
            this.logger.info('Page updated successfully', { bookId, pageId });
            return updatedPage;

        } catch (error) {
            await transaction.rollback();
            this.logger.error('Error updating page', { error, bookId, pageId });
            throw error;
        }
    }

    /**
     * Uploads book assets with validation and CDN integration
     * @param bookId Book identifier
     * @param file File buffer
     * @param contentType File MIME type
     * @returns CDN URL of the uploaded asset
     */
    async uploadBookAsset(
        bookId: string,
        file: Buffer,
        contentType: string
    ): Promise<string> {
        try {
            const book = await Book.findBookById(bookId);
            if (!book) {
                throw new Error('Book not found');
            }

            const cdnUrl = await this.storageService.uploadFile(file, `books/${bookId}`, {
                contentType,
                metadata: {
                    bookId,
                    uploadedAt: new Date().toISOString()
                },
                encryption: true
            });

            this.logger.info('Asset uploaded successfully', { bookId, contentType });
            return cdnUrl;

        } catch (error) {
            this.logger.error('Error uploading asset', { error, bookId });
            throw error;
        }
    }

    /**
     * Retrieves all books for a user with pagination and caching
     * @param userId User identifier
     * @param page Page number
     * @param limit Items per page
     * @returns Paginated list of books
     */
    async getUserBooks(
        userId: string,
        page: number = 1,
        limit: number = 10
    ): Promise<{ books: Book[]; total: number }> {
        const cacheKey = `user:${userId}:books:${page}:${limit}`;

        try {
            // Check cache first
            const cachedResult = await this.redis.get(cacheKey);
            if (cachedResult) {
                return JSON.parse(cachedResult);
            }

            const offset = (page - 1) * limit;
            const books = await Book.findBooksByUserId(userId, {
                limit,
                offset,
                order: [['createdAt', 'DESC']]
            });

            const result = {
                books,
                total: await Book.count({ where: { userId } })
            };

            // Cache the result
            await this.redis.setex(cacheKey, 1800, JSON.stringify(result));

            return result;

        } catch (error) {
            this.logger.error('Error fetching user books', { error, userId });
            throw error;
        }
    }
}

export default BookService;