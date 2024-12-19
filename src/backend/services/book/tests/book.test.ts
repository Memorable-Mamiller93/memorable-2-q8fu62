// External dependencies
import { jest, describe, beforeEach, afterEach, test, expect } from '@jest/globals'; // ^29.6.0
import { MockInstance } from 'jest-mock'; // ^29.6.0

// Internal dependencies
import { BookService } from '../src/services/book.service';
import { StorageService } from '../src/services/storage.service';
import { Book, BookStatus, BookMetadata } from '../src/models/book.model';
import { Theme } from '../src/models/theme.model';
import { Page } from '../src/models/page.model';

// Mock implementations
jest.mock('../src/services/storage.service');
jest.mock('../src/models/book.model');
jest.mock('../src/models/theme.model');
jest.mock('../src/models/page.model');

describe('BookService', () => {
    let bookService: BookService;
    let storageService: jest.Mocked<StorageService>;
    let mockBook: Partial<Book>;
    let mockTheme: Partial<Theme>;
    let mockPage: Partial<Page>;

    // Performance thresholds from technical specifications
    const PERFORMANCE_THRESHOLDS = {
        PAGE_LOAD: 3000, // 3s
        AI_GENERATION: 30000, // 30s
        ASSET_UPLOAD: 5000 // 5s
    };

    beforeEach(() => {
        // Reset all mocks
        jest.clearAllMocks();
        jest.useFakeTimers();

        // Initialize mocked storage service
        storageService = {
            uploadFile: jest.fn(),
            getSignedUrl: jest.fn(),
            downloadFile: jest.fn(),
            deleteFile: jest.fn()
        } as jest.Mocked<StorageService>;

        // Initialize book service with mocked dependencies
        bookService = new BookService(storageService);

        // Setup mock data
        mockTheme = {
            id: 'theme-123',
            name: 'Adventure',
            settings: {
                visualStyle: {
                    primaryColor: '#000000',
                    secondaryColor: '#ffffff',
                    fontScale: 1,
                    spacing: 1.5,
                    borderRadius: 4
                },
                narrativeTemplate: {
                    storyStructure: 'hero-journey',
                    characterRoles: ['protagonist', 'mentor'],
                    plotPoints: ['introduction', 'challenge', 'resolution'],
                    emotionalTone: 'uplifting'
                },
                printSpecifications: {
                    dpi: 300,
                    colorSpace: 'CMYK',
                    bleed: 3,
                    paperWeight: 100
                }
            }
        };

        mockBook = {
            id: 'book-123',
            userId: 'user-123',
            themeId: 'theme-123',
            title: 'Test Book',
            status: BookStatus.DRAFT,
            metadata: {
                characterInfo: {
                    name: 'Test Character',
                    age: 8,
                    interests: ['adventure', 'animals'],
                    traits: ['brave', 'curious']
                },
                cdnAssets: {
                    photos: [],
                    illustrations: {}
                },
                customization: {
                    colorScheme: 'default',
                    fontFamily: 'Arial',
                    printOptions: {
                        format: 'hardcover',
                        paperWeight: 100,
                        binding: 'perfect'
                    }
                },
                printSpecifications: {
                    dpi: 300,
                    colorSpace: 'CMYK',
                    bleed: 3,
                    trim: {
                        width: 210,
                        height: 297
                    }
                }
            }
        };

        mockPage = {
            id: 'page-123',
            bookId: 'book-123',
            pageNumber: 1,
            content: 'Test content',
            illustrations: {
                primary: {
                    url: 'https://cdn.memorable.com/test.jpg',
                    width: 1000,
                    height: 1000,
                    format: 'jpeg',
                    size: 1024,
                    cdnPath: '/books/test.jpg'
                }
            },
            version: 1
        };
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    test('createBook should create a new book with initial pages within performance threshold', async () => {
        const startTime = Date.now();
        const bookData = {
            userId: 'user-123',
            themeId: 'theme-123',
            title: 'Test Book',
            metadata: mockBook.metadata as BookMetadata
        };

        // Mock theme and book creation
        (Theme.findThemeById as jest.Mock).mockResolvedValue(mockTheme);
        (Book.create as jest.Mock).mockResolvedValue(mockBook);
        (Page.create as jest.Mock).mockResolvedValue(mockPage);

        const result = await bookService.createBook(bookData);

        // Verify performance
        const duration = Date.now() - startTime;
        expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.PAGE_LOAD);

        // Verify book creation
        expect(result).toBeDefined();
        expect(result.id).toBe(mockBook.id);
        expect(result.status).toBe(BookStatus.DRAFT);
        expect(Theme.findThemeById).toHaveBeenCalledWith(bookData.themeId);
        expect(Book.create).toHaveBeenCalledWith(
            expect.objectContaining({
                userId: bookData.userId,
                themeId: bookData.themeId,
                title: bookData.title,
                metadata: bookData.metadata
            }),
            expect.any(Object)
        );
    });

    test('getBookById should retrieve book with caching within performance threshold', async () => {
        const startTime = Date.now();
        
        (Book.findBookById as jest.Mock).mockResolvedValue(mockBook);

        const result = await bookService.getBookById('book-123');

        // Verify performance
        const duration = Date.now() - startTime;
        expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.PAGE_LOAD);

        // Verify book retrieval
        expect(result).toBeDefined();
        expect(result).toEqual(mockBook);
        expect(Book.findBookById).toHaveBeenCalledWith('book-123');
    });

    test('updateBook should update book metadata and status within performance threshold', async () => {
        const startTime = Date.now();
        const updateData = {
            title: 'Updated Book',
            status: BookStatus.COMPLETE,
            metadata: {
                characterInfo: {
                    name: 'Updated Character',
                    age: 9,
                    interests: ['science', 'space'],
                    traits: ['smart', 'determined']
                }
            }
        };

        (Book.findBookById as jest.Mock).mockResolvedValue({
            ...mockBook,
            save: jest.fn().mockResolvedValue({ ...mockBook, ...updateData })
        });

        const result = await bookService.updateBook('book-123', updateData);

        // Verify performance
        const duration = Date.now() - startTime;
        expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.PAGE_LOAD);

        // Verify book update
        expect(result).toBeDefined();
        expect(result.title).toBe(updateData.title);
        expect(result.status).toBe(updateData.status);
    });

    test('uploadBookAsset should handle file upload with CDN integration within performance threshold', async () => {
        const startTime = Date.now();
        const fileBuffer = Buffer.from('test image');
        const contentType = 'image/jpeg';
        const expectedCdnUrl = 'https://cdn.memorable.com/books/test.jpg';

        (Book.findBookById as jest.Mock).mockResolvedValue(mockBook);
        storageService.uploadFile.mockResolvedValue(expectedCdnUrl);

        const result = await bookService.uploadBookAsset('book-123', fileBuffer, contentType);

        // Verify performance
        const duration = Date.now() - startTime;
        expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.ASSET_UPLOAD);

        // Verify file upload
        expect(result).toBe(expectedCdnUrl);
        expect(storageService.uploadFile).toHaveBeenCalledWith(
            fileBuffer,
            expect.stringContaining('books/book-123'),
            expect.objectContaining({
                contentType,
                encryption: true
            })
        );
    });

    test('getUserBooks should retrieve paginated books within performance threshold', async () => {
        const startTime = Date.now();
        const mockBooks = [mockBook];
        const mockTotal = 1;

        (Book.findBooksByUserId as jest.Mock).mockResolvedValue(mockBooks);
        (Book.count as jest.Mock).mockResolvedValue(mockTotal);

        const result = await bookService.getUserBooks('user-123', 1, 10);

        // Verify performance
        const duration = Date.now() - startTime;
        expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.PAGE_LOAD);

        // Verify books retrieval
        expect(result.books).toEqual(mockBooks);
        expect(result.total).toBe(mockTotal);
        expect(Book.findBooksByUserId).toHaveBeenCalledWith(
            'user-123',
            expect.objectContaining({
                limit: 10,
                offset: 0,
                order: [['createdAt', 'DESC']]
            })
        );
    });

    test('updateBookPages should update page content and illustrations within performance threshold', async () => {
        const startTime = Date.now();
        const pageData = {
            content: 'Updated content',
            illustrations: {
                primary: {
                    url: 'https://cdn.memorable.com/updated.jpg',
                    width: 1200,
                    height: 1200,
                    format: 'jpeg',
                    size: 2048,
                    cdnPath: '/books/updated.jpg'
                }
            }
        };

        (Page.findPagesByBookId as jest.Mock).mockResolvedValue({
            rows: [mockPage],
            count: 1
        });
        (Page.updatePageContent as jest.Mock).mockResolvedValue({
            ...mockPage,
            ...pageData
        });

        const result = await bookService.updateBookPages('book-123', 'page-123', pageData);

        // Verify performance
        const duration = Date.now() - startTime;
        expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.PAGE_LOAD);

        // Verify page update
        expect(result).toBeDefined();
        expect(result.content).toBe(pageData.content);
        expect(result.illustrations).toEqual(pageData.illustrations);
    });
});