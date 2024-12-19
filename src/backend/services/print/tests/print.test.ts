// @package jest ^29.6.0 - Testing framework
import { describe, beforeAll, beforeEach, afterEach, it, expect } from 'jest';
// @package supertest ^6.3.3 - HTTP testing
import request from 'supertest';
// @package bull ^4.10.0 - Queue testing
import Queue from 'bull';

import { PrintService } from '../src/services/print.service';
import { Print, PrintStatus, PrintQuality } from '../src/models/print.model';
import { Printer, PrinterStatus, PrinterCapabilities } from '../src/models/printer.model';
import { 
  printerQualityConfig,
  printerNetworkConfig,
  printerRegionalConfig,
  ColorSpace,
  LoadBalancingStrategy
} from '../src/config/printer.config';

describe('PrintService Integration Tests', () => {
  let printService: PrintService;
  let mockPrintQueue: Queue.Queue;

  // Mock data for testing
  const mockPrintQuality: PrintQuality = {
    colorSpace: 'CMYK',
    colorProfile: 'ISO-Coated-v2-300',
    resolution: 300,
    paperType: 'FSC-certified-matte',
    paperWeight: 150,
    bleed: 3,
    trimBox: {
      width: 210,
      height: 297,
      units: 'mm'
    },
    printMarks: {
      cropMarks: true,
      registrationMarks: true,
      colorBars: true,
      pageInformation: true
    }
  };

  const mockPrinterCapabilities: PrinterCapabilities = {
    supportedFormats: ['A4', 'A5'],
    maxPageSize: {
      width: 330,
      height: 480,
      units: 'mm'
    },
    duplexPrinting: true,
    colorPrinting: {
      supported: true,
      profiles: ['ISO-Coated-v2-300'],
      calibration: new Date()
    },
    supportedPaperStock: [{
      id: '1',
      name: 'FSC-certified-matte',
      weight: 150,
      certification: 'FSC'
    }],
    isoCompliance: {
      ISO_12647_2: true,
      ISO_15930_1: true,
      ISO_19593_1: true
    },
    qualityMetrics: {
      dpi: 300,
      colorAccuracy: 98,
      registration: 0.1
    }
  };

  beforeAll(async () => {
    // Initialize test environment
    mockPrintQueue = new Queue('test-print-queue', {
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379')
      }
    });

    // Clear existing data
    await mockPrintQueue.empty();
  });

  beforeEach(() => {
    printService = new PrintService();
  });

  afterEach(async () => {
    await mockPrintQueue.empty();
  });

  describe('ISO-Compliant Print Job Creation', () => {
    it('should create print job with valid ISO specifications', async () => {
      const orderId = 'test-order-123';
      const bookId = 'test-book-123';
      
      const result = await printService.createPrintJob(
        orderId,
        bookId,
        mockPrintQuality,
        'strict'
      );

      expect(result).toBeDefined();
      expect(result.status).toBe(PrintStatus.QUEUED);
      expect(result.quality).toMatchObject(mockPrintQuality);
      expect(result.metadata.complianceLevel).toBe('strict');
    });

    it('should reject print job with non-compliant color space', async () => {
      const invalidQuality = {
        ...mockPrintQuality,
        colorSpace: 'RGB'
      };

      await expect(printService.createPrintJob(
        'test-order',
        'test-book',
        invalidQuality,
        'strict'
      )).rejects.toThrow(/ISO compliance validation failed/);
    });

    it('should reject print job with insufficient resolution', async () => {
      const invalidQuality = {
        ...mockPrintQuality,
        resolution: 200
      };

      await expect(printService.createPrintJob(
        'test-order',
        'test-book',
        invalidQuality,
        'strict'
      )).rejects.toThrow(/Resolution must be at least 300 DPI/);
    });
  });

  describe('Regional Printer Assignment', () => {
    it('should assign printer based on regional availability', async () => {
      const printJob = await printService.createPrintJob(
        'test-order',
        'test-book',
        mockPrintQuality,
        'strict'
      );

      const result = await printService.assignPrinterToJob(printJob.id, {
        region: printerRegionalConfig.region,
        quality: mockPrintQuality,
        priority: 1
      });

      expect(result).toBeDefined();
      expect(result.status).toBe(PrintStatus.ASSIGNED);
      expect(result.metadata.assignedAt).toBeDefined();
    });

    it('should implement load balancing for printer assignment', async () => {
      const jobs = await Promise.all([
        printService.createPrintJob('order-1', 'book-1', mockPrintQuality, 'strict'),
        printService.createPrintJob('order-2', 'book-2', mockPrintQuality, 'strict'),
        printService.createPrintJob('order-3', 'book-3', mockPrintQuality, 'strict')
      ]);

      const assignments = await Promise.all(jobs.map(job => 
        printService.assignPrinterToJob(job.id, {
          region: printerRegionalConfig.region,
          quality: mockPrintQuality,
          priority: 1
        })
      ));

      const uniquePrinters = new Set(assignments.map(a => a.printerId));
      expect(uniquePrinters.size).toBeGreaterThan(1);
    });
  });

  describe('Quality Control Validation', () => {
    it('should validate print quality against ISO standards', async () => {
      const printJob = await printService.createPrintJob(
        'test-order',
        'test-book',
        mockPrintQuality,
        'strict'
      );

      const validationResult = await Print.validateQualitySpecifications(mockPrintQuality);
      expect(validationResult).toBe(true);
    });

    it('should perform comprehensive preflight checks', async () => {
      const printJob = await printService.createPrintJob(
        'test-order',
        'test-book',
        mockPrintQuality,
        'strict'
      );

      const preflightResult = await Print.performPreflightCheck(printJob.id);
      expect(preflightResult.passed).toBe(true);
      expect(preflightResult.issues).toHaveLength(0);
    });
  });

  describe('Performance Monitoring', () => {
    it('should track print job metrics', async () => {
      const printJob = await printService.createPrintJob(
        'test-order',
        'test-book',
        mockPrintQuality,
        'strict'
      );

      // Simulate job progress
      await printService.monitorPrintProgress(printJob.id);

      const updatedJob = await Print.findByPk(printJob.id);
      expect(updatedJob?.metadata.metrics).toBeDefined();
      expect(updatedJob?.metadata.metrics.startTime).toBeDefined();
    });

    it('should handle printer load balancing metrics', async () => {
      const printJob = await printService.createPrintJob(
        'test-order',
        'test-book',
        mockPrintQuality,
        'strict'
      );

      await printService.assignPrinterToJob(printJob.id, {
        region: printerRegionalConfig.region,
        quality: mockPrintQuality,
        priority: 1
      });

      const metrics = await printService['printerLoadMetrics'].get();
      expect(metrics).toBeDefined();
    });
  });
});