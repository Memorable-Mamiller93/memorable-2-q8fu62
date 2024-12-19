// External dependencies - versions specified as per requirements
import { Model, DataTypes, Transaction, BelongsTo } from 'sequelize'; // ^6.32.1
import validator from 'validator'; // ^13.11.0
import createDOMPurifier from 'dompurify'; // ^3.0.5
import { JSDOM } from 'jsdom'; // Required for DOMPurify in Node.js

// Internal dependencies
import { sequelize } from '../config/database.config';
import { Book } from './book.model';
import { Logger } from '@memorable/logger';
import { MetricsCollector } from '@memorable/metrics';

// Initialize DOMPurifier
const window = new JSDOM('').window;
const DOMPurify = createDOMPurifier(window);

// Initialize metrics collector
const metricsCollector = new MetricsCollector('page_model');

// Type definitions for illustration metadata
interface IllustrationMetadata {
  url: string;
  width: number;
  height: number;
  format: string;
  size: number;
  cdnPath: string;
}

interface IllustrationObject {
  primary: IllustrationMetadata;
  thumbnails?: {
    small: IllustrationMetadata;
    medium: IllustrationMetadata;
  };
}

// Interface for page attributes
export interface PageAttributes {
  id: string;
  bookId: string;
  pageNumber: number;
  content: string;
  illustrations: IllustrationObject;
  version: number;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Interface for pagination options
interface PaginationOptions {
  limit: number;
  offset: number;
  orderBy?: string;
  direction?: 'ASC' | 'DESC';
}

@Table({
  tableName: 'pages',
  paranoid: true,
  indexes: [
    {
      fields: ['bookId', 'pageNumber'],
      unique: true
    },
    {
      fields: ['bookId', 'isDeleted']
    }
  ]
})
export class Page extends Model<PageAttributes> {
  @Column({
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  })
  declare id: string;

  @Column({
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'books',
      key: 'id'
    }
  })
  declare bookId: string;

  @Column({
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: {
      min: 1,
      max: 100 // Maximum pages per book
    }
  })
  declare pageNumber: number;

  @Column({
    type: DataTypes.TEXT,
    allowNull: false,
    validate: {
      len: [1, 10000] // Maximum content length
    }
  })
  declare content: string;

  @Column({
    type: DataTypes.JSONB,
    allowNull: false
  })
  declare illustrations: IllustrationObject;

  @Column({
    type: DataTypes.INTEGER,
    defaultValue: 1
  })
  declare version: number;

  @Column({
    type: DataTypes.BOOLEAN,
    defaultValue: false
  })
  declare isDeleted: boolean;

  @Column({
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  })
  declare createdAt: Date;

  @Column({
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  })
  declare updatedAt: Date;

  // Define relationship with Book model
  @BelongsTo(() => Book, {
    foreignKey: 'bookId',
    onDelete: 'CASCADE'
  })
  declare book: Book;

  // Content validation method
  private async validateContent(content: string): Promise<boolean> {
    try {
      // Sanitize content
      const sanitizedContent = DOMPurify.sanitize(content, {
        ALLOWED_TAGS: ['p', 'b', 'i', 'em', 'strong'],
        ALLOWED_ATTR: []
      });

      // Validate content length
      if (!validator.isLength(sanitizedContent, { min: 1, max: 10000 })) {
        throw new Error('Content length must be between 1 and 10000 characters');
      }

      // Additional content validation rules
      if (validator.isEmpty(sanitizedContent.trim())) {
        throw new Error('Content cannot be empty');
      }

      return true;
    } catch (error) {
      Logger.error('Content validation failed', { error });
      metricsCollector.incrementCounter('content_validation_failures');
      return false;
    }
  }

  // Illustration validation method
  private async validateIllustrations(illustrations: IllustrationObject): Promise<boolean> {
    try {
      const validateMetadata = (metadata: IllustrationMetadata) => {
        if (!validator.isURL(metadata.url)) {
          throw new Error('Invalid illustration URL');
        }
        if (!validator.isURL(metadata.cdnPath)) {
          throw new Error('Invalid CDN path');
        }
        if (metadata.width <= 0 || metadata.height <= 0) {
          throw new Error('Invalid illustration dimensions');
        }
      };

      // Validate primary illustration
      validateMetadata(illustrations.primary);

      // Validate thumbnails if present
      if (illustrations.thumbnails) {
        validateMetadata(illustrations.thumbnails.small);
        validateMetadata(illustrations.thumbnails.medium);
      }

      return true;
    } catch (error) {
      Logger.error('Illustration validation failed', { error });
      metricsCollector.incrementCounter('illustration_validation_failures');
      return false;
    }
  }

  // Static method to find pages by book ID with pagination
  static async findPagesByBookId(
    bookId: string,
    options: PaginationOptions,
    transaction?: Transaction
  ): Promise<{ rows: Page[]; count: number }> {
    const startTime = Date.now();
    try {
      const result = await Page.findAndCountAll({
        where: {
          bookId,
          isDeleted: false
        },
        order: [[options.orderBy || 'pageNumber', options.direction || 'ASC']],
        limit: options.limit,
        offset: options.offset,
        transaction
      });

      metricsCollector.recordTiming('find_pages_duration', Date.now() - startTime);
      return result;
    } catch (error) {
      Logger.error('Error finding pages by book ID', { error, bookId });
      metricsCollector.incrementCounter('find_pages_errors');
      throw error;
    }
  }

  // Method to update page content with validation
  static async updatePageContent(
    id: string,
    content: string,
    illustrations: IllustrationObject,
    transaction?: Transaction
  ): Promise<Page> {
    const page = await Page.findByPk(id, { transaction });
    if (!page) {
      throw new Error('Page not found');
    }

    // Validate content and illustrations
    const isContentValid = await page.validateContent(content);
    const areIllustrationsValid = await page.validateIllustrations(illustrations);

    if (!isContentValid || !areIllustrationsValid) {
      throw new Error('Invalid content or illustrations');
    }

    // Update page with new version
    return await page.update({
      content,
      illustrations,
      version: page.version + 1
    }, { transaction });
  }

  // Method to reorder pages within a book
  static async reorderPages(
    bookId: string,
    pageOrders: { id: string; pageNumber: number }[],
    transaction?: Transaction
  ): Promise<boolean> {
    try {
      await sequelize.transaction(async (t: Transaction) => {
        const finalTransaction = transaction || t;
        
        for (const order of pageOrders) {
          await Page.update(
            { pageNumber: order.pageNumber },
            {
              where: { id: order.id, bookId },
              transaction: finalTransaction
            }
          );
        }
      });
      
      return true;
    } catch (error) {
      Logger.error('Error reordering pages', { error, bookId });
      metricsCollector.incrementCounter('reorder_pages_errors');
      throw error;
    }
  }
}

// Initialize hooks for validation and monitoring
Page.beforeCreate(async (page: Page) => {
  const isContentValid = await page.validateContent(page.content);
  const areIllustrationsValid = await page.validateIllustrations(page.illustrations);
  
  if (!isContentValid || !areIllustrationsValid) {
    throw new Error('Validation failed for new page');
  }
});

Page.beforeUpdate(async (page: Page) => {
  if (page.changed('content')) {
    const isContentValid = await page.validateContent(page.content);
    if (!isContentValid) {
      throw new Error('Content validation failed');
    }
  }
  
  if (page.changed('illustrations')) {
    const areIllustrationsValid = await page.validateIllustrations(page.illustrations);
    if (!areIllustrationsValid) {
      throw new Error('Illustrations validation failed');
    }
  }
});

export default Page;