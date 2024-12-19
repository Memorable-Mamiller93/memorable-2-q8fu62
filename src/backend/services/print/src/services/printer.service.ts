// @package pg ^8.11.0
import { Pool } from 'pg';
// @package winston ^3.9.0
import { Logger } from 'winston';
// @package ioredis ^5.3.0
import Redis from 'ioredis';
// @package node-cache ^5.1.2
import NodeCache from 'node-cache';

import { 
  Printer, 
  PrinterStatus, 
  PrinterCapabilities,
  PrinterLocation,
  validateISOCompliance 
} from '../models/printer.model';
import { 
  printerQualityConfig,
  printerNetworkConfig,
  printerRegionalConfig,
  LoadBalancingStrategy,
  RegionalLoadBalancingStrategy
} from '../config/printer.config';
import { validatePrintQuality } from '../utils/pdf.utils';

/**
 * Decorator for monitoring printer network metrics
 */
function MonitorMetrics() {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    descriptor.value = async function (...args: any[]) {
      const start = Date.now();
      try {
        const result = await originalMethod.apply(this, args);
        this.logger.info(`${propertyKey} completed`, {
          duration: Date.now() - start,
          success: true
        });
        return result;
      } catch (error) {
        this.logger.error(`${propertyKey} failed`, {
          duration: Date.now() - start,
          error: error.message
        });
        throw error;
      }
    };
    return descriptor;
  };
}

/**
 * PrinterNetworkManager class for managing ISO-compliant printer network operations
 */
export class PrinterNetworkManager {
  private readonly printerCache: NodeCache;
  private readonly healthCheckInterval: NodeJS.Timeout;
  private activePrinters: Map<string, Printer>;
  private readonly regionLoadBalancers: Map<string, number>;

  constructor(
    private readonly dbPool: Pool,
    private readonly logger: Logger,
    private readonly cache: Redis,
    private readonly qualityConfig = printerQualityConfig
  ) {
    this.printerCache = new NodeCache({ stdTTL: 300 }); // 5-minute cache
    this.activePrinters = new Map<string, Printer>();
    this.regionLoadBalancers = new Map<string, number>();
    
    // Initialize health check monitoring
    this.healthCheckInterval = setInterval(
      () => this.performHealthChecks(),
      printerNetworkConfig.healthCheckIntervalSeconds * 1000
    );
  }

  /**
   * Initializes the printer network with ISO compliance validation
   * @param config Network configuration parameters
   */
  @MonitorMetrics()
  public async initializePrinterNetwork(): Promise<void> {
    try {
      // Load all registered printers
      const query = 'SELECT * FROM printers WHERE status != $1';
      const result = await this.dbPool.query(query, [PrinterStatus.INACTIVE]);
      
      for (const printer of result.rows) {
        // Validate ISO compliance
        await validateISOCompliance(printer.capabilities);
        
        // Initialize printer in network
        await this.registerPrinter(printer);
      }

      this.logger.info('Printer network initialized', {
        activePrinters: this.activePrinters.size,
        regions: Array.from(this.regionLoadBalancers.keys())
      });
    } catch (error) {
      this.logger.error('Failed to initialize printer network', { error });
      throw error;
    }
  }

  /**
   * Finds optimal printer based on ISO compliance and regional optimization
   */
  @MonitorMetrics()
  public async findOptimalPrinter(
    region: string,
    jobRequirements: PrinterCapabilities,
    qualityRequirements: typeof printerQualityConfig
  ): Promise<Printer> {
    // Check cache first
    const cacheKey = `printer:${region}:${JSON.stringify(jobRequirements)}`;
    const cachedPrinter = this.printerCache.get<Printer>(cacheKey);
    if (cachedPrinter) {
      return cachedPrinter;
    }

    // Filter printers by region and ISO compliance
    const eligiblePrinters = Array.from(this.activePrinters.values()).filter(
      printer => 
        printer.location.region === region &&
        this.validatePrinterEligibility(printer, jobRequirements, qualityRequirements)
    );

    if (eligiblePrinters.length === 0) {
      throw new Error(`No eligible printers found in region ${region}`);
    }

    // Apply load balancing strategy
    const optimalPrinter = await this.applyLoadBalancingStrategy(
      eligiblePrinters,
      printerNetworkConfig.loadBalancingStrategy
    );

    // Cache the result
    this.printerCache.set(cacheKey, optimalPrinter);

    return optimalPrinter;
  }

