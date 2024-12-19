// @package pg ^8.11.0
import { Pool } from 'pg';
// @package uuid ^9.0.0
import { v4 as uuidv4 } from 'uuid';
import { pool } from '../config/database.config';
import { printerQualityConfig } from '../config/printer.config';

/**
 * Enhanced enum defining possible printer operational statuses with detailed state tracking
 */
export enum PrinterStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  MAINTENANCE_SCHEDULED = 'MAINTENANCE_SCHEDULED',
  MAINTENANCE_IN_PROGRESS = 'MAINTENANCE_IN_PROGRESS',
  ERROR_MINOR = 'ERROR_MINOR',
  ERROR_MAJOR = 'ERROR_MAJOR',
  CALIBRATING = 'CALIBRATING',
  WARMUP = 'WARMUP'
}

/**
 * Interface defining ISO-compliant printer technical capabilities
 */
export interface PrinterCapabilities {
  supportedFormats: string[];
  maxPageSize: {
    width: number;
    height: number;
    units: 'mm' | 'inches';
  };
  duplexPrinting: boolean;
  colorPrinting: {
    supported: boolean;
    profiles: string[];
    calibration: Date;
  };
  supportedPaperStock: Array<{
    id: string;
    name: string;
    weight: number;
    certification: string;
  }>;
  isoCompliance: {
    ISO_12647_2: boolean;  // Color management standard
    ISO_15930_1: boolean;  // Resolution standard
    ISO_19593_1: boolean;  // Bleed standard
  };
  qualityMetrics: {
    dpi: number;
    colorAccuracy: number;
    registration: number;
  };
}

/**
 * Interface defining printer geographical location with service area
 */
export interface PrinterLocation {
  region: string;
  country: string;
  city: string;
  coordinates: {
    latitude: number;
    longitude: number;
  };
  timezone: string;
  serviceArea: {
    radius: number;
    units: 'km' | 'miles';
    coverage: GeoJSON.Polygon;
  };
}

/**
 * Interface defining printer performance and quality metrics
 */
interface PrinterMetrics {
  uptime: number;
  totalJobs: number;
  successRate: number;
  averageJobDuration: number;
  qualityScore: number;
  lastMaintenanceDate: Date;
  nextMaintenanceDate: Date;
  loadBalancingScore: number;
}

/**
 * Main printer entity interface with comprehensive attributes
 */
export interface Printer {
  id: string;
  name: string;
  model: string;
  manufacturer: string;
  status: PrinterStatus;
  capabilities: PrinterCapabilities;
  location: PrinterLocation;
  metrics: PrinterMetrics;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Creates a new printer entity with enhanced validation and ISO compliance checks
 * @param printerData Printer creation data without system-generated fields
 * @returns Promise<Printer> Newly created printer entity with validation results
 */
export async function createPrinter(
  printerData: Omit<Printer, 'id' | 'createdAt' | 'updatedAt'>
): Promise<Printer> {
  // Validate ISO compliance
  validateISOCompliance(printerData.capabilities);

  const printer: Printer = {
    id: uuidv4(),
    ...printerData,
    createdAt: new Date(),
    updatedAt: new Date()
  };

  const query = `
    INSERT INTO printers (
      id, name, model, manufacturer, status,
      capabilities, location, metrics,
      created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    RETURNING *
  `;

  const values = [
    printer.id,
    printer.name,
    printer.model,
    printer.manufacturer,
    printer.status,
    JSON.stringify(printer.capabilities),
    JSON.stringify(printer.location),
    JSON.stringify(printer.metrics),
    printer.createdAt,
    printer.updatedAt
  ];

  const result = await pool.query(query, values);
  return result.rows[0];
}

/**
 * Updates printer status with enhanced state tracking and history
 * @param printerId Unique identifier of the printer
 * @param status New printer status
 * @param metadata Additional status update metadata
 */
export async function updatePrinterStatus(
  printerId: string,
  status: PrinterStatus,
  metadata: {
    reason: string;
    estimatedDuration?: number;
    priority: number;
  }
): Promise<void> {
  const query = `
    UPDATE printers
    SET status = $1,
        metrics = jsonb_set(
          metrics::jsonb,
          '{statusHistory}',
          (COALESCE(metrics->>'statusHistory', '[]')::jsonb || $2::jsonb)
        ),
        updated_at = $3
    WHERE id = $4
  `;

  const statusUpdate = {
    status,
    timestamp: new Date(),
    reason: metadata.reason,
    estimatedDuration: metadata.estimatedDuration,
    priority: metadata.priority
  };

  await pool.query(query, [
    status,
    JSON.stringify([statusUpdate]),
    new Date(),
    printerId
  ]);
}

/**
 * Validates printer capabilities against ISO standards
 * @param capabilities Printer capabilities to validate
 * @throws Error if capabilities don't meet ISO standards
 */
function validateISOCompliance(capabilities: PrinterCapabilities): void {
  // ISO 15930-1 compliance check (resolution)
  if (capabilities.qualityMetrics.dpi < 300) {
    throw new Error('Printer resolution does not meet ISO 15930-1 standard (minimum 300 DPI)');
  }

  // ISO 12647-2 compliance check (color profiles)
  if (capabilities.colorPrinting.supported) {
    const hasRequiredProfiles = capabilities.colorPrinting.profiles.some(
      profile => printerQualityConfig.colorProfiles.includes(profile)
    );
    if (!hasRequiredProfiles) {
      throw new Error('Printer color profiles do not meet ISO 12647-2 standard');
    }
  }

  // ISO 19593-1 compliance check (bleed support)
  const hasBleedSupport = capabilities.maxPageSize.width >= 3 && 
                         capabilities.maxPageSize.height >= 3;
  if (!hasBleedSupport) {
    throw new Error('Printer does not support required bleed area per ISO 19593-1');
  }
}