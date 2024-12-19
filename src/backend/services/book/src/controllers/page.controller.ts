// External dependencies with versions
import { Request, Response } from 'express'; // ^4.18.2
import { injectable } from 'inversify'; // ^6.0.1
import { controller, httpGet, httpPost, httpPut, httpDelete } from 'inversify-express-utils'; // ^6.4.3
import { Logger } from 'winston'; // ^3.8.2
import { RateLimit } from 'express-rate-limit'; // ^6.7.0
import { MetricsCollector } from '@memorable/metrics';

// Internal dependencies
import { PageService } from '../services/page.service';
import { validatePageUpdate } from '../middleware/validation.middleware';
import { BadRequestError, NotFoundError } from '@memorable/error-handling';

// Initialize metrics collector
const metricsCollector = new MetricsCollector('page_controller');

@controller('/api/v1/pages')
@injectable()
@RateLimit({
    windowMs: 60000, // 1 minute
    max: 100, // limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later'
})
export class PageController {
    constructor(
        private readonly pageService: PageService,
        private readonly logger: Logger
    ) {}

    /**
     * Creates a new page with enhanced validation and security
     * @param req Request object containing page data
     * @param res Response object
     */
    @httpPost('/')
    @validatePageUpdate
    async createPage(req: Request, res: Response): Promise<Response> {
        const startTime = Date.now();
        try {
            const pageData = req.body;
            const userId = req.user?.id; // Assuming user is attached by auth middleware

            if (!userId) {
                throw new BadRequestError('User authentication required');
            }

            const page = await this.pageService.createPage({
                ...pageData,
                userId
            });

            this.logger.info('Page created successfully', {
                pageId: page.id,
                bookId: page.bookId,
                userId
            });

            metricsCollector.recordTiming('page_creation_duration', Date.now() - startTime);
            metricsCollector.incrementCounter('pages_created');

            return res.status(201).json({
                success: true,
                data: page
            });
        } catch (error) {
            this.logger.error('Error creating page', {
                error,
                userId: req.user?.id,
                body: req.body
            });

            metricsCollector.incrementCounter('page_creation_errors');
            throw error;
        }
    }

    /**
     * Retrieves pages for a specific book with pagination
     * @param req Request object containing book ID and pagination params
     * @param res Response object
     */
    @httpGet('/book/:bookId')
    async getPagesByBookId(req: Request, res: Response): Promise<Response> {
        const startTime = Date.now();
        try {
            const { bookId } = req.params;
            const { limit = 10, offset = 0, orderBy, direction } = req.query;

            const pages = await this.pageService.getPagesByBookId(bookId, {
                limit: Number(limit),
                offset: Number(offset),
                orderBy: orderBy as string,
                direction: direction as 'ASC' | 'DESC'
            });

            metricsCollector.recordTiming('page_retrieval_duration', Date.now() - startTime);
            metricsCollector.incrementCounter('pages_retrieved');

            return res.status(200).json({
                success: true,
                data: pages
            });
        } catch (error) {
            this.logger.error('Error retrieving pages', {
                error,
                bookId: req.params.bookId,
                query: req.query
            });

            metricsCollector.incrementCounter('page_retrieval_errors');
            throw error;
        }
    }

    /**
     * Updates an existing page with content validation
     * @param req Request object containing page updates
     * @param res Response object
     */
    @httpPut('/:pageId')
    @validatePageUpdate
    async updatePage(req: Request, res: Response): Promise<Response> {
        const startTime = Date.now();
        try {
            const { pageId } = req.params;
            const updateData = req.body;
            const userId = req.user?.id;

            if (!userId) {
                throw new BadRequestError('User authentication required');
            }

            const updatedPage = await this.pageService.updatePage(pageId, updateData);

            this.logger.info('Page updated successfully', {
                pageId,
                userId
            });

            metricsCollector.recordTiming('page_update_duration', Date.now() - startTime);
            metricsCollector.incrementCounter('pages_updated');

            return res.status(200).json({
                success: true,
                data: updatedPage
            });
        } catch (error) {
            this.logger.error('Error updating page', {
                error,
                pageId: req.params.pageId,
                body: req.body
            });

            metricsCollector.incrementCounter('page_update_errors');
            throw error;
        }
    }

    /**
     * Reorders pages within a book
     * @param req Request object containing page order data
     * @param res Response object
     */
    @httpPut('/book/:bookId/reorder')
    async reorderPages(req: Request, res: Response): Promise<Response> {
        const startTime = Date.now();
        try {
            const { bookId } = req.params;
            const { pageOrders } = req.body;

            if (!Array.isArray(pageOrders)) {
                throw new BadRequestError('Invalid page order data');
            }

            const success = await this.pageService.reorderPages(bookId, pageOrders);

            this.logger.info('Pages reordered successfully', {
                bookId,
                pageCount: pageOrders.length
            });

            metricsCollector.recordTiming('page_reorder_duration', Date.now() - startTime);
            metricsCollector.incrementCounter('pages_reordered');

            return res.status(200).json({
                success,
                message: 'Pages reordered successfully'
            });
        } catch (error) {
            this.logger.error('Error reordering pages', {
                error,
                bookId: req.params.bookId,
                body: req.body
            });

            metricsCollector.incrementCounter('page_reorder_errors');
            throw error;
        }
    }

    /**
     * Deletes a page with proper cleanup
     * @param req Request object containing page ID
     * @param res Response object
     */
    @httpDelete('/:pageId')
    async deletePage(req: Request, res: Response): Promise<Response> {
        const startTime = Date.now();
        try {
            const { pageId } = req.params;
            const userId = req.user?.id;

            if (!userId) {
                throw new BadRequestError('User authentication required');
            }

            await this.pageService.deletePage(pageId);

            this.logger.info('Page deleted successfully', {
                pageId,
                userId
            });

            metricsCollector.recordTiming('page_deletion_duration', Date.now() - startTime);
            metricsCollector.incrementCounter('pages_deleted');

            return res.status(200).json({
                success: true,
                message: 'Page deleted successfully'
            });
        } catch (error) {
            this.logger.error('Error deleting page', {
                error,
                pageId: req.params.pageId
            });

            metricsCollector.incrementCounter('page_deletion_errors');
            throw error;
        }
    }
}

export default PageController;