  /**
   * Starts comprehensive network monitoring with quality metrics
   */
  @MonitorMetrics()
  public async startNetworkMonitoring(): Promise<void> {
    this.logger.info('Starting printer network monitoring');
    
    // Initialize monitoring metrics
    await this.cache.set('printer:network:metrics', JSON.stringify({
      totalPrinters: this.activePrinters.size,
      activeRegions: this.regionLoadBalancers.size,
      lastUpdate: new Date().toISOString()
    }));

    // Start periodic quality checks
    setInterval(
      () => this.performQualityChecks(),
      printerNetworkConfig.healthCheckIntervalSeconds * 2000
    );
  }

  /**
   * Performs periodic health checks on all active printers
   */
  private async performHealthChecks(): Promise<void> {
    for (const [id, printer] of this.activePrinters) {
      try {
        const isHealthy = await this.checkPrinterHealth(printer);
        if (!isHealthy) {
          await this.handlePrinterFailure(printer);
        }
      } catch (error) {
        this.logger.error(`Health check failed for printer ${id}`, { error });
      }
    }
  }

  /**
   * Validates printer eligibility against job requirements
   */
  private validatePrinterEligibility(
    printer: Printer,
    requirements: PrinterCapabilities,
    qualityRequirements: typeof printerQualityConfig
  ): boolean {
    // Validate ISO compliance
    if (!printer.capabilities.isoCompliance.ISO_12647_2 ||
        !printer.capabilities.isoCompliance.ISO_15930_1 ||
        !printer.capabilities.isoCompliance.ISO_19593_1) {
      return false;
    }

    // Validate quality metrics
    if (printer.capabilities.qualityMetrics.dpi < qualityRequirements.resolution ||
        printer.capabilities.qualityMetrics.colorAccuracy < 90) {
      return false;
    }

    // Validate capabilities match
    return requirements.supportedFormats.every(
      format => printer.capabilities.supportedFormats.includes(format)
    );
  }

  /**
   * Applies configured load balancing strategy
   */
  private async applyLoadBalancingStrategy(
    printers: Printer[],
    strategy: LoadBalancingStrategy
  ): Promise<Printer> {
    switch (strategy) {
      case LoadBalancingStrategy.ROUND_ROBIN:
        return this.applyRoundRobinStrategy(printers);
      case LoadBalancingStrategy.LEAST_CONNECTIONS:
        return this.applyLeastConnectionsStrategy(printers);
      case LoadBalancingStrategy.WEIGHTED:
        return this.applyWeightedStrategy(printers);
      default:
        return printers[0];
    }
  }

  /**
   * Handles printer failure with failover logic
   */
  private async handlePrinterFailure(printer: Printer): Promise<void> {
    this.logger.warn(`Printer failure detected: ${printer.id}`);
    
    // Update printer status
    await this.updatePrinterStatus(printer.id, PrinterStatus.ERROR_MAJOR);
    
    // Remove from active printers
    this.activePrinters.delete(printer.id);
    
    // Trigger failover if enabled
    if (printerNetworkConfig.failoverEnabled) {
      await this.triggerFailover(printer);
    }
  }

  /**
   * Updates printer status with monitoring
   */
  private async updatePrinterStatus(
    printerId: string,
    status: PrinterStatus
  ): Promise<void> {
    const query = `
      UPDATE printers 
      SET status = $1, updated_at = NOW() 
      WHERE id = $2
    `;
    await this.dbPool.query(query, [status, printerId]);
    
    // Update cache
    await this.cache.set(
      `printer:${printerId}:status`,
      status,
      'EX',
      300
    );
  }
}

// Export singleton instance
export const printerNetworkManager = new PrinterNetworkManager(
  new Pool(),
  console as Logger,
  new Redis(),
  printerQualityConfig
);