import { Sequelize, Options } from 'sequelize';
import { Pool, PoolConfig } from 'pg-pool';
import { Logger } from '@memorable/logger'; // Internal logger
import { MetricsCollector } from '@memorable/metrics'; // Internal metrics
import { retry, monitor } from '@memorable/decorators'; // Internal decorators

// Interface definitions for strongly-typed configuration
interface SSLConfig {
  require: boolean;
  rejectUnauthorized: boolean;
  ca?: string;
  cert?: string;
  key?: string;
}

interface RetryConfig {
  max: number;
  timeout: number;
  backoffFactor: number;
}

interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  pool: PoolConfig;
  ssl: SSLConfig;
  retry: RetryConfig;
  monitoring: {
    metrics: boolean;
    slowQueryThreshold: number;
    statementTimeout: number;
  };
}

// Environment-specific database configuration
export const DATABASE_CONFIG: DatabaseConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: `${process.env.NODE_ENV || 'development'}_memorable_books`,
  username: process.env.DB_USERNAME || 'memorable_user',
  password: process.env.DB_PASSWORD || '',
  pool: {
    max: parseInt(process.env.DB_POOL_MAX || '20', 10),
    min: parseInt(process.env.DB_POOL_MIN || '5', 10),
    idle: parseInt(process.env.DB_POOL_IDLE || '10000', 10),
    acquire: parseInt(process.env.DB_POOL_ACQUIRE || '30000', 10),
    evict: parseInt(process.env.DB_POOL_EVICT || '60000', 10),
  },
  ssl: {
    require: process.env.DB_SSL_REQUIRED === 'true',
    rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false',
    ca: process.env.DB_SSL_CA,
    cert: process.env.DB_SSL_CERT,
    key: process.env.DB_SSL_KEY,
  },
  retry: {
    max: parseInt(process.env.DB_RETRY_MAX || '3', 10),
    timeout: parseInt(process.env.DB_RETRY_TIMEOUT || '5000', 10),
    backoffFactor: parseFloat(process.env.DB_RETRY_BACKOFF || '1.5'),
  },
  monitoring: {
    metrics: process.env.DB_METRICS_ENABLED !== 'false',
    slowQueryThreshold: parseInt(process.env.DB_SLOW_QUERY_THRESHOLD || '1000', 10),
    statementTimeout: parseInt(process.env.DB_STATEMENT_TIMEOUT || '30000', 10),
  },
};

// Initialize metrics collector for database monitoring
const metricsCollector = new MetricsCollector('database_book_service');

/**
 * Validates database connection and required permissions
 * @param sequelize - Sequelize instance to validate
 * @returns Promise<boolean> - Connection validation result
 */
async function validateConnection(sequelize: Sequelize): Promise<boolean> {
  try {
    // Test basic connectivity
    await sequelize.authenticate();

    // Verify required permissions
    const [results] = await sequelize.query(
      'SELECT has_database_privilege(current_user, current_database(), \'CONNECT\') as can_connect, ' +
      'has_schema_privilege(current_user, \'public\', \'USAGE\') as can_use_schema'
    );

    const permissions = results as Array<{ can_connect: boolean; can_use_schema: boolean }>;
    if (!permissions[0].can_connect || !permissions[0].can_use_schema) {
      throw new Error('Insufficient database permissions');
    }

    // Check replication status if configured
    if (process.env.DB_CHECK_REPLICATION === 'true') {
      const [replication] = await sequelize.query('SELECT pg_is_in_recovery()');
      Logger.info('Replication status checked', { isReplica: replication[0].pg_is_in_recovery });
    }

    return true;
  } catch (error) {
    Logger.error('Database validation failed', { error });
    return false;
  }
}

/**
 * Initializes database connection with enhanced error handling and monitoring
 * @returns Promise<Sequelize> - Configured Sequelize instance
 */
@retry({ maxAttempts: DATABASE_CONFIG.retry.max, backoffFactor: DATABASE_CONFIG.retry.backoffFactor })
@monitor({ metrics: DATABASE_CONFIG.monitoring.metrics })
export async function initializeDatabase(): Promise<Sequelize> {
  const sequelizeConfig: Options = {
    host: DATABASE_CONFIG.host,
    port: DATABASE_CONFIG.port,
    database: DATABASE_CONFIG.database,
    username: DATABASE_CONFIG.username,
    password: DATABASE_CONFIG.password,
    dialect: 'postgres',
    pool: DATABASE_CONFIG.pool,
    ssl: DATABASE_CONFIG.ssl,
    logging: (sql: string, timing?: number) => {
      if (timing && timing > DATABASE_CONFIG.monitoring.slowQueryThreshold) {
        Logger.warn('Slow query detected', { sql, timing });
        metricsCollector.incrementCounter('slow_queries');
      }
      metricsCollector.recordTiming('query_execution', timing || 0);
    },
    dialectOptions: {
      statement_timeout: DATABASE_CONFIG.monitoring.statementTimeout,
      application_name: 'memorable_book_service',
    },
    timezone: 'UTC',
  };

  const sequelize = new Sequelize(sequelizeConfig);

  // Setup connection event handlers
  sequelize.addHook('beforeConnect', async (config: any) => {
    metricsCollector.incrementCounter('connection_attempts');
  });

  sequelize.addHook('afterConnect', async (connection: any) => {
    metricsCollector.incrementCounter('successful_connections');
  });

  // Validate connection and permissions
  const isValid = await validateConnection(sequelize);
  if (!isValid) {
    throw new Error('Database connection validation failed');
  }

  // Initialize connection pool monitoring
  const pool = sequelize.connectionManager.pool as Pool;
  setInterval(() => {
    metricsCollector.gauge('pool_total_connections', pool.totalCount);
    metricsCollector.gauge('pool_idle_connections', pool.idleCount);
    metricsCollector.gauge('pool_waiting_connections', pool.waitingCount);
  }, 5000);

  return sequelize;
}

// Export configured Sequelize instance
export const sequelize = await initializeDatabase();

// Export connection pool for direct access if needed
export const pool = sequelize.connectionManager.pool;