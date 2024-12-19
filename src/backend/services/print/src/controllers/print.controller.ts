// @package express ^4.18.2
import { Request, Response } from 'express';

import { PrintService } from '../services/print.service';
import { Print, PrintStatus, PrintQuality, ISOStandards } from '../models/print.model';
import { validateCreatePrintJob } from '../middleware/validation.middleware';

/**
 * Controller handling print-related HTTP requests with ISO compliance validation
 * Implements print job management for distributed printing network
 */
export class PrintController {
  private readonly printService: PrintService;
  private readonly ISO_STANDARDS = {
    COLOR_MANAGEMENT: 'ISO 12647-2',
    RESOLUTION: 'ISO 15930-1',
    BLEED: 'ISO 19593-1'
  };

  constructor(printService: PrintService) {
    this.printService = printService;
  }

  /**
   * Creates a new ISO-compliant print job
   * Validates against ISO 12647-2 (color), 15930-1 (resolution), and 19593-1 (bleed)
   */
  public createPrintJob = async (req: Request, res: Response): Promise<void> => {
    try {
      const { orderId, bookId, quality } = req.body;

      // Enhanced validation with ISO compliance checks
      const validationResult = await validateCreatePrintJob(req, res, () => {});
      if (validationResult instanceof Error) {
        throw validationResult;
      }

      // Create print job with ISO compliance validation
      const printJob = await this.printService.createPrintJob(
        orderId,
        bookId,
        quality as PrintQuality,
        'strict' // Enforce strict ISO compliance
      );

      res.status(201).json({
        message: 'Print job created successfully',
        data: {
          printJobId: printJob.id,
          status: printJob.status,
          isoCompliance: {
            colorManagement: this.ISO_STANDARDS.COLOR_MANAGEMENT,
            resolution: this.ISO_STANDARDS.RESOLUTION,
            bleed: this.ISO_STANDARDS.BLEED
          },
          quality: printJob.quality,
          createdAt: printJob.createdAt
        }
      });
    } catch (error) {
      res.status(400).json({
        error: 'Failed to create print job',
        message: error.message,
        details: error.details || []
      });
    }
  };

  /**
   * Assigns printer to job based on ISO capabilities and regional optimization
   */
  public assignPrinter = async (req: Request, res: Response): Promise<void> => {
    try {
      const { printJobId } = req.params;
      const { region, quality, priority } = req.body;

      // Validate printer capabilities against ISO standards
      await this.printService.validateISOCompliance(quality, 'strict');

      // Assign printer with regional optimization
      const updatedJob = await this.printService.assignPrinterToJob(
        printJobId,
        {
          region,
          quality,
          priority: priority || 1
        }
      );

      res.status(200).json({
        message: 'Printer assigned successfully',
        data: {
          printJobId: updatedJob.id,
          printerId: updatedJob.printerId,
          status: updatedJob.status,
          assignedAt: updatedJob.metadata.assignedAt,
          printerCapabilities: updatedJob.metadata.printerCapabilities
        }
      });
    } catch (error) {
      res.status(400).json({
        error: 'Failed to assign printer',
        message: error.message
      });
    }
  };

  /**
   * Retrieves print job status with quality metrics and ISO compliance data
   */
  public getPrintJobStatus = async (req: Request, res: Response): Promise<void> => {
    try {
      const { printJobId } = req.params;

      // Get print job with detailed status
      const printJob = await Print.findByPk(printJobId);
      if (!printJob) {
        throw new Error('Print job not found');
      }

      // Perform quality check if job is in appropriate status
      let qualityMetrics = null;
      if (printJob.status === PrintStatus.QUALITY_CHECK) {
        qualityMetrics = await Print.performPreflightCheck(printJobId);
      }

      res.status(200).json({
        message: 'Print job status retrieved',
        data: {
          printJobId: printJob.id,
          status: printJob.status,
          quality: printJob.quality,
          isoCompliance: {
            colorManagement: {
              standard: this.ISO_STANDARDS.COLOR_MANAGEMENT,
              compliant: printJob.metadata?.isoCompliance?.colorManagement || false
            },
            resolution: {
              standard: this.ISO_STANDARDS.RESOLUTION,
              compliant: printJob.metadata?.isoCompliance?.resolution || false
            },
            bleed: {
              standard: this.ISO_STANDARDS.BLEED,
              compliant: printJob.metadata?.isoCompliance?.bleed || false
            }
          },
          qualityMetrics,
          timeline: {
            created: printJob.createdAt,
            started: printJob.startedAt,
            completed: printJob.completedAt
          },
          printer: printJob.printer ? {
            id: printJob.printer.id,
            status: printJob.printer.status,
            capabilities: printJob.printer.capabilities
          } : null
        }
      });
    } catch (error) {
      res.status(400).json({
        error: 'Failed to retrieve print job status',
        message: error.message
      });
    }
  };

  /**
   * Updates print job status with quality control validation
   */
  public updatePrintJobStatus = async (req: Request, res: Response): Promise<void> => {
    try {
      const { printJobId } = req.params;
      const { status, qualityCheck } = req.body;

      // Validate status transition
      const printJob = await Print.findByPk(printJobId);
      if (!printJob) {
        throw new Error('Print job not found');
      }

      // Perform quality checks for completion
      if (status === PrintStatus.COMPLETED) {
        const qualityResult = await Print.performPreflightCheck(printJobId);
        if (!qualityResult.passed) {
          throw new Error(`Quality check failed: ${qualityResult.issues.join(', ')}`);
        }
      }

      // Update job status with quality metrics
      await Print.update({
        status,
        qualityCheckResults: qualityCheck,
        completedAt: status === PrintStatus.COMPLETED ? new Date() : null
      }, {
        where: { id: printJobId }
      });

      res.status(200).json({
        message: 'Print job status updated',
        data: {
          printJobId,
          status,
          qualityCheck,
          updatedAt: new Date()
        }
      });
    } catch (error) {
      res.status(400).json({
        error: 'Failed to update print job status',
        message: error.message
      });
    }
  };
}

export default PrintController;