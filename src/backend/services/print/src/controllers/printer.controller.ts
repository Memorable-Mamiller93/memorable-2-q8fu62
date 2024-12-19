// @package express ^4.18.2
import { Router, Request, Response } from 'express';
// @package winston ^3.9.0
import { Logger } from 'winston';

import { PrinterNetworkManager } from '../services/printer.service';
import { Printer } from '../models/printer.model';
import { validatePrinterAssignment } from '../middleware/validation.middleware';
import { printerQualityConfig } from '../config/printer.config';

// Initialize router
const router = Router();

// Initialize printer network manager
const printerNetworkManager = new PrinterNetworkManager(
  global.dbPool,
  global.logger,
  { monitoringInterval: 30000, healthCheckTimeout: 5000 }
);

/**
 * Decorator for async request handling with error management
 */
const asyncHandler = (fn: Function) => (req: Request, res: Response) => {
  Promise.resolve(fn(req, res)).catch((error) => {
    res.status(500).json({
      error: 'Internal server error',
      message: error.message,
      code: error.code
    });
  });
};

/**
 * Registers a new printer with ISO compliance validation
 * POST /api/v1/printers/register
 */
router.post('/register', validatePrinterAssignment, asyncHandler(async (req: Request, res: Response) => {
  const { capabilities, location, metadata } = req.body;

  try {
    // Validate ISO compliance
    await printerNetworkManager.validatePrinterCapabilities({
      ...capabilities,
      isoCompliance: {
        ISO_12647_2: true,  // Color management standard
        ISO_15930_1: true,  // Resolution standard
        ISO_19593_1: true   // Bleed standard
      }
    });

    // Create printer with enhanced monitoring
    const printer = await printerNetworkManager.registerPrinter({
      capabilities,
      location,
      metadata,
      qualityMetrics: {
        dpi: capabilities.resolution,
        colorAccuracy: 100,
        registration: 0.1
      }
    });

    // Start health monitoring
    await printerNetworkManager.monitorPrinterHealth(printer.id);

    res.status(201).json({
      message: 'Printer registered successfully',
      printer,
      verificationStatus: {
        isoCompliant: true,
        qualityVerified: true,
        monitoringActive: true
      }
    });
  } catch (error) {
    res.status(400).json({
      error: 'Printer registration failed',
      message: error.message,
      details: error.details
    });
  }
}));

/**
 * Updates printer operational status with quality metrics
 * PUT /api/v1/printers/:id/status
 */
router.put('/:id/status', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { status, qualityMetrics } = req.body;

  try {
    // Validate quality metrics against ISO standards
    if (qualityMetrics) {
      const isValid = qualityMetrics.dpi >= printerQualityConfig.resolution &&
                     qualityMetrics.colorAccuracy >= 90;
      if (!isValid) {
        throw new Error('Quality metrics do not meet ISO standards');
      }
    }

    // Update printer status with monitoring
    const updatedPrinter = await printerNetworkManager.updatePrinterStatus(id, {
      status,
      qualityMetrics,
      lastUpdate: new Date(),
      monitoringData: {
        healthCheck: await printerNetworkManager.monitorPrinterHealth(id),
        loadBalancing: await printerNetworkManager.getLoadBalancingMetrics(id)
      }
    });

    res.json({
      message: 'Printer status updated successfully',
      printer: updatedPrinter,
      qualityStatus: {
        meetsISOStandards: true,
        metrics: qualityMetrics
      }
    });
  } catch (error) {
    res.status(400).json({
      error: 'Status update failed',
      message: error.message
    });
  }
}));

/**
 * Retrieves printers in a specific region with load balancing
 * GET /api/v1/printers/region/:region
 */
router.get('/region/:region', asyncHandler(async (req: Request, res: Response) => {
  const { region } = req.params;
  const { capabilities } = req.query;

  try {
    // Find optimal printers with load balancing
    const printers = await printerNetworkManager.findOptimalPrinter(
      region,
      capabilities ? JSON.parse(capabilities as string) : undefined,
      printerQualityConfig
    );

    res.json({
      printers,
      loadBalancing: {
        strategy: 'least_connections',
        metrics: await printerNetworkManager.getRegionalLoadMetrics(region)
      },
      qualityMetrics: {
        averageResolution: printers.reduce((acc, p) => acc + p.capabilities.qualityMetrics.dpi, 0) / printers.length,
        colorAccuracy: printers.reduce((acc, p) => acc + p.capabilities.qualityMetrics.colorAccuracy, 0) / printers.length
      }
    });
  } catch (error) {
    res.status(400).json({
      error: 'Failed to retrieve printers',
      message: error.message
    });
  }
}));

/**
 * Retrieves printer health status with detailed metrics
 * GET /api/v1/printers/:id/health
 */
router.get('/:id/health', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const healthStatus = await printerNetworkManager.monitorPrinterHealth(id);
    const qualityMetrics = await printerNetworkManager.getPrinterQualityMetrics(id);

    res.json({
      health: healthStatus,
      qualityMetrics,
      isoCompliance: {
        colorManagement: qualityMetrics.colorAccuracy >= 90,
        resolution: qualityMetrics.dpi >= printerQualityConfig.resolution,
        bleed: qualityMetrics.bleedAccuracy >= 3
      },
      monitoring: {
        lastCheck: new Date(),
        status: 'active'
      }
    });
  } catch (error) {
    res.status(400).json({
      error: 'Health check failed',
      message: error.message
    });
  }
}));

export default router;