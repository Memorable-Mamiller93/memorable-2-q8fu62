// @package pg ^8.11.0 - PostgreSQL client for Node.js with connection pooling
import { Pool } from 'pg';
// @package dotenv ^16.3.1 - Environment variable management
import * as dotenv from 'dotenv';

// Load environment variables in non-production environments
if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}

/**
 * Interface defining SSL configuration for secure database connections
 */
interface DatabaseSSLConfig {
  rejectUnauthorized: boolean;
  ca: string;
  key: string;
  cert: string;
}

/**
 * Interface defining database node configuration for replication
 */
interface DatabaseNodeConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
}

/**
 * Interface defining replication configuration with master and slave nodes
 */
interface DatabaseReplicationConfig {
  master: DatabaseNodeConfig;
  slaves: DatabaseNodeConfig[];
}

/**
 * Interface defining connection pool configuration parameters
 */
interface DatabasePoolConfig {
  min: number;
  max: number;
  acquireTimeoutMillis: number;
  createTimeoutMillis: number;
  destroyTimeoutMillis: number;
  idleTimeoutMillis: number;
  reapIntervalMillis: number;
  createRetryIntervalMillis: number;
}

/**
 * Interface defining comprehensive database configuration parameters
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
  ssl: DatabaseSSLConfig;
  replication: DatabaseReplicationConfig;
  pool: DatabasePoolConfig;
}

/**
 * Creates and returns the comprehensive database configuration object
 * with master-slave replication settings and optimized connection pool parameters
 * @returns {DatabaseConfig} Complete database configuration object
 * @throws {Error} If required environment variables are missing
 */
const createDatabaseConfig = (): DatabaseConfig => {
  // Validate required environment variables
  const requiredEnvVars = [
    'DB_USER',
    'DB_PASSWORD',
    'DB_SSL_CA',
    'DB_SSL_KEY',
    'DB_SSL_CERT'
  ];

  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      throw new Error(`Missing required environment variable: ${envVar}`);
    }
  }

  // Parse replica configuration from environment
  const replicaHosts = process.env.DB_REPLICA_HOSTS?.split(',') || [];
  const replicaPorts = process.env.DB_REPLICA_PORTS?.split(',').map(port => parseInt(port, 10)) || [];

  // Configure slave nodes
  const slaves: DatabaseNodeConfig[] = replicaHosts.map((host, index) => ({
    host,
    port: replicaPorts[index] || 5432,
    database: process.env.DB_NAME || 'memorable_print',
    user: process.env.DB_USER!,
    password: process.env.DB_PASSWORD!
  }));

  // Create complete configuration object
  const config: DatabaseConfig = {
    // Master database connection parameters
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME || 'memorable_print',
    user: process.env.DB_USER!,
    password: process.env.DB_PASSWORD!,
    
    // Connection pool limits
    max: parseInt(process.env.DB_POOL_MAX || '50', 10),
    idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000', 10),
    connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT || '5000', 10),

    // SSL Configuration
    ssl: {
      rejectUnauthorized: process.env.DB_SSL_ENABLED !== 'false',
      ca: process.env.DB_SSL_CA!,
      key: process.env.DB_SSL_KEY!,
      cert: process.env.DB_SSL_CERT!
    },

    // Replication configuration
    replication: {
      master: {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432', 10),
        database: process.env.DB_NAME || 'memorable_print',
        user: process.env.DB_USER!,
        password: process.env.DB_PASSWORD!
      },
      slaves
    },

    // Pool configuration with optimized settings
    pool: {
      min: parseInt(process.env.DB_POOL_MIN || '10', 10),
      max: parseInt(process.env.DB_POOL_MAX || '50', 10),
      acquireTimeoutMillis: 30000,
      createTimeoutMillis: 30000,
      destroyTimeoutMillis: 5000,
      idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000', 10),
      reapIntervalMillis: 1000,
      createRetryIntervalMillis: 200
    }
  };

  return config;
};

// Create database configuration
const databaseConfig = createDatabaseConfig();

// Initialize connection pool with configuration
const pool = new Pool({
  ...databaseConfig,
  // Additional pool settings for production environment
  application_name: 'memorable_print_service',
  statement_timeout: 30000, // 30 seconds
  query_timeout: 30000, // 30 seconds
  keepalive: true,
  keepaliveInitialDelayMillis: 10000
});

// Handle pool errors
pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

// Handle pool connect events
pool.on('connect', (client) => {
  client.on('error', (err) => {
    console.error('Database client error:', err);
  });
});

export {
  databaseConfig,
  pool,
  DatabaseConfig,
  DatabaseNodeConfig,
  DatabaseReplicationConfig,
  DatabasePoolConfig,
  DatabaseSSLConfig
};