// External dependencies with versions
import { injectable } from 'inversify'; // ^6.0.1
import { validate } from 'class-validator'; // ^0.14.0
import { BadRequestError } from '@memorable/error-handling'; // ^1.0.0
import { Transaction } from 'sequelize'; // ^6.32.1
import { Logger } from '@memorable/logging'; // ^1.0.0
import { Cache } from '@memorable/caching'; // ^1.0.0

// Internal dependencies
import { Page, PageAttributes } from '../models/page.model';
import { StorageService } from './storage.service';

// Interfaces for DTOs
interface CreatePageDto {
  bookId: string;
  pageNumber: number;
  content: string;
  illustrations: {
    primary: IllustrationMetadata;
    thumbnails?: {
      small: IllustrationMetadata;
      medium: IllustrationMetadata;
    };
  };
}

interface UpdatePageDto {
  content?: string;
  illustrations?: {
    primary: IllustrationMetadata;
    thumbnails?: {
      small: IllustrationMetadata;
      medium: IllustrationMetadata;
    };
  };
}

interface IllustrationMetadata {
  url: string;
  width: number;
  height: number;
  format: string;
  size: number;
  cdnPath: string;
}

interface PaginationOptions {
  limit: number;
  offset: number;
  orderBy?: string;
  direction?: 'ASC' | 'DESC';
}

interface PagedResponse<T> {
  items: T[];
  total: number;
  page: number;
  totalPages: number;
}

@injectable()
export class PageService {
  private readonly CACHE_TTL = 3600; // 1 hour cache TTL
  private readonly CACHE_PREFIX = 'page:';

  constructor(
    private readonly pageModel: typeof Page,
    private readonly storageService: StorageService,
    private readonly logger: Logger,
    private readonly cache: Cache
  ) {}

  /**
   * Creates a new page with optimized storage and caching
   * @param pageData Page creation data
   * @returns Created page instance
   */
  async createPage(pageData: CreatePageDto): Promise<PageAttributes> {
    try {
      // Validate input data
      const errors = await validate(pageData);
      if (errors.length > 0) {
        throw new BadRequestError('Invalid page data', errors);
      }

      // Start transaction
      const result = await this.pageModel.sequelize!.transaction(async (transaction: Transaction) => {
        // Optimize and upload illustrations
        const optimizedIllustrations = await this.processIllustrations(pageData.illustrations);

        // Create page record
        const page = await this.pageModel.create(
          {
            ...pageData,
            illustrations: optimizedIllustrations,
            version: 1
          },
          { transaction }
        );

        // Invalidate book pages cache
        await this.cache.del(`${this.CACHE_PREFIX}book:${pageData.bookId}`);

        return page;
      });

      this.logger.info('Page created successfully', {
        pageId: result.id,
        bookId: pageData.bookId
      });

      return result;
    } catch (error) {
      this.logger.error('Error creating page', { error, pageData });
      throw error;
    }
  }

  /**
   * Retrieves paginated book pages with caching
   * @param bookId Book identifier
   * @param options Pagination options
   * @returns Paginated page response
   */
  async getPagesByBookId(
    bookId: string,
    options: PaginationOptions
  ): Promise<PagedResponse<PageAttributes>> {
    try {
      // Check cache first
      const cacheKey = `${this.CACHE_PREFIX}book:${bookId}:${JSON.stringify(options)}`;
      const cached = await this.cache.get<PagedResponse<PageAttributes>>(cacheKey);
      
      if (cached) {
        return cached;
      }

      // Fetch pages with pagination
      const { rows, count } = await this.pageModel.findPagesByBookId(bookId, options);

      // Process results
      const result: PagedResponse<PageAttributes> = {
        items: rows.map(page => ({
          ...page.toJSON(),
          illustrations: this.generateCdnUrls(page.illustrations)
        })),
        total: count,
        page: Math.floor(options.offset / options.limit) + 1,
        totalPages: Math.ceil(count / options.limit)
      };

      // Cache results
      await this.cache.set(cacheKey, result, this.CACHE_TTL);

      return result;
    } catch (error) {
      this.logger.error('Error retrieving pages', { error, bookId });
      throw error;
    }
  }

  /**
   * Updates page content with optimized storage
   * @param pageId Page identifier
   * @param updateData Update data
   * @returns Updated page instance
   */
  async updatePage(pageId: string, updateData: UpdatePageDto): Promise<PageAttributes> {
    try {
      const result = await this.pageModel.sequelize!.transaction(async (transaction: Transaction) => {
        const page = await this.pageModel.findByPk(pageId, { transaction });
        
        if (!page) {
          throw new BadRequestError('Page not found');
        }

        let updatedIllustrations = page.illustrations;
        if (updateData.illustrations) {
          updatedIllustrations = await this.processIllustrations(updateData.illustrations);
        }

        const updatedPage = await this.pageModel.updatePageContent(
          pageId,
          updateData.content || page.content,
          updatedIllustrations,
          transaction
        );

        // Invalidate cache
        await this.cache.del(`${this.CACHE_PREFIX}book:${page.bookId}`);

        return updatedPage;
      });

      this.logger.info('Page updated successfully', { pageId });
      return result;
    } catch (error) {
      this.logger.error('Error updating page', { error, pageId });
      throw error;
    }
  }

  /**
   * Reorders pages within a book
   * @param bookId Book identifier
   * @param pageOrders New page order
   * @returns Success status
   */
  async reorderPages(
    bookId: string,
    pageOrders: Array<{ id: string; pageNumber: number }>
  ): Promise<boolean> {
    try {
      const result = await this.pageModel.reorderPages(bookId, pageOrders);
      
      // Invalidate cache
      await this.cache.del(`${this.CACHE_PREFIX}book:${bookId}`);

      this.logger.info('Pages reordered successfully', { bookId });
      return result;
    } catch (error) {
      this.logger.error('Error reordering pages', { error, bookId });
      throw error;
    }
  }

  /**
   * Processes and optimizes illustrations for storage
   * @param illustrations Illustration data
   * @returns Optimized illustration data
   */
  private async processIllustrations(illustrations: CreatePageDto['illustrations']) {
    const processImage = async (metadata: IllustrationMetadata) => {
      const optimized = await this.storageService.optimizeImage(metadata.url);
      const cdnUrl = await this.storageService.uploadFile(
        optimized.buffer,
        `illustrations/${metadata.format}`,
        {
          contentType: `image/${metadata.format}`,
          metadata: {
            width: optimized.width.toString(),
            height: optimized.height.toString()
          }
        }
      );

      return {
        ...metadata,
        url: cdnUrl,
        width: optimized.width,
        height: optimized.height,
        size: optimized.buffer.length
      };
    };

    return {
      primary: await processImage(illustrations.primary),
      thumbnails: illustrations.thumbnails ? {
        small: await processImage(illustrations.thumbnails.small),
        medium: await processImage(illustrations.thumbnails.medium)
      } : undefined
    };
  }

  /**
   * Generates CDN URLs for illustrations
   * @param illustrations Illustration data
   * @returns Illustrations with CDN URLs
   */
  private generateCdnUrls(illustrations: CreatePageDto['illustrations']) {
    return {
      primary: {
        ...illustrations.primary,
        url: this.storageService.generateCdnUrl(illustrations.primary.cdnPath)
      },
      thumbnails: illustrations.thumbnails ? {
        small: {
          ...illustrations.thumbnails.small,
          url: this.storageService.generateCdnUrl(illustrations.thumbnails.small.cdnPath)
        },
        medium: {
          ...illustrations.thumbnails.medium,
          url: this.storageService.generateCdnUrl(illustrations.thumbnails.medium.cdnPath)
        }
      } : undefined
    };
  }
}

export default PageService;