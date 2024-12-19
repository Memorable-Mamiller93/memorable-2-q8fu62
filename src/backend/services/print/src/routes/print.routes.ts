// @package express ^4.18.2
import { Router } from 'express';
// @package express-jwt ^8.4.1
import { authenticate } from 'express-jwt';
// @package express-rate-limit ^6.9.0
import rateLimit from 'express-rate-limit';
// @package express-cache-middleware ^1.0.0
import cache from 'express-cache-middleware';

import { PrintController } from '../controllers/print.controller';
import { 
  validateCreatePrintJob,
  validatePrinterAssignment,
  validateQualityControl
} from '../middleware/validation.middleware';

// Rate limiting configuration for API protection
const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes
const MAX_REQUESTS = 100;

const printRouter = Router();

// Configure rate limiting
const apiLimiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW,
  max: MAX_REQUESTS,
  message: 'Too many requests from this IP, please try again later'
});

// Configure route caching
const cacheMiddleware = cache({
  expire: 5 * 60 * 1000 // 5 minutes cache
});

/**
 * Print service router configuration with ISO compliance and regional routing
 * Implements standards:
 * - ISO 12647-2 (Color management)
 * - ISO 15930-1 (Resolution)
 * - ISO 19593-1 (Bleed)
 */
export function configureRoutes(printController: PrintController): Router {
  // Apply global middleware
  printRouter.use(apiLimiter);
  printRouter.use(authenticate({
    secret: process.env.JWT_SECRET!,
    algorithms: ['RS256']
  }));

  /**
   * Create new print job with ISO compliance validation
   * POST /api/print/jobs
   */
  printRouter.post('/jobs',
    validateCreatePrintJob,
    async (req, res) => {
      await printController.createPrintJob(req, res);
    }
  );

  /**
   * Assign printer to job with regional optimization
   * PUT /api/print/jobs/:jobId/printer
   */
  printRouter.put('/jobs/:jobId/printer',
    validatePrinterAssignment,
    async (req, res) => {
      await printController.assignPrinter(req, res);
    }
  );

  /**
   * Get print job status with quality metrics
   * GET /api/print/jobs/:jobId/status
   */
  printRouter.get('/jobs/:jobId/status',
    cacheMiddleware,
    async (req, res) => {
      await printController.getPrintJobStatus(req, res);
    }
  );

  /**
   * Cancel print job with cleanup
   * DELETE /api/print/jobs/:jobId
   */
  printRouter.delete('/jobs/:jobId',
    async (req, res) => {
      await printController.cancelPrintJob(req, res);
    }
  );

  /**
   * Retry failed print job
   * POST /api/print/jobs/:jobId/retry
   */
  printRouter.post('/jobs/:jobId/retry',
    async (req, res) => {
      await printController.retryPrintJob(req, res);
    }
  );

  /**
   * Validate quality control with ISO standards
   * POST /api/print/jobs/:jobId/quality-control
   */
  printRouter.post('/jobs/:jobId/quality-control',
    validateQualityControl,
    async (req, res) => {
      await printController.validateQualityControl(req, res);
    }
  );

  /**
   * Update shipping status for completed jobs
   * PUT /api/print/jobs/:jobId/shipping
   */
  printRouter.put('/jobs/:jobId/shipping',
    async (req, res) => {
      await printController.updateShippingStatus(req, res);
    }
  );

  /**
   * Get available printers in region with capabilities
   * GET /api/print/printers/regional
   */
  printRouter.get('/printers/regional',
    cacheMiddleware,
    async (req, res) => {
      await printController.getRegionalPrinters(req, res);
    }
  );

  // Error handling middleware
  printRouter.use((err: any, req: any, res: any, next: any) => {
    console.error('Print Service Error:', err);
    res.status(500).json({
      error: 'Internal server error',
      message: err.message,
      code: err.code || 'INTERNAL_ERROR'
    });
  });

  return printRouter;
}

export { printRouter };