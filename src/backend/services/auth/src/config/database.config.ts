import { Pool } from 'pg'; // @version ^8.11.0
import dotenv from 'dotenv'; // @version ^16.3.1
import fs from 'fs';
import path from 'path';

// Load environment variables in non-production environments
if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}

/**
 * Interface defining comprehensive database configuration parameters
 * including security, replication, and monitoring options
 */
interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  max: number;
  idleTimeoutMillis: number;
  connectionTimeoutMillis: number;
  ssl: {
    rejectUnauthorized: boolean;
    ca?: string;
    key?: string;
    cert?: string;
  };
  replication: {
    master: {
      host: string;
      port: number;
    };
    slaves: Array<{
      host: string;
      port: number;
      weight: number;
    }>;
  };
  poolMetrics: {
    enabled: boolean;
    collectionIntervalMs: number;
  };
}

/**
 * Validates the database configuration object for required parameters
 * and security settings
 * @param config DatabaseConfig object to validate
 * @returns boolean indicating validation result
 */
const validateConfig = (config: DatabaseConfig): boolean => {
  // Required connection parameters
  if (!config.host || !config.port || !config.database || !config.user || !config.password) {
    throw new Error('Missing required database connection parameters');
  }

  // SSL configuration validation
  if (config.ssl && config.ssl.rejectUnauthorized) {
    if (!config.ssl.ca || !config.ssl.key || !config.ssl.cert) {
      throw new Error('SSL is enabled but certificates are missing');
    }
  }

  // Replication configuration validation
  if (config.replication) {
    if (!config.replication.master.host || !config.replication.master.port) {
      throw new Error('Invalid master replication configuration');
    }
    if (config.replication.slaves.length > 0) {
      config.replication.slaves.forEach((slave, index) => {
        if (!slave.host || !slave.port || typeof slave.weight !== 'number') {
          throw new Error(`Invalid slave configuration at index ${index}`);
        }
      });
    }
  }

  // Pool parameters validation
  if (config.max < 1 || config.idleTimeoutMillis < 0 || config.connectionTimeoutMillis < 0) {
    throw new Error('Invalid connection pool parameters');
  }

  return true;
};

/**
 * Creates and returns the database configuration object with enhanced
 * security, replication, and monitoring settings
 * @returns Readonly<DatabaseConfig> Immutable database configuration object
 */
const createDatabaseConfig = (): Readonly<DatabaseConfig> => {
  // Parse replica configuration from environment
  const replicaHosts = process.env.DB_REPLICA_HOSTS?.split(',') || [];
  const replicaPorts = process.env.DB_REPLICA_PORTS?.split(',').map(port => parseInt(port, 10)) || [];
  
  // Load SSL certificates if SSL is enabled
  const sslConfig = process.env.DB_SSL_ENABLED === 'true' ? {
    rejectUnauthorized: true,
    ca: process.env.DB_SSL_CA_PATH ? fs.readFileSync(path.resolve(process.env.DB_SSL_CA_PATH)).toString() : undefined,
    key: process.env.DB_SSL_KEY_PATH ? fs.readFileSync(path.resolve(process.env.DB_SSL_KEY_PATH)).toString() : undefined,
    cert: process.env.DB_SSL_CERT_PATH ? fs.readFileSync(path.resolve(process.env.DB_SSL_CERT_PATH)).toString() : undefined,
  } : {
    rejectUnauthorized: false
  };

  const config: DatabaseConfig = {
    // Basic connection parameters
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME || 'memorable_auth',
    user: process.env.DB_USER!,
    password: process.env.DB_PASSWORD!,

    // Connection pool configuration
    max: parseInt(process.env.DB_POOL_MAX || '50', 10),
    idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000', 10),
    connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT || '5000', 10),

    // SSL configuration
    ssl: sslConfig,

    // Replication configuration
    replication: {
      master: {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432', 10)
      },
      slaves: replicaHosts.map((host, index) => ({
        host,
        port: replicaPorts[index] || 5432,
        weight: 1
      }))
    },

    // Pool metrics configuration
    poolMetrics: {
      enabled: process.env.DB_METRICS_ENABLED === 'true',
      collectionIntervalMs: 5000
    }
  };

  // Validate the configuration
  validateConfig(config);

  // Return immutable configuration object
  return Object.freeze(config);
};

// Create the database configuration
export const databaseConfig = createDatabaseConfig();

// Create and configure the connection pool
export const pool = new Pool({
  ...databaseConfig,
  // Additional pool configuration
  application_name: 'memorable_auth_service',
  statement_timeout: 10000, // 10 seconds
  query_timeout: 10000, // 10 seconds
  keepalive: true,
  keepaliveInitialDelayMillis: 10000
});

// Set up pool error handler
pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

// Set up metrics collection if enabled
if (databaseConfig.poolMetrics.enabled) {
  setInterval(() => {
    const metrics = {
      totalCount: pool.totalCount,
      idleCount: pool.idleCount,
      waitingCount: pool.waitingCount,
      timestamp: new Date().toISOString()
    };
    console.log('Pool metrics:', metrics);
  }, databaseConfig.poolMetrics.collectionIntervalMs);
}