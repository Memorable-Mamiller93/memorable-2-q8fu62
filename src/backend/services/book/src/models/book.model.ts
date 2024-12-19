// External dependencies
import { Model, DataTypes, FindOptions, Transaction } from 'sequelize'; // ^6.32.1
import { HasMany, BelongsTo, Table, Column } from 'sequelize-typescript'; // ^6.32.1
import { IsUUID, IsString, IsObject, IsDate, validateOrReject } from 'class-validator'; // ^0.14.0

// Internal dependencies
import { pool } from '../config/database.config';
import { Theme } from './theme.model';
import { Page } from './page.model';
import { Logger } from '@memorable/logger';
import { MetricsCollector } from '@memorable/metrics';
import { RedisCache } from '@memorable/cache';

// Initialize metrics collector
const metricsCollector = new MetricsCollector('book_model');

// Initialize Redis cache for books
const bookCache = new RedisCache('books', {
    ttl: 1800, // 30 minutes cache TTL
    maxSize: 10000 // Maximum number of cached books
});

// Book status enum
export enum BookStatus {
    DRAFT = 'draft',
    PROCESSING = 'processing',
    COMPLETE = 'complete',
    ERROR = 'error'
}

// Character information interface
interface CharacterInfo {
    name: string;
    age: number;
    interests: string[];
    traits: string[];
}

// CDN assets interface
interface CdnAssets {
    photos: {
        original: string;
        processed: string;
        thumbnails: {
            small: string;
            medium: string;
        };
    }[];
    illustrations: {
        [pageId: string]: {
            url: string;
            version: number;
            metadata: {
                width: number;
                height: number;
                format: string;
                size: number;
            };
        };
    };
}

// Book customization interface
interface BookCustomization {
    colorScheme: string;
    fontFamily: string;
    printOptions: {
        format: 'softcover' | 'hardcover';
        paperWeight: number;
        binding: string;
    };
}

// Book metadata interface
export interface BookMetadata {
    characterInfo: CharacterInfo;
    cdnAssets: CdnAssets;
    customization: BookCustomization;
    printSpecifications: {
        dpi: number;
        colorSpace: 'CMYK' | 'RGB';
        bleed: number;
        trim: {
            width: number;
            height: number;
        };
    };
}

// Book attributes interface
export interface BookAttributes {
    id: string;
    userId: string;
    themeId: string;
    title: string;
    metadata: BookMetadata;
    status: BookStatus;
    createdAt: Date;
    updatedAt: Date;
}

@Table({
    tableName: 'books',
    paranoid: true,
    indexes: [
        { fields: ['userId'] },
        { fields: ['themeId'] },
        { fields: ['status'] }
    ]
})
export class Book extends Model<BookAttributes> {
    @IsUUID(4)
    @Column({
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    })
    declare id: string;

    @IsUUID(4)
    @Column({
        type: DataTypes.UUID,
        allowNull: false
    })
    declare userId: string;

