// External dependencies with versions
import { describe, beforeEach, it, expect, jest } from '@jest/globals'; // ^29.6.2
import { faker } from '@faker-js/faker'; // ^8.0.2
import { Transaction } from 'sequelize'; // ^6.32.1

// Internal dependencies
import { PageService } from '../src/services/page.service';
import { Page } from '../src/models/page.model';
import { StorageService } from '../src/services/storage.service';
import { Logger } from '@memorable/logging';
import { Cache } from '@memorable/caching';

// Mock implementations
jest.mock('../src/models/page.model');
jest.mock('../src/services/storage.service');
jest.mock('@memorable/logging');
jest.mock('@memorable/caching');

// Test data factories
const createMockIllustration = () => ({
  url: faker.image.url(),
  width: faker.number.int({ min: 800, max: 2000 }),
  height: faker.number.int({ min: 600, max: 1500 }),
  format: 'jpeg',
  size: faker.number.int({ min: 50000, max: 2000000 }),
  cdnPath: `illustrations/${faker.string.uuid()}.jpeg`
});

const createMockPage = () => ({
  id: faker.string.uuid(),
  bookId: faker.string.uuid(),
  pageNumber: faker.number.int({ min: 1, max: 100 }),
  content: faker.lorem.paragraphs(),
  illustrations: {
    primary: createMockIllustration(),
    thumbnails: {
      small: createMockIllustration(),
      medium: createMockIllustration()
    }
  },
  version: 1,
  createdAt: new Date(),
  updatedAt: new Date()
});

