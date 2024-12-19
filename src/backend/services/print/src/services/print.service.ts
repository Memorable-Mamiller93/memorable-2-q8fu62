// @package bull ^4.10.0 - Advanced job queue management
import Queue from 'bull';
// @package winston ^3.9.0 - Enhanced logging
import { createLogger, format, transports } from 'winston';
// @package prom-client ^14.0.0 - Metrics collection
import { Counter, Gauge } from 'prom-client';

import { Print, PrintStatus, PrintQuality } from '../models/print.model';
import { Printer, PrinterStatus, PrinterCapabilities } from '../models/printer.model';
import { 
  printerQualityConfig, 
  printerNetworkConfig, 
  printerRegionalConfig,
  LoadBalancingStrategy,
  RegionalLoadBalancingStrategy 
} from '../config/printer.config';

/**
 * Enhanced PrintService class implementing ISO-compliant print job management
 * with distributed printer network orchestration and advanced monitoring
 */
export class PrintService {
  private printQueue: Queue.Queue;
  private readonly logger: any;
  private printJobMetrics: Counter;
  private printerLoadMetrics: Gauge;
  private readonly ISO_STANDARDS = {
    COLOR_MANAGEMENT: 'ISO 12647-2',
    RESOLUTION: 'ISO 15930-1',
    BLEED: 'ISO 19593-1'
  };

  constructor() {
    // Initialize Bull queue with priority levels
    this.printQueue = new Queue('print-jobs', {
      redis: {
        host: process.env.REDIS_HOST,
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD
      },
      defaultJobOptions: {
        attempts: printerNetworkConfig.retryAttempts,
        timeout: printerNetworkConfig.jobTimeoutMinutes * 60 * 1000,
        removeOnComplete: false
      }
    });

    // Initialize structured logging
    this.logger = createLogger({
      format: format.combine(
        format.timestamp(),
        format.json()
      ),
      transports: [
        new transports.Console(),
        new transports.File({ filename: 'print-service-error.log', level: 'error' }),
        new transports.File({ filename: 'print-service-combined.log' })
      ]
    });

    // Initialize Prometheus metrics
    this.printJobMetrics = new Counter({
      name: 'print_jobs_total',
      help: 'Total number of print jobs processed',
      labelNames: ['status', 'region', 'printer']
    });

    this.printerLoadMetrics = new Gauge({
      name: 'printer_load',
      help: 'Current load per printer',
      labelNames: ['printer_id', 'region']
    });

    this.initializeQueueProcessors();
  }

  /**
   * Creates and queues a new print job with ISO compliance validation
   * @param orderId Order identifier
   * @param bookId Book identifier
   * @param quality Print quality specifications
   * @param complianceLevel ISO compliance level required
   */
  public async createPrintJob(
    orderId: string,
    bookId: string,
    quality: PrintQuality,
    complianceLevel: string
  ): Promise<Print> {
    try {
      // Validate ISO compliance
      await this.validateISOCompliance(quality, complianceLevel);

      // Create print job record
      const printJob = await Print.create({
        orderId,
        bookId,
        status: PrintStatus.QUEUED,
        quality,
        metadata: {
          complianceLevel,
          isoStandards: this.ISO_STANDARDS,
          createdAt: new Date()
        }
      });

      // Queue job with appropriate priority
      await this.printQueue.add('new-print-job', {
        printJobId: printJob.id,
        quality,
        complianceLevel
      }, {
        priority: this.calculateJobPriority(quality, complianceLevel)
      });

      // Initialize monitoring metrics
      this.printJobMetrics.inc({ status: 'created' });

      this.logger.info('Print job created', {
        printJobId: printJob.id,
        orderId,
        bookId,
        quality
      });

      return printJob;
    } catch (error) {
      this.logger.error('Failed to create print job', {
        error: error.message,
        orderId,
        bookId
      });
      throw error;
    }
  }

  /**
   * Assigns printer based on load balancing and regional optimization
   * @param printJobId Print job identifier
   * @param criteria Printer selection criteria
   */
  public async assignPrinterToJob(
    printJobId: string,
    criteria: {
      region: string;
      quality: PrintQuality;
      priority: number;
    }
  ): Promise<Print> {
    try {
      // Get available printers in region
      const availablePrinters = await this.getAvailablePrinters(criteria.region);
      
      // Apply load balancing strategy
      const selectedPrinter = await this.applyLoadBalancingStrategy(
        availablePrinters,
        criteria
      );

      if (!selectedPrinter) {
        throw new Error('No suitable printer available');
      }

      // Update print job with printer assignment
      const updatedJob = await Print.update({
        printerId: selectedPrinter.id,
        status: PrintStatus.ASSIGNED,
        metadata: {
          assignedAt: new Date(),
          printerCapabilities: selectedPrinter.capabilities
        }
      }, {
        where: { id: printJobId }
      });

      // Update printer load metrics
      this.printerLoadMetrics.inc({
        printer_id: selectedPrinter.id,
        region: criteria.region
      });

      this.logger.info('Printer assigned to job', {
        printJobId,
        printerId: selectedPrinter.id,
        region: criteria.region
      });

      return updatedJob;
    } catch (error) {
      this.logger.error('Failed to assign printer', {
        error: error.message,
        printJobId
      });
      throw error;
    }
  }

  /**
   * Validates print quality specifications against ISO standards
   * @private
   */
  private async validateISOCompliance(
    quality: PrintQuality,
    complianceLevel: string
  ): Promise<void> {
    const validationErrors: string[] = [];

    // ISO 12647-2 color management validation
    if (quality.colorSpace !== printerQualityConfig.colorSpace) {
      validationErrors.push(
        `Color space must be ${printerQualityConfig.colorSpace} per ${this.ISO_STANDARDS.COLOR_MANAGEMENT}`
      );
    }

    // ISO 15930-1 resolution validation
    if (quality.resolution < printerQualityConfig.resolution) {
      validationErrors.push(
        `Resolution must be at least ${printerQualityConfig.resolution} DPI per ${this.ISO_STANDARDS.RESOLUTION}`
      );
    }

    // ISO 19593-1 bleed validation
    if (quality.bleed < printerQualityConfig.bleed) {
      validationErrors.push(
        `Bleed must be at least ${printerQualityConfig.bleed}mm per ${this.ISO_STANDARDS.BLEED}`
      );
    }

    if (validationErrors.length > 0) {
      throw new Error(`ISO compliance validation failed: ${validationErrors.join(', ')}`);
    }
  }

  /**
   * Initializes queue processors for print job handling
   * @private
   */
  private initializeQueueProcessors(): void {
    this.printQueue.process('new-print-job', async (job) => {
      try {
        const { printJobId, quality, complianceLevel } = job.data;
        
        // Assign printer
        await this.assignPrinterToJob(printJobId, {
          region: printerRegionalConfig.region,
          quality,
          priority: job.opts.priority || 0
        });

        // Monitor job progress
        await this.monitorPrintProgress(printJobId);

      } catch (error) {
        this.logger.error('Print job processing failed', {
          error: error.message,
          jobId: job.id
        });
        throw error;
      }
    });
  }

  /**
   * Applies configured load balancing strategy to select optimal printer
   * @private
   */
  private async applyLoadBalancingStrategy(
    printers: Printer[],
    criteria: { quality: PrintQuality; priority: number }
  ): Promise<Printer | null> {
    switch (printerNetworkConfig.loadBalancingStrategy) {
      case LoadBalancingStrategy.LEAST_CONNECTIONS:
        return this.selectLeastLoadedPrinter(printers);
      
      case LoadBalancingStrategy.WEIGHTED:
        return this.selectWeightedPrinter(printers, criteria);
      
      case LoadBalancingStrategy.ROUND_ROBIN:
      default:
        return this.selectRoundRobinPrinter(printers);
    }
  }

  /**
   * Calculates job priority based on quality requirements and compliance level
   * @private
   */
  private calculateJobPriority(
    quality: PrintQuality,
    complianceLevel: string
  ): number {
    let priority = 0;
    
    // Higher priority for stricter compliance requirements
    if (complianceLevel === 'strict') priority += 2;
    
    // Higher priority for higher resolution jobs
    if (quality.resolution > printerQualityConfig.resolution) priority += 1;
    
    return Math.min(priority, 3); // Max priority of 3
  }
}

export default PrintService;