    @IsUUID(4)
    @Column({
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'themes',
            key: 'id'
        }
    })
    declare themeId: string;

    @IsString()
    @Column({
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
            len: [1, 200]
        }
    })
    declare title: string;

    @IsObject()
    @Column({
        type: DataTypes.JSONB,
        allowNull: false
    })
    declare metadata: BookMetadata;

    @Column({
        type: DataTypes.ENUM(...Object.values(BookStatus)),
        allowNull: false,
        defaultValue: BookStatus.DRAFT
    })
    declare status: BookStatus;

    @IsDate()
    @Column({
        type: DataTypes.DATE,
        allowNull: false
    })
    declare createdAt: Date;

    @IsDate()
    @Column({
        type: DataTypes.DATE,
        allowNull: false
    })
    declare updatedAt: Date;

    // Define relationships
    @HasMany(() => Page, {
        onDelete: 'CASCADE',
        hooks: true
    })
    declare pages: Page[];

    @BelongsTo(() => Theme, {
        foreignKey: 'themeId',
        validate: true
    })
    declare theme: Theme;

    // Validate book metadata
    private async validateMetadata(): Promise<void> {
        try {
            // Validate character info
            const { characterInfo } = this.metadata;
            if (!characterInfo.name || characterInfo.age < 0 || !characterInfo.interests.length) {
                throw new Error('Invalid character information');
            }

            // Validate CDN assets
            const { cdnAssets } = this.metadata;
            const cdnUrlPattern = /^https:\/\/cdn\.memorable\.com\/books\/.+/;
            const photoValidation = cdnAssets.photos.every(photo => 
                cdnUrlPattern.test(photo.original) && 
                cdnUrlPattern.test(photo.processed)
            );

            if (!photoValidation) {
                throw new Error('Invalid CDN asset URLs detected');
            }

            // Validate print specifications
            const { printSpecifications } = this.metadata;
            if (printSpecifications.dpi < 300 || !['CMYK', 'RGB'].includes(printSpecifications.colorSpace)) {
                throw new Error('Invalid print specifications');
            }

            metricsCollector.incrementCounter('book_validations_success');
        } catch (error) {
            metricsCollector.incrementCounter('book_validations_failed');
            Logger.error('Book validation failed', { error, bookId: this.id });
            throw error;
        }
    }

    /**
     * Retrieves all books for a specific user with pagination and caching
     */
    static async findBooksByUserId(
        userId: string,
        options: FindOptions = {}
    ): Promise<Book[]> {
        const cacheKey = `user:${userId}:books`;
        try {
            // Check cache first
            const cachedBooks = await bookCache.get(cacheKey);
            if (cachedBooks) {
                metricsCollector.incrementCounter('book_cache_hits');
                return cachedBooks;
            }

            const books = await Book.findAll({
                where: { userId },
                include: [
                    {
                        model: Theme,
                        attributes: ['id', 'name', 'settings']
                    },
                    {
                        model: Page,
                        where: { isDeleted: false },
                        required: false
                    }
                ],
                order: [['createdAt', 'DESC']],
                ...options
            });

            // Update cache
            await bookCache.set(cacheKey, books);
            metricsCollector.incrementCounter('book_cache_misses');

            return books;
        } catch (error) {
            Logger.error('Error fetching books by user ID', { error, userId });
            metricsCollector.incrementCounter('book_fetch_errors');
            throw error;
        }
    }

    /**
     * Retrieves a specific book by ID with its pages and theme
     */
    static async findBookById(bookId: string): Promise<Book | null> {
        const cacheKey = `book:${bookId}`;
        try {
            // Check cache first
            const cachedBook = await bookCache.get(cacheKey);
            if (cachedBook) {
                metricsCollector.incrementCounter('book_cache_hits');
                return cachedBook;
            }

            const book = await Book.findByPk(bookId, {
                include: [
                    {
                        model: Theme,
                        attributes: ['id', 'name', 'settings', 'cdnAssets']
                    },
                    {
                        model: Page,
                        where: { isDeleted: false },
                        required: false,
                        order: [['pageNumber', 'ASC']]
                    }
                ]
            });

            if (book) {
                await book.validateMetadata();
                await bookCache.set(cacheKey, book);
            }

            metricsCollector.incrementCounter('book_cache_misses');
            return book;
        } catch (error) {
            Logger.error('Error fetching book by ID', { error, bookId });
            metricsCollector.incrementCounter('book_fetch_errors');
            throw error;
        }
    }

    /**
     * Updates book metadata and status with transaction support
     */
    static async updateBookMetadata(
        bookId: string,
        metadata: BookMetadata,
        status: BookStatus
    ): Promise<Book> {
        const transaction = await pool.getConnection();
        try {
            const book = await Book.findByPk(bookId, { transaction });
            if (!book) {
                throw new Error('Book not found');
            }

            book.metadata = metadata;
            book.status = status;
            await book.validateMetadata();
            await book.save({ transaction });

            // Invalidate cache
            await bookCache.delete(`book:${bookId}`);
            await bookCache.delete(`user:${book.userId}:books`);

            await transaction.commit();
            metricsCollector.incrementCounter('book_updates_success');

            return book;
        } catch (error) {
            await transaction.rollback();
            Logger.error('Error updating book metadata', { error, bookId });
            metricsCollector.incrementCounter('book_updates_failed');
            throw error;
        }
    }
}

// Initialize hooks for cache management
Book.afterCreate(async (book: Book) => {
    await bookCache.delete(`user:${book.userId}:books`);
    metricsCollector.incrementCounter('book_creates');
});

Book.afterUpdate(async (book: Book) => {
    await bookCache.delete(`book:${book.id}`);
    await bookCache.delete(`user:${book.userId}:books`);
    metricsCollector.incrementCounter('book_updates');
});

Book.afterDestroy(async (book: Book) => {
    await bookCache.delete(`book:${book.id}`);
    await bookCache.delete(`user:${book.userId}:books`);
    metricsCollector.incrementCounter('book_deletes');
});

export default Book;