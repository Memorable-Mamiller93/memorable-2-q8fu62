// @aws-sdk/client-s3 version: ^3.400.0
// opossum version: ^6.0.0
// winston version: ^3.8.0
// prom-client version: ^14.0.0

import { 
  S3Client, 
  PutObjectCommand, 
  GetObjectCommand, 
  DeleteObjectCommand,
  ServerSideEncryption,
  ObjectCannedACL
} from '@aws-sdk/client-s3';
import CircuitBreaker from 'opossum';
import { Logger } from 'winston';
import { Counter, Histogram } from 'prom-client';
import { storageConfig } from '../config/storage.config';
import crypto from 'crypto';
import { Readable } from 'stream';

/**
 * Interface for file upload options
 */
interface UploadOptions {
  contentType: string;
  metadata?: Record<string, string>;
  encryption?: boolean;
  retentionPeriod?: number;
  tags?: Record<string, string>;
}

/**
 * Interface defining the storage service operations
 */
interface StorageServiceInterface {
  uploadFile(fileBuffer: Buffer, key: string, options: UploadOptions): Promise<string>;
  downloadFile(key: string): Promise<Buffer>;
  deleteFile(key: string): Promise<void>;
  getSignedUrl(key: string, expiresIn: number): Promise<string>;
}

/**
 * Enhanced service class for managing book content storage in AWS S3
 * with security, monitoring, and error handling capabilities
 */
export class StorageService implements StorageServiceInterface {
  private readonly s3Client: S3Client;
  private readonly bucketName: string;
  private readonly cdnDomain: string;
  private readonly logger: Logger;
  private readonly circuitBreaker: CircuitBreaker;

  // Metrics for monitoring
  private readonly uploadLatency: Histogram;
  private readonly downloadLatency: Histogram;
  private readonly operationCounter: Counter;
  private readonly errorCounter: Counter;

  constructor(logger: Logger) {
    this.logger = logger;
    this.bucketName = storageConfig.bucketName;
    this.cdnDomain = storageConfig.cdnDomain;

    // Initialize S3 client with enhanced configuration
    this.s3Client = new S3Client({
      region: storageConfig.region,
      maxAttempts: 3,
      retryMode: 'adaptive'
    });

    // Initialize circuit breaker for S3 operations
    this.circuitBreaker = new CircuitBreaker(async (operation: () => Promise<any>) => {
      return operation();
    }, {
      timeout: 10000, // 10 seconds
      errorThresholdPercentage: 50,
      resetTimeout: 30000 // 30 seconds
    });

    // Initialize metrics
    this.uploadLatency = new Histogram({
      name: 'storage_upload_duration_seconds',
      help: 'Upload operation duration in seconds',
      labelNames: ['content_type']
    });

    this.downloadLatency = new Histogram({
      name: 'storage_download_duration_seconds',
      help: 'Download operation duration in seconds'
    });

    this.operationCounter = new Counter({
      name: 'storage_operations_total',
      help: 'Total number of storage operations',
      labelNames: ['operation', 'status']
    });

    this.errorCounter = new Counter({
      name: 'storage_errors_total',
      help: 'Total number of storage errors',
      labelNames: ['operation', 'error_type']
    });
  }

  /**
   * Uploads a file to S3 with enhanced security and validation
   * @param fileBuffer - The file content buffer
   * @param key - The storage key for the file
   * @param options - Upload configuration options
   * @returns Promise<string> - CDN URL of the uploaded file
   */
  async uploadFile(fileBuffer: Buffer, key: string, options: UploadOptions): Promise<string> {
    const timer = this.uploadLatency.startTimer();

    try {
      // Validate file size
      if (fileBuffer.length > storageConfig.maxFileSize) {
        throw new Error(`File size exceeds maximum allowed size of ${storageConfig.maxFileSize} bytes`);
      }

      // Validate content type
      if (!storageConfig.allowedFileTypes.includes(options.contentType)) {
        throw new Error(`Content type ${options.contentType} is not allowed`);
      }

      // Generate unique identifier for the file
      const fileId = crypto.randomUUID();
      const finalKey = `${key}-${fileId}`;

      // Configure encryption
      const encryptionConfig = options.encryption !== false ? {
        ServerSideEncryption: ServerSideEncryption.aws_kms,
        SSEKMSKeyId: storageConfig.encryption.keyId
      } : {};

      const uploadCommand = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: finalKey,
        Body: fileBuffer,
        ContentType: options.contentType,
        Metadata: options.metadata,
        ObjectLockRetainUntilDate: options.retentionPeriod ? 
          new Date(Date.now() + options.retentionPeriod * 24 * 60 * 60 * 1000) : undefined,
        Tagging: options.tags ? 
          Object.entries(options.tags).map(([key, value]) => `${key}=${value}`).join('&') : undefined,
        ACL: ObjectCannedACL.private,
        ...encryptionConfig
      });