describe('PageService', () => {
  let pageService: PageService;
  let mockPageModel: jest.Mocked<typeof Page>;
  let mockStorageService: jest.Mocked<typeof StorageService>;
  let mockLogger: jest.Mocked<typeof Logger>;
  let mockCache: jest.Mocked<typeof Cache>;
  let mockTransaction: jest.Mocked<Transaction>;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();

    // Initialize mocks
    mockPageModel = {
      create: jest.fn(),
      findByPk: jest.fn(),
      findPagesByBookId: jest.fn(),
      updatePageContent: jest.fn(),
      reorderPages: jest.fn(),
      sequelize: {
        transaction: jest.fn(callback => callback(mockTransaction))
      }
    } as unknown as jest.Mocked<typeof Page>;

    mockStorageService = {
      uploadFile: jest.fn(),
      getSignedUrl: jest.fn(),
      optimizeImage: jest.fn(),
      generateCdnUrl: jest.fn()
    } as unknown as jest.Mocked<typeof StorageService>;

    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn()
    } as unknown as jest.Mocked<typeof Logger>;

    mockCache = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn()
    } as unknown as jest.Mocked<typeof Cache>;

    mockTransaction = {
      commit: jest.fn(),
      rollback: jest.fn()
    } as unknown as jest.Mocked<Transaction>;

    // Initialize PageService with mocked dependencies
    pageService = new PageService(
      mockPageModel,
      mockStorageService,
      mockLogger,
      mockCache
    );
  });

  describe('createPage', () => {
    it('should create a page with valid data', async () => {
      // Arrange
      const mockPageData = {
        bookId: faker.string.uuid(),
        pageNumber: 1,
        content: faker.lorem.paragraphs(),
        illustrations: {
          primary: createMockIllustration(),
          thumbnails: {
            small: createMockIllustration(),
            medium: createMockIllustration()
          }
        }
      };

      const mockCreatedPage = createMockPage();
      mockPageModel.create.mockResolvedValue(mockCreatedPage);
      mockStorageService.optimizeImage.mockResolvedValue({
        buffer: Buffer.from('mock-image'),
        width: 1000,
        height: 800
      });
      mockStorageService.uploadFile.mockResolvedValue('https://cdn.example.com/image.jpg');

      // Act
      const result = await pageService.createPage(mockPageData);

      // Assert
      expect(result).toEqual(mockCreatedPage);
      expect(mockPageModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          bookId: mockPageData.bookId,
          pageNumber: mockPageData.pageNumber,
          content: mockPageData.content,
          version: 1
        }),
        { transaction: mockTransaction }
      );
      expect(mockCache.del).toHaveBeenCalledWith(`page:book:${mockPageData.bookId}`);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Page created successfully',
        expect.any(Object)
      );
    });

    it('should handle validation errors', async () => {
      // Arrange
      const invalidPageData = {
        bookId: faker.string.uuid(),
        pageNumber: -1, // Invalid page number
        content: '',    // Empty content
        illustrations: {
          primary: createMockIllustration()
        }
      };

      // Act & Assert
      await expect(pageService.createPage(invalidPageData))
        .rejects
        .toThrow('Invalid page data');
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should rollback transaction on failure', async () => {
      // Arrange
      const mockPageData = {
        bookId: faker.string.uuid(),
        pageNumber: 1,
        content: faker.lorem.paragraphs(),
        illustrations: {
          primary: createMockIllustration()
        }
      };

      mockStorageService.uploadFile.mockRejectedValue(new Error('Upload failed'));

      // Act & Assert
      await expect(pageService.createPage(mockPageData))
        .rejects
        .toThrow('Upload failed');
      expect(mockTransaction.rollback).toHaveBeenCalled();
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('getPagesByBookId', () => {
    it('should retrieve pages with pagination', async () => {
      // Arrange
      const bookId = faker.string.uuid();
      const mockPages = Array.from({ length: 5 }, createMockPage);
      const paginationOptions = {
        limit: 10,
        offset: 0
      };

      mockPageModel.findPagesByBookId.mockResolvedValue({
        rows: mockPages,
        count: mockPages.length
      });
      mockStorageService.generateCdnUrl.mockImplementation(path => `https://cdn.example.com/${path}`);

      // Act
      const result = await pageService.getPagesByBookId(bookId, paginationOptions);

      // Assert
      expect(result.items).toHaveLength(mockPages.length);
      expect(result.total).toBe(mockPages.length);
      expect(result.page).toBe(1);
      expect(mockCache.get).toHaveBeenCalled();
      expect(mockCache.set).toHaveBeenCalled();
    });

    it('should return cached results when available', async () => {
      // Arrange
      const bookId = faker.string.uuid();
      const cachedResult = {
        items: Array.from({ length: 3 }, createMockPage),
        total: 3,
        page: 1,
        totalPages: 1
      };

      mockCache.get.mockResolvedValue(cachedResult);

      // Act
      const result = await pageService.getPagesByBookId(bookId, {
        limit: 10,
        offset: 0
      });

      // Assert
      expect(result).toEqual(cachedResult);
      expect(mockPageModel.findPagesByBookId).not.toHaveBeenCalled();
    });
  });

  describe('updatePage', () => {
    it('should update page content and illustrations', async () => {
      // Arrange
      const pageId = faker.string.uuid();
      const existingPage = createMockPage();
      const updateData = {
        content: faker.lorem.paragraphs(),
        illustrations: {
          primary: createMockIllustration(),
          thumbnails: {
            small: createMockIllustration(),
            medium: createMockIllustration()
          }
        }
      };

      mockPageModel.findByPk.mockResolvedValue(existingPage);
      mockPageModel.updatePageContent.mockResolvedValue({
        ...existingPage,
        ...updateData,
        version: existingPage.version + 1
      });

      // Act
      const result = await pageService.updatePage(pageId, updateData);

      // Assert
      expect(result.version).toBe(existingPage.version + 1);
      expect(result.content).toBe(updateData.content);
      expect(mockCache.del).toHaveBeenCalledWith(`page:book:${existingPage.bookId}`);
    });

    it('should handle non-existent page', async () => {
      // Arrange
      const pageId = faker.string.uuid();
      mockPageModel.findByPk.mockResolvedValue(null);

      // Act & Assert
      await expect(pageService.updatePage(pageId, { content: 'test' }))
        .rejects
        .toThrow('Page not found');
    });
  });

  describe('reorderPages', () => {
    it('should reorder pages successfully', async () => {
      // Arrange
      const bookId = faker.string.uuid();
      const pageOrders = Array.from({ length: 3 }, (_, i) => ({
        id: faker.string.uuid(),
        pageNumber: i + 1
      }));

      mockPageModel.reorderPages.mockResolvedValue(true);

      // Act
      const result = await pageService.reorderPages(bookId, pageOrders);

      // Assert
      expect(result).toBe(true);
      expect(mockCache.del).toHaveBeenCalledWith(`page:book:${bookId}`);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Pages reordered successfully',
        expect.any(Object)
      );
    });

    it('should handle reordering errors', async () => {
      // Arrange
      const bookId = faker.string.uuid();
      const pageOrders = [{ id: faker.string.uuid(), pageNumber: 1 }];
      mockPageModel.reorderPages.mockRejectedValue(new Error('Reordering failed'));

      // Act & Assert
      await expect(pageService.reorderPages(bookId, pageOrders))
        .rejects
        .toThrow('Reordering failed');
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });
});