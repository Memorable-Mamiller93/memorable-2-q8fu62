/**
 * @fileoverview Print service API client for the Memorable platform frontend
 * Implements ISO-compliant print job management with comprehensive quality control
 * @version 1.0.0
 */

import { ApiResponse } from '../types/api.types';
import { apiClient } from '../config/api.config';
import { API_ENDPOINTS } from '../constants/api.constants';

// ISO Standards compliance versions
const ISO_VERSIONS = {
  COLOR_PROFILE: 'ISO 12647-2:2013', // Color management in print production
  RESOLUTION: 'ISO 15930-1:2001',    // PDF/X standards for print exchange
  BLEED: 'ISO 19593-1:2018',         // Processing steps for packaging
  PAPER: 'ISO 9706:1994'             // Paper permanence requirements
} as const;

/**
 * Print job request interface with ISO-compliant specifications
 */
export interface PrintJobRequest {
  bookId: string;
  printOptions: {
    format: string;
    paperType: string;
    colorProfile: 'CMYK' | 'RGB';
    binding: string;
    quantity: number;
    resolution: number;
    bleedSettings: {
      top: number;
      bottom: number;
      left: number;
      right: number;
    };
    paperCertification: 'FSC' | 'PEFC' | 'Other';
    printQuality: {
      dpi: number;
      lpi: number;
      screenAngle: number;
    };
    iccProfile: string;
    preflight: {
      enabled: boolean;
      checkList: string[];
    };
  };
}

/**
 * Print job details with quality validation results
 */
export interface PrintJob {
  id: string;
  bookId: string;
  status: string;
  printerId: string;
  createdAt: Date;
  updatedAt: Date;
  printOptions: PrintJobRequest['printOptions'];
  qualityChecks: {
    colorProfile: boolean;
    resolution: boolean;
    bleed: boolean;
    iccProfile: boolean;
  };
  printerCapabilities: {
    colorProfiles: string[];
    maxResolution: number;
    supportedPaperTypes: string[];
    certifications: string[];
  };
}

/**
 * Detailed print job status with quality metrics
 */
export interface PrintJobStatus {
  id: string;
  status: string;
  progress: number;
  estimatedCompletionTime: Date;
  lastUpdated: Date;
  qualityMetrics: {
    colorAccuracy: number;
    registration: number;
    density: number;
  };
  printerMetrics: {
    performance: number;
    reliability: number;
    qualityScore: number;
  };
}

/**
 * Validates print options against ISO standards
 * @param options Print job options to validate
 * @returns Validation result with any standard violations
 */
const validatePrintOptions = (options: PrintJobRequest['printOptions']): { 
  valid: boolean; 
  violations: string[]; 
} => {
  const violations: string[] = [];

  // ISO 12647-2 Color Profile Validation
  if (options.colorProfile === 'CMYK' && !options.iccProfile.includes('FOGRA')) {
    violations.push(`Color profile must be FOGRA-compliant per ${ISO_VERSIONS.COLOR_PROFILE}`);
  }

  // ISO 15930-1 Resolution Validation
  if (options.printQuality.dpi < 300) {
    violations.push(`Resolution must be at least 300 DPI per ${ISO_VERSIONS.RESOLUTION}`);
  }

  // ISO 19593-1 Bleed Validation
  const minBleed = 3; // 3mm minimum bleed
  if (Object.values(options.bleedSettings).some(bleed => bleed < minBleed)) {
    violations.push(`Bleed must be at least ${minBleed}mm per ${ISO_VERSIONS.BLEED}`);
  }

  return {
    valid: violations.length === 0,
    violations
  };
};

/**
 * Creates a new print job with ISO-compliant specifications and quality validation
 * @param request Print job request with detailed specifications
 * @returns Created print job details with validation results
 */
export const createPrintJob = async (
  request: PrintJobRequest
): Promise<ApiResponse<PrintJob>> => {
  // Validate against ISO standards
  const validation = validatePrintOptions(request.printOptions);
  if (!validation.valid) {
    throw new Error(`ISO compliance violations: ${validation.violations.join(', ')}`);
  }

  return apiClient.post<PrintJob>(
    API_ENDPOINTS.PRINT.SUBMIT,
    request
  );
};

/**
 * Retrieves detailed print job status including quality metrics
 * @param jobId Print job identifier
 * @returns Current status with comprehensive quality metrics
 */
export const getPrintJobStatus = async (
  jobId: string
): Promise<ApiResponse<PrintJobStatus>> => {
  return apiClient.get<PrintJobStatus>(
    API_ENDPOINTS.PRINT.STATUS.replace('{id}', jobId)
  );
};

/**
 * Cancels a print job with quality issue documentation
 * @param jobId Print job identifier
 * @returns Confirmation of cancellation
 */
export const cancelPrintJob = async (
  jobId: string
): Promise<ApiResponse<void>> => {
  return apiClient.delete<void>(
    `${API_ENDPOINTS.PRINT.STATUS.replace('{id}', jobId)}/cancel`
  );
};

/**
 * Retries a failed print job with enhanced quality checks
 * @param jobId Print job identifier
 * @returns Updated print job details
 */
export const retryPrintJob = async (
  jobId: string
): Promise<ApiResponse<PrintJob>> => {
  return apiClient.post<PrintJob>(
    `${API_ENDPOINTS.PRINT.STATUS.replace('{id}', jobId)}/retry`
  );
};

/**
 * Validates ICC color profile against ISO standards
 * @param iccProfile ICC profile identifier
 * @returns Validation result
 */
export const validateIccProfile = async (
  iccProfile: string
): Promise<ApiResponse<{ valid: boolean; details: string }>> => {
  return apiClient.post<{ valid: boolean; details: string }>(
    `${API_ENDPOINTS.PRINT.SUBMIT}/validate-icc`,
    { iccProfile }
  );
};

/**
 * Retrieves printer capabilities and certifications
 * @param printerId Printer identifier
 * @returns Printer specifications and quality metrics
 */
export const getPrinterCapabilities = async (
  printerId: string
): Promise<ApiResponse<PrintJob['printerCapabilities']>> => {
  return apiClient.get<PrintJob['printerCapabilities']>(
    `${API_ENDPOINTS.PRINT.GET_PROVIDERS}/${printerId}/capabilities`
  );
};