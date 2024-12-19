// @aws-sdk/client-s3 version: ^3.400.0
import { S3ClientConfig } from '@aws-sdk/client-s3';

/**
 * Interface defining the encryption configuration for S3 storage
 */
interface EncryptionConfig {
  algorithm: string;
  keyId: string;
  enabled: boolean;
}

/**
 * Interface defining the complete storage configuration structure
 * for managing book content, illustrations, and media assets
 */
export interface StorageConfig {
  /** Name of the S3 bucket for storing book content */
  bucketName: string;
  
  /** Primary AWS region for S3 bucket */
  region: string;
  
  /** List of AWS regions for content replication */
  replicationRegions: string[];
  
  /** CloudFront CDN domain for content delivery */
  cdnDomain: string;
  
  /** Server-side encryption configuration */
  encryption: EncryptionConfig;
  
  /** Maximum allowed file size in bytes (10MB) */
  maxFileSize: number;
  
  /** List of allowed MIME types for uploads */
  allowedFileTypes: string[];
}

/**
 * Custom error class for configuration-related errors
 */
export class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigurationError';
  }
}

/**
 * Default storage configuration with environment variable mapping
 */
export const STORAGE_CONFIG: StorageConfig = {
  bucketName: process.env.AWS_S3_BUCKET_NAME || '',
  region: process.env.AWS_REGION || '',
  replicationRegions: process.env.AWS_REPLICATION_REGIONS?.split(',') || [],
  cdnDomain: process.env.CDN_DOMAIN || '',
  encryption: {
    algorithm: 'AES-256',
    keyId: process.env.AWS_KMS_KEY_ID || '',
    enabled: true
  },
  maxFileSize: 10485760, // 10MB in bytes
  allowedFileTypes: [
    'image/jpeg',
    'image/png',
    'image/heif',
    'application/pdf'
  ]
};

/**
 * Validates and retrieves the storage configuration with environment-specific settings
 * @throws {ConfigurationError} When required configuration values are missing or invalid
 * @returns {StorageConfig} Validated storage configuration object
 */
export function getStorageConfig(): StorageConfig {
  // Validate required string fields
  const requiredFields = ['bucketName', 'region', 'cdnDomain'];
  for (const field of requiredFields) {
    if (!STORAGE_CONFIG[field as keyof StorageConfig]) {
      throw new ConfigurationError(
        `Missing required storage configuration: ${field}`
      );
    }
  }

  // Validate encryption configuration
  if (STORAGE_CONFIG.encryption.enabled && !STORAGE_CONFIG.encryption.keyId) {
    throw new ConfigurationError(
      'KMS Key ID is required when encryption is enabled'
    );
  }

  // Validate CDN domain format
  const cdnDomainRegex = /^[a-z0-9][a-z0-9.-]+\.[a-z]{2,}$/i;
  if (!cdnDomainRegex.test(STORAGE_CONFIG.cdnDomain)) {
    throw new ConfigurationError(
      'Invalid CDN domain format'
    );
  }

  // Validate replication regions
  if (STORAGE_CONFIG.replicationRegions.length > 0) {
    const validRegionRegex = /^[a-z]{2}-[a-z]+-\d{1}$/;
    for (const region of STORAGE_CONFIG.replicationRegions) {
      if (!validRegionRegex.test(region)) {
        throw new ConfigurationError(
          `Invalid AWS region format: ${region}`
        );
      }
    }
  }

  // Validate max file size
  if (STORAGE_CONFIG.maxFileSize <= 0) {
    throw new ConfigurationError(
      'Maximum file size must be greater than 0'
    );
  }

  // Validate allowed file types
  if (STORAGE_CONFIG.allowedFileTypes.length === 0) {
    throw new ConfigurationError(
      'At least one allowed file type must be specified'
    );
  }

  return {
    ...STORAGE_CONFIG,
    // Ensure immutability of arrays
    replicationRegions: [...STORAGE_CONFIG.replicationRegions],
    allowedFileTypes: [...STORAGE_CONFIG.allowedFileTypes]
  };
}

/**
 * Export the validated storage configuration instance
 */
export const storageConfig = getStorageConfig();

/**
 * Generate S3 client configuration based on storage config
 * @returns {S3ClientConfig} AWS S3 client configuration
 */
export function getS3ClientConfig(): S3ClientConfig {
  return {
    region: storageConfig.region,
    endpoint: `https://s3.${storageConfig.region}.amazonaws.com`,
    forcePathStyle: false,
    // Add custom retry strategy for improved reliability
    maxAttempts: 3,
    retryMode: 'adaptive'
  };
}