      await this.circuitBreaker.fire(async () => {
        await this.s3Client.send(uploadCommand);
      });

      const cdnUrl = `https://${this.cdnDomain}/${finalKey}`;
      
      this.logger.info('File uploaded successfully', {
        key: finalKey,
        contentType: options.contentType,
        size: fileBuffer.length
      });

      this.operationCounter.inc({ operation: 'upload', status: 'success' });
      timer({ content_type: options.contentType });

      return cdnUrl;

    } catch (error) {
      this.handleError('upload', error);
      throw error;
    }
  }

  /**
   * Downloads a file from S3 storage with enhanced error handling
   * @param key - The storage key of the file
   * @returns Promise<Buffer> - The file content buffer
   */
  async downloadFile(key: string): Promise<Buffer> {
    const timer = this.downloadLatency.startTimer();

    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key
      });

      const response = await this.circuitBreaker.fire(async () => {
        return this.s3Client.send(command);
      });

      if (!response.Body) {
        throw new Error('Empty response body');
      }

      const chunks: Buffer[] = [];
      const stream = response.Body as Readable;

      return new Promise((resolve, reject) => {
        stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
        stream.on('error', (error) => reject(error));
        stream.on('end', () => {
          const result = Buffer.concat(chunks);
          
          this.logger.info('File downloaded successfully', {
            key,
            size: result.length
          });

          this.operationCounter.inc({ operation: 'download', status: 'success' });
          timer();

          resolve(result);
        });
      });

    } catch (error) {
      this.handleError('download', error);
      throw error;
    }
  }

  /**
   * Deletes a file from S3 storage with proper cleanup
   * @param key - The storage key of the file
   */
  async deleteFile(key: string): Promise<void> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: key
      });

      await this.circuitBreaker.fire(async () => {
        await this.s3Client.send(command);
      });

      this.logger.info('File deleted successfully', { key });
      this.operationCounter.inc({ operation: 'delete', status: 'success' });

    } catch (error) {
      this.handleError('delete', error);
      throw error;
    }
  }

  /**
   * Generates a secure signed URL for temporary file access
   * @param key - The storage key of the file
   * @param expiresIn - URL expiration time in seconds
   * @returns Promise<string> - Signed URL
   */
  async getSignedUrl(key: string, expiresIn: number): Promise<string> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key
      });

      const signedUrl = await this.circuitBreaker.fire(async () => {
        return await this.s3Client.sign(command, { expiresIn });
      });

      this.logger.info('Signed URL generated successfully', {
        key,
        expiresIn
      });

      this.operationCounter.inc({ operation: 'getSignedUrl', status: 'success' });
      return signedUrl;

    } catch (error) {
      this.handleError('getSignedUrl', error);
      throw error;
    }
  }

  /**
   * Handles and logs errors with proper metrics
   * @param operation - The operation that failed
   * @param error - The error object
   */
  private handleError(operation: string, error: any): void {
    this.logger.error('Storage operation failed', {
      operation,
      error: error.message,
      stack: error.stack
    });

    this.errorCounter.inc({
      operation,
      error_type: error.name || 'UnknownError'
    });

    this.operationCounter.inc({
      operation,
      status: 'error'
    });
  }
}

export default StorageService;