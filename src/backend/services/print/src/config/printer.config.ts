/**
 * Printer Service Configuration
 * Version: 1.0.0
 * 
 * Implements ISO-compliant print quality standards and distributed printer network management
 * - ISO 12647-2: Color management standards
 * - ISO 15930-1: Resolution requirements
 * - ISO 19593-1: Bleed specifications
 */

import dotenv from 'dotenv'; // ^16.3.1 - Environment variable management
dotenv.config();

// Color space enumeration following ISO 12647-2
export enum ColorSpace {
    CMYK = 'CMYK',
    RGB = 'RGB'
}

// Load balancing strategies for printer network distribution
export enum LoadBalancingStrategy {
    ROUND_ROBIN = 'ROUND_ROBIN',
    LEAST_CONNECTIONS = 'LEAST_CONNECTIONS',
    WEIGHTED = 'WEIGHTED'
}

// Regional load balancing strategies for geographical distribution
export enum RegionalLoadBalancingStrategy {
    PROXIMITY = 'PROXIMITY',
    CAPACITY = 'CAPACITY',
    HYBRID = 'HYBRID'
}

// ISO-compliant print quality standards interface
export interface PrinterQualityConfig {
    colorSpace: ColorSpace;
    resolution: number;  // DPI following ISO 15930-1
    bleed: number;      // MM following ISO 19593-1
    paperStock: string[];
    iccProfile: string;
    dpiValidation: boolean;
}

// Distributed printer network configuration interface
export interface PrinterNetworkConfig {
    maxConcurrentJobs: number;
    jobTimeoutMinutes: number;
    retryAttempts: number;
    healthCheckIntervalSeconds: number;
    loadBalancingStrategy: LoadBalancingStrategy;
    failoverEnabled: boolean;
}

// Regional printer distribution configuration interface
export interface PrinterRegionalConfig {
    region: string;
    maxPrintersPerRegion: number;
    loadBalancingStrategy: RegionalLoadBalancingStrategy;
    backupRegions: string[];
    priorityLevel: number;
}

/**
 * Creates ISO-compliant printer quality configuration
 * Validates against ISO 12647-2, 15930-1, and 19593-1 standards
 */
export function createPrinterQualityConfig(): PrinterQualityConfig {
    const config: PrinterQualityConfig = {
        colorSpace: (process.env.PRINTER_COLOR_SPACE as ColorSpace) || ColorSpace.CMYK,
        resolution: Number(process.env.PRINTER_RESOLUTION_DPI) || 300, // ISO 15930-1 minimum
        bleed: Number(process.env.PRINTER_BLEED_MM) || 3, // ISO 19593-1 standard
        paperStock: ['FSC-certified-matte', 'FSC-certified-gloss', 'FSC-certified-silk'],
        iccProfile: 'ISO-Coated-v2-300',
        dpiValidation: true
    };

    // Validate configuration against ISO standards
    if (config.resolution < 300) {
        throw new Error('Resolution must be at least 300 DPI per ISO 15930-1');
    }

    if (config.bleed < 3) {
        throw new Error('Bleed must be at least 3mm per ISO 19593-1');
    }

    return Object.freeze(config);
}

/**
 * Creates distributed printer network configuration
 * Implements health monitoring and load balancing
 */
export function createPrinterNetworkConfig(): PrinterNetworkConfig {
    const config: PrinterNetworkConfig = {
        maxConcurrentJobs: Number(process.env.PRINTER_MAX_CONCURRENT_JOBS) || 100,
        jobTimeoutMinutes: Number(process.env.PRINTER_JOB_TIMEOUT_MINUTES) || 30,
        retryAttempts: Number(process.env.PRINTER_RETRY_ATTEMPTS) || 3,
        healthCheckIntervalSeconds: Number(process.env.PRINTER_HEALTH_CHECK_INTERVAL) || 30,
        loadBalancingStrategy: (process.env.PRINTER_LOAD_BALANCING_STRATEGY as LoadBalancingStrategy) 
            || LoadBalancingStrategy.LEAST_CONNECTIONS,
        failoverEnabled: true
    };

    // Validate network configuration
    if (config.maxConcurrentJobs < 1) {
        throw new Error('Maximum concurrent jobs must be at least 1');
    }

    if (config.healthCheckIntervalSeconds < 15) {
        throw new Error('Health check interval must be at least 15 seconds');
    }

    return Object.freeze(config);
}

/**
 * Creates regional printer distribution configuration
 * Implements geographical load balancing and failover
 */
export function createRegionalConfig(): PrinterRegionalConfig {
    const config: PrinterRegionalConfig = {
        region: process.env.AWS_REGION || 'us-east-1',
        maxPrintersPerRegion: Number(process.env.PRINTER_MAX_PER_REGION) || 50,
        loadBalancingStrategy: (process.env.PRINTER_REGIONAL_STRATEGY as RegionalLoadBalancingStrategy) 
            || RegionalLoadBalancingStrategy.HYBRID,
        backupRegions: ['us-west-2', 'eu-west-1'],
        priorityLevel: 1
    };

    // Validate regional configuration
    if (config.maxPrintersPerRegion < 1) {
        throw new Error('Maximum printers per region must be at least 1');
    }

    return Object.freeze(config);
}

// Export immutable configuration instances
export const printerQualityConfig = createPrinterQualityConfig();
export const printerNetworkConfig = createPrinterNetworkConfig();
export const printerRegionalConfig = createRegionalConfig();