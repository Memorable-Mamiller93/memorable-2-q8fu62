// @package express ^4.18.2
import { Request, Response, NextFunction } from 'express';
// @package joi ^17.9.2
import Joi from 'joi';

import { PrintStatus } from '../models/print.model';
import { PrintQuality } from '../models/print.model';
import { PrinterStatus } from '../models/printer.model';

/**
 * Constants for ISO-compliant print specifications
 */
const ISO_STANDARDS = {
  MIN_RESOLUTION: 300, // DPI per ISO 15930-1
  MIN_BLEED: 3, // mm per ISO 19593-1
  COLOR_SPACE: 'CMYK', // per ISO 12647-2
  PAPER_CERTIFICATION: 'FSC', // Forest Stewardship Council certification
  ICC_PROFILES: ['ISO-Coated-v2-300', 'ISO-Coated-v2-eci']
};

/**
 * Print job creation validation schema with ISO compliance checks
 */
const createPrintJobSchema = Joi.object({
  orderId: Joi.string().uuid().required()
    .messages({
      'string.guid': 'Order ID must be a valid UUID',
      'any.required': 'Order ID is required'
    }),

  bookId: Joi.string().uuid().required()
    .messages({
      'string.guid': 'Book ID must be a valid UUID',
      'any.required': 'Book ID is required'
    }),

  quality: Joi.object({
    colorSpace: Joi.string().valid(ISO_STANDARDS.COLOR_SPACE).required()
      .messages({
        'any.only': `Color space must be ${ISO_STANDARDS.COLOR_SPACE} per ISO 12647-2`,
        'any.required': 'Color space specification is required'
      }),

    colorProfile: Joi.string().valid(...ISO_STANDARDS.ICC_PROFILES).required()
      .messages({
        'any.only': 'Invalid ICC color profile',
        'any.required': 'Color profile is required'
      }),

    resolution: Joi.number().min(ISO_STANDARDS.MIN_RESOLUTION).required()
      .messages({
        'number.min': `Resolution must be at least ${ISO_STANDARDS.MIN_RESOLUTION} DPI per ISO 15930-1`,
        'any.required': 'Resolution specification is required'
      }),

    paperType: Joi.string().pattern(new RegExp(ISO_STANDARDS.PAPER_CERTIFICATION)).required()
      .messages({
        'string.pattern.base': 'Paper stock must be FSC certified',
        'any.required': 'Paper type specification is required'
      }),

    bleed: Joi.number().min(ISO_STANDARDS.MIN_BLEED).required()
      .messages({
        'number.min': `Bleed must be at least ${ISO_STANDARDS.MIN_BLEED}mm per ISO 19593-1`,
        'any.required': 'Bleed specification is required'
      }),

    trimBox: Joi.object({
      width: Joi.number().positive().required(),
      height: Joi.number().positive().required(),
      units: Joi.string().valid('mm', 'inches').required()
    }).required()
  }).required()
}).options({ abortEarly: false });

/**
 * Printer assignment validation schema
 */
const printerAssignmentSchema = Joi.object({
  printerId: Joi.string().uuid().required(),
  printJobId: Joi.string().uuid().required(),
  capabilities: Joi.object({
    colorPrinting: Joi.boolean().required(),
    resolution: Joi.number().min(ISO_STANDARDS.MIN_RESOLUTION).required(),
    paperStock: Joi.array().items(Joi.string()).required()
  }).required()
}).options({ abortEarly: false });

/**
 * Status update validation schema with transition rules
 */
const statusUpdateSchema = Joi.object({
  status: Joi.string().valid(...Object.values(PrintStatus)).required(),
  metadata: Joi.object({
    reason: Joi.string().required(),
    qualityCheck: Joi.when('status', {
      is: PrintStatus.QUEUED,
      then: Joi.object({
        colorAccuracy: Joi.number().required(),
        registration: Joi.number().required(),
        densityReadings: Joi.object({
          cyan: Joi.number().required(),
          magenta: Joi.number().required(),
          yellow: Joi.number().required(),
          black: Joi.number().required()
        }).required()
      })
    })
  }).required()
}).options({ abortEarly: false });

/**
 * Validates print job creation request with ISO-compliant specifications
 */
export const validateCreatePrintJob = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    await createPrintJobSchema.validateAsync(req.body);
    next();
  } catch (error) {
    res.status(400).json({
      error: 'Validation failed',
      details: error.details.map((detail: any) => ({
        message: detail.message,
        path: detail.path
      }))
    });
  }
};

/**
 * Validates printer assignment request with capability matching
 */
export const validatePrinterAssignment = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    await printerAssignmentSchema.validateAsync(req.body);

    // Additional validation for printer status
    if (req.body.printerStatus !== PrinterStatus.ACTIVE) {
      throw new Error('Printer must be in ACTIVE status for assignment');
    }

    // Validate ISO compliance
    const { capabilities } = req.body;
    if (capabilities.resolution < ISO_STANDARDS.MIN_RESOLUTION) {
      throw new Error(`Printer resolution must meet ISO 15930-1 standard (${ISO_STANDARDS.MIN_RESOLUTION} DPI minimum)`);
    }

    next();
  } catch (error) {
    res.status(400).json({
      error: 'Printer assignment validation failed',
      message: error.message
    });
  }
};

/**
 * Validates print job status update with transition rules
 */
export const validateStatusUpdate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    await statusUpdateSchema.validateAsync(req.body);

    // Validate status transition rules
    const { currentStatus, newStatus } = req.body;
    const validTransitions: Record<PrintStatus, PrintStatus[]> = {
      [PrintStatus.QUEUED]: [PrintStatus.ASSIGNED],
      [PrintStatus.ASSIGNED]: [PrintStatus.PREFLIGHT_CHECK],
      [PrintStatus.PREFLIGHT_CHECK]: [PrintStatus.COLOR_CALIBRATION, PrintStatus.FAILED],
      [PrintStatus.COLOR_CALIBRATION]: [PrintStatus.PRINTING, PrintStatus.FAILED],
      [PrintStatus.PRINTING]: [PrintStatus.QUALITY_CHECK, PrintStatus.FAILED],
      [PrintStatus.QUALITY_CHECK]: [PrintStatus.COMPLETED, PrintStatus.FAILED],
      [PrintStatus.COMPLETED]: [],
      [PrintStatus.FAILED]: [PrintStatus.QUEUED],
      [PrintStatus.CANCELLED]: []
    };

    if (!validTransitions[currentStatus]?.includes(newStatus)) {
      throw new Error(`Invalid status transition from ${currentStatus} to ${newStatus}`);
    }

    next();
  } catch (error) {
    res.status(400).json({
      error: 'Status update validation failed',
      message: error.message
    });
  }
};