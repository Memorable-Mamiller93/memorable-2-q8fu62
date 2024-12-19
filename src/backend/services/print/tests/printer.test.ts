// @package jest ^29.6.0 - Testing framework with custom matchers for ISO compliance
import { jest } from '@jest/globals';
// @package supertest ^6.3.3 - HTTP assertions for API testing
import request from 'supertest';
// @package pg ^8.11.0 - PostgreSQL connection pool for test database
import { Pool } from 'pg';

import { 
  Printer, 
  PrinterStatus, 
  PrinterCapabilities 
} from '../src/models/printer.model';
import { PrinterNetworkManager } from '../src/services/printer.service';
import { 
  printerQualityConfig,
  printerNetworkConfig,
  LoadBalancingStrategy
} from '../src/config/printer.config';

// Mock Redis for testing
jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    set: jest.fn().mockResolvedValue('OK'),
    get: jest.fn().mockResolvedValue(null),
    del: jest.fn().mockResolvedValue(1)
  }));
});

describe('Printer Management System Tests', () => {
  let testDbPool: Pool;
  let printerManager: PrinterNetworkManager;
  let mockLogger: any;

  // ISO-compliant test printer data
  const testPrinterData: Partial<Printer> = {
    id: 'test-printer-1',
    name: 'ISO Test Printer',
    status: PrinterStatus.ACTIVE,
    capabilities: {
      supportedFormats: ['A4', 'A5'],
      maxPageSize: {
        width: 210,
        height: 297,
        units: 'mm'
      },
      duplexPrinting: true,
      colorPrinting: {
        supported: true,
        profiles: ['ISO_12647_2'],
        calibration: new Date()
      },
      supportedPaperStock: [{
        id: 'fsc-1',
        name: 'FSC-certified-matte',
        weight: 120,
        certification: 'FSC'
      }],
      isoCompliance: {
        ISO_12647_2: true,
        ISO_15930_1: true,
        ISO_19593_1: true
      },
      qualityMetrics: {
        dpi: 300,
        colorAccuracy: 95,
        registration: 0.1
      }
    },
    location: {
      region: 'NA',
      country: 'US',
      city: 'New York',
      coordinates: {
        latitude: 40.7128,
        longitude: -74.0060
      },
      timezone: 'America/New_York',
      serviceArea: {
        radius: 50,
        units: 'km',
        coverage: {
          type: 'Polygon',
          coordinates: [[[-74.1, 40.7], [-73.9, 40.7], [-73.9, 40.8], [-74.1, 40.8], [-74.1, 40.7]]]
        }
      }
    }
  };

  beforeAll(async () => {
    // Initialize test database connection
    testDbPool = new Pool({
      host: process.env.TEST_DB_HOST || 'localhost',
      port: parseInt(process.env.TEST_DB_PORT || '5432'),
      database: 'memorable_print_test',
      user: process.env.TEST_DB_USER,
      password: process.env.TEST_DB_PASSWORD
    });

    // Setup mock logger
    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn()
    };

    // Initialize printer network manager
    printerManager = new PrinterNetworkManager(
      testDbPool,
      mockLogger,
      {} as any, // Mock Redis client
      printerQualityConfig
    );

    // Clean test database
    await testDbPool.query('TRUNCATE TABLE printers CASCADE');
  });

  afterAll(async () => {
    await testDbPool.end();
  });

  describe('ISO-Compliant Printer Registration', () => {
    it('should successfully register a printer with ISO compliance validation', async () => {
      const result = await printerManager.registerPrinter(testPrinterData as Printer);

      expect(result).toBeDefined();
      expect(result.id).toBe(testPrinterData.id);
      expect(result.capabilities.isoCompliance.ISO_12647_2).toBe(true);
      expect(result.capabilities.qualityMetrics.dpi).toBeGreaterThanOrEqual(300);
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Printer registered'),
        expect.any(Object)
      );
    });

    it('should reject registration with non-compliant ISO specifications', async () => {
      const nonCompliantPrinter = {
        ...testPrinterData,
        id: 'test-printer-2',
        capabilities: {
          ...testPrinterData.capabilities,
          qualityMetrics: {
            dpi: 200, // Below ISO 15930-1 requirement
            colorAccuracy: 85,
            registration: 0.2
          }
        }
      };

      await expect(
        printerManager.registerPrinter(nonCompliantPrinter as Printer)
      ).rejects.toThrow('Resolution does not meet ISO 15930-1 standard');
    });
  });

  describe('Printer Network Monitoring', () => {
    it('should successfully start network monitoring with quality metrics', async () => {
      await printerManager.startNetworkMonitoring();

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Starting printer network monitoring',
        expect.any(Object)
      );
    });

    it('should detect and handle printer health issues', async () => {
      // Simulate printer health check failure
      const unhealthyPrinter = {
        ...testPrinterData,
        id: 'test-printer-3',
        status: PrinterStatus.ERROR_MINOR
      };

      await printerManager.registerPrinter(unhealthyPrinter as Printer);
      await printerManager.performHealthChecks();

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Printer failure detected'),
        expect.any(Object)
      );
    });
  });

  describe('Regional Load Balancing', () => {
    it('should find optimal printer based on regional distribution', async () => {
      const jobRequirements: PrinterCapabilities = {
        ...testPrinterData.capabilities as PrinterCapabilities
      };

      const optimalPrinter = await printerManager.findOptimalPrinter(
        'NA',
        jobRequirements,
        printerQualityConfig
      );

      expect(optimalPrinter).toBeDefined();
      expect(optimalPrinter.location.region).toBe('NA');
      expect(optimalPrinter.capabilities.isoCompliance.ISO_12647_2).toBe(true);
    });

    it('should handle printer failover in regional distribution', async () => {
      // Simulate primary printer failure
      await printerManager.updatePrinterStatus(
        testPrinterData.id!,
        PrinterStatus.ERROR_MAJOR
      );

      const jobRequirements: PrinterCapabilities = {
        ...testPrinterData.capabilities as PrinterCapabilities
      };

      await expect(
        printerManager.findOptimalPrinter('NA', jobRequirements, printerQualityConfig)
      ).rejects.toThrow('No eligible printers found in region NA');
    });
  });

  describe('Quality Metrics Tracking', () => {
    it('should track and validate printer quality metrics', async () => {
      const printer = await printerManager.getPrinterById(testPrinterData.id!);
      const qualityMetrics = printer.capabilities.qualityMetrics;

      expect(qualityMetrics.dpi).toBeGreaterThanOrEqual(300);
      expect(qualityMetrics.colorAccuracy).toBeGreaterThanOrEqual(90);
      expect(qualityMetrics.registration).toBeLessThanOrEqual(0.1);
    });

    it('should update quality metrics after calibration', async () => {
      const updatedMetrics = {
        dpi: 600,
        colorAccuracy: 98,
        registration: 0.05
      };

      await printerManager.updatePrinterQualityMetrics(
        testPrinterData.id!,
        updatedMetrics
      );

      const printer = await printerManager.getPrinterById(testPrinterData.id!);
      expect(printer.capabilities.qualityMetrics).toEqual(updatedMetrics);
    });
  });
});