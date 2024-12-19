import { Sequelize, Options } from 'sequelize';
import { Pool } from 'pg-pool';
import dotenv from 'dotenv';

// Load environment variables in non-production environments
if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}

/**
 * Enhanced interface for database configuration with monitoring and performance settings
 */
interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  pool: {
    max: number;
    min: number;
    idle: number;
    acquire: number;
    evict: number;
    connectTimeout: number;
    enableMetrics: boolean;
  };
  dialect: 'postgres';
  logging: {
    enabled: boolean;
    slowQueryWarning: boolean;
    slowQueryThreshold: number;
    poolMetrics: boolean;
  };
  timezone: string;
  ssl: {
    enabled: boolean;
    ca?: string;
    key?: string;
    cert?: string;
    rejectUnauthorized: boolean;
  };
  replication: {
    write: {
      host: string;
      port: number;
    };
    read: Array<{
      host: string;
      port: number;
      weight: number;
    }>;
  };
  monitoring: {
    enableMetrics: boolean;
    metricsInterval: number;
    metricsCallback?: (metrics: any) => void;
  };
}

/**
 * Creates and returns enhanced database configuration object with monitoring
 * and performance settings
 * @returns {DatabaseConfig} Enhanced database configuration object
 */
const createDatabaseConfig = (): DatabaseConfig => {
  // Primary database configuration
  const config: DatabaseConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME || 'memorable_orders',
    username: process.env.DB_USER || '',
    password: process.env.DB_PASSWORD || '',
    dialect: 'postgres',
    timezone: 'UTC',

    // Enhanced connection pool settings
    pool: {
      max: parseInt(process.env.DB_POOL_MAX || '20', 10),
      min: parseInt(process.env.DB_POOL_MIN || '5', 10),
      idle: parseInt(process.env.DB_POOL_IDLE || '10000', 10),
      acquire: parseInt(process.env.DB_POOL_ACQUIRE || '30000', 10),
      evict: parseInt(process.env.DB_POOL_EVICT || '60000', 10),
      connectTimeout: 5000,
      enableMetrics: process.env.DB_METRICS_ENABLED === 'true',
    },

    // Advanced logging configuration
    logging: {
      enabled: process.env.DB_LOGGING === 'true',
      slowQueryWarning: true,
      slowQueryThreshold: parseInt(process.env.DB_SLOW_QUERY_THRESHOLD || '1000', 10),
      poolMetrics: true,
    },

    // SSL configuration for secure connections
    ssl: {
      enabled: process.env.DB_SSL_ENABLED === 'true',
      rejectUnauthorized: true,
      // Optional SSL certificate paths
      ca: process.env.DB_SSL_CA,
      cert: process.env.DB_SSL_CERT,
      key: process.env.DB_SSL_KEY,
    },

    // Replication configuration for read/write separation
    replication: {
      write: {
        host: process.env.DB_MASTER_HOST || process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_MASTER_PORT || process.env.DB_PORT || '5432', 10),
      },
      read: [
        {
          host: process.env.DB_REPLICA_HOST_1 || process.env.DB_HOST || 'localhost',
          port: parseInt(process.env.DB_REPLICA_PORT_1 || process.env.DB_PORT || '5432', 10),
          weight: 1,
        },
      ],
    },

    // Enhanced monitoring configuration
    monitoring: {
      enableMetrics: process.env.DB_METRICS_ENABLED === 'true',
      metricsInterval: 60000,
      metricsCallback: (metrics) => {
        // Implement custom metrics handling
        console.log('Database Metrics:', metrics);
      },
    },
  };

  return config;
};

/**
 * Initializes database connection with enhanced monitoring and failover capabilities
 * @returns {Promise<Sequelize>} Configured Sequelize instance with monitoring
 */
const initializeDatabase = async (): Promise<Sequelize> => {
  const config = createDatabaseConfig();
  
  // Custom logging function for query performance tracking
  const customLogger = (query: string, timing?: number) => {
    if (!config.logging.enabled) return;
    
    if (timing && timing > config.logging.slowQueryThreshold) {
      console.warn(`Slow Query (${timing}ms):`, query);
    } else if (config.logging.enabled) {
      console.log('Query:', query);
    }
  };

  // Create Sequelize options with enhanced configuration
  const sequelizeOptions: Options = {
    host: config.host,
    port: config.port,
    database: config.database,
    username: config.username,
    password: config.password,
    dialect: config.dialect,
    timezone: config.timezone,
    logging: customLogger,
    pool: config.pool,
    ssl: config.ssl.enabled ? config.ssl : undefined,
    replication: config.replication,
    dialectOptions: {
      ssl: config.ssl.enabled ? {
        require: true,
        rejectUnauthorized: config.ssl.rejectUnauthorized,
        ca: config.ssl.ca,
        key: config.ssl.key,
        cert: config.ssl.cert,
      } : undefined,
      statement_timeout: 30000, // 30 seconds timeout for queries
    },
  };

  // Initialize Sequelize with enhanced configuration
  const sequelize = new Sequelize(sequelizeOptions);

  // Set up connection pool monitoring if enabled
  if (config.monitoring.enableMetrics) {
    setInterval(() => {
      const poolStats = (sequelize as any).connectionManager.pool.stats();
      config.monitoring.metricsCallback?.(poolStats);
    }, config.monitoring.metricsInterval);
  }

  // Test database connection
  try {
    await sequelize.authenticate();
    console.log('Database connection established successfully.');
  } catch (error) {
    console.error('Unable to connect to the database:', error);
    throw error;
  }

  return sequelize;
};

// Initialize database instance
const sequelize = await initializeDatabase();

// Export configured instances and types
export {
  sequelize,
  createDatabaseConfig,
  DatabaseConfig,
};

// Export commonly used database operations
export const authenticate = () => sequelize.authenticate();
export const transaction = sequelize.transaction.bind(sequelize);
export const query = sequelize.query.bind(sequelize);
export const getMetrics = () => (sequelize as any).connectionManager.pool.stats();