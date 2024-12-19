// @package sequelize ^6.32.1 - ORM for database interactions
import { Model, DataTypes } from 'sequelize';
// @package sequelize-typescript ^2.1.0 - TypeScript decorators for Sequelize
import { Table, Column, Index, BelongsTo, ForeignKey } from 'sequelize-typescript';
import { pool } from '../config/database.config';
import { Printer, PrinterStatus } from './printer.model';

/**
 * Enum defining possible print job statuses with ISO compliance tracking
 */
export enum PrintStatus {
  QUEUED = 'QUEUED',
  ASSIGNED = 'ASSIGNED',
  PREFLIGHT_CHECK = 'PREFLIGHT_CHECK',
  COLOR_CALIBRATION = 'COLOR_CALIBRATION',
  PRINTING = 'PRINTING',
  QUALITY_CHECK = 'QUALITY_CHECK',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED'
}

/**
 * Interface defining ISO-compliant print quality specifications
 */
export interface PrintQuality {
  colorSpace: string;      // CMYK color space per ISO 12647-2
  colorProfile: string;    // ICC color profile identifier
  resolution: number;      // DPI resolution (min 300) per ISO 15930-1
  paperType: string;       // FSC certified paper stock per ISO 9706
  paperWeight: number;     // Paper weight in gsm
  bleed: number;          // Bleed area in mm (3mm standard) per ISO 19593-1
  trimBox: {
    width: number;
    height: number;
    units: 'mm' | 'inches';
  };
  printMarks: {
    cropMarks: boolean;
    registrationMarks: boolean;
    colorBars: boolean;
    pageInformation: boolean;
  };
}

/**
 * Interface for quality check results with ISO compliance validation
 */
interface QualityCheckResult {
  timestamp: Date;
  colorAccuracy: number;   // Delta E measurement per ISO 12647-2
  registration: number;    // Registration accuracy in mm
  resolution: number;      // Actual printed DPI
  densityReadings: {      // Color density measurements
    cyan: number;
    magenta: number;
    yellow: number;
    black: number;
  };
  passed: boolean;
  notes: string[];
}

/**
 * Print model class for managing ISO-compliant book print jobs
 */
@Table({
  tableName: 'prints',
  timestamps: true,
  underscored: true
})
@Index(['order_id', 'status'])
@Index(['printer_id', 'status'])
export class Print extends Model {
  @Column({
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  })
  id!: string;

  @Column({
    type: DataTypes.UUID,
    allowNull: false
  })
  orderId!: string;

  @Column({
    type: DataTypes.UUID,
    allowNull: false
  })
  bookId!: string;

  @ForeignKey(() => Printer)
  @Column(DataTypes.UUID)
  printerId!: string;

  @Column({
    type: DataTypes.ENUM(...Object.values(PrintStatus)),
    allowNull: false,
    defaultValue: PrintStatus.QUEUED
  })
  status!: PrintStatus;

  @Column({
    type: DataTypes.JSONB,
    allowNull: false
  })
  quality!: PrintQuality;

  @Column(DataTypes.JSONB)
  qualityCheckResults?: QualityCheckResult;

  @Column(DataTypes.DATE)
  startedAt?: Date;

  @Column(DataTypes.DATE)
  completedAt?: Date;

  @Column({
    type: DataTypes.JSONB,
    defaultValue: {}
  })
  metadata: Record<string, any>;

  @BelongsTo(() => Printer)
  printer!: Printer;

  /**
   * Validates print quality specifications against ISO standards
   * @param quality Print quality specifications to validate
   * @returns Promise<boolean> Validation result with detailed error messages
   */
  static async validateQualitySpecifications(quality: PrintQuality): Promise<boolean> {
    const errors: string[] = [];

    // ISO 12647-2 color space validation
    if (quality.colorSpace !== 'CMYK') {
      errors.push('Color space must be CMYK per ISO 12647-2');
    }

    // ISO 15930-1 resolution validation
    if (quality.resolution < 300) {
      errors.push('Resolution must be at least 300 DPI per ISO 15930-1');
    }

    // ISO 19593-1 bleed validation
    if (quality.bleed < 3) {
      errors.push('Bleed must be at least 3mm per ISO 19593-1');
    }

    // Paper stock certification validation
    if (!quality.paperType.includes('FSC')) {
      errors.push('Paper stock must be FSC certified per ISO 9706');
    }

    if (errors.length > 0) {
      throw new Error(`Quality validation failed: ${errors.join(', ')}`);
    }

    return true;
  }

  /**
   * Performs comprehensive pre-flight validation of print job
   * @param printJobId ID of the print job to validate
   * @returns Promise<PreflightResult> Detailed preflight check results
   */
  static async performPreflightCheck(printJobId: string): Promise<{
    passed: boolean;
    issues: string[];
    recommendations: string[];
  }> {
    const printJob = await Print.findByPk(printJobId, {
      include: [Printer]
    });

    if (!printJob) {
      throw new Error('Print job not found');
    }

    const issues: string[] = [];
    const recommendations: string[] = [];

    // Validate printer capabilities
    if (printJob.printer.status !== PrinterStatus.ACTIVE) {
      issues.push('Assigned printer is not active');
    }

    // Validate quality specifications
    try {
      await Print.validateQualitySpecifications(printJob.quality);
    } catch (error) {
      issues.push(error.message);
    }

    // Check color profile compatibility
    if (!printJob.printer.capabilities.colorPrinting.profiles.includes(printJob.quality.colorProfile)) {
      issues.push('Selected color profile not supported by printer');
    }

    // Validate paper stock availability
    const supportedStock = printJob.printer.capabilities.supportedPaperStock.find(
      stock => stock.name === printJob.quality.paperType
    );
    if (!supportedStock) {
      issues.push('Selected paper stock not available');
    }

    return {
      passed: issues.length === 0,
      issues,
      recommendations
    };
  }
}

export default Print;