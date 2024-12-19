/**
 * @fileoverview Advanced React hook for handling file uploads with comprehensive validation,
 * compression, progress tracking, and CDN integration
 * @version 1.0.0
 */

import { useState, useCallback, useRef } from 'react'; // v18.2.0
import { validateFile, convertHeicToJpeg, compressImage } from '../utils/file.utils';
import { uploadFile } from '../utils/storage.utils';

// Constants for upload configuration
const DEFAULT_MAX_SIZE = 10 * 1024 * 1024; // 10MB
const DEFAULT_ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/heic', 'image/heif'];
const DEFAULT_CHUNK_SIZE = 1024 * 1024; // 1MB
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second

/**
 * Enhanced interface for upload hook configuration
 */
export interface UseUploadOptions {
  maxSize?: number;
  allowedTypes?: string[];
  autoCompress?: boolean;
  chunkSize?: number;
  maxRetries?: number;
  concurrent?: boolean;
}

/**
 * Detailed upload progress information
 */
export interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
  fileName: string;
  speed: number;
  timeRemaining: number;
}

/**
 * Enhanced error information for uploads
 */
export interface UploadError {
  code: string;
  message: string;
  details?: any;
  retryable: boolean;
}

/**
 * Hook return value interface
 */
export interface UseUploadResult {
  uploading: boolean;
  error: UploadError | null;
  progress: UploadProgress;
  uploadedUrl: string | null;
  uploadFile: (file: File) => Promise<string>;
  cancelUpload: () => void;
  resetState: () => void;
}

/**
 * Advanced hook for handling file uploads with comprehensive features
 */
export const useUpload = (options: UseUploadOptions = {}): UseUploadResult => {
  // Initialize state
  const [uploading, setUploading] = useState<boolean>(false);
  const [error, setError] = useState<UploadError | null>(null);
  const [progress, setProgress] = useState<UploadProgress>({
    loaded: 0,
    total: 0,
    percentage: 0,
    fileName: '',
    speed: 0,
    timeRemaining: 0
  });
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);

  // References
  const abortControllerRef = useRef<AbortController | null>(null);
  const uploadStartTimeRef = useRef<number>(0);

  // Configuration
  const {
    maxSize = DEFAULT_MAX_SIZE,
    allowedTypes = DEFAULT_ALLOWED_TYPES,
    autoCompress = true,
    chunkSize = DEFAULT_CHUNK_SIZE,
    maxRetries = MAX_RETRIES,
    concurrent = false
  } = options;

  /**
   * Reset upload state
   */
  const resetState = useCallback(() => {
    setUploading(false);
    setError(null);
    setProgress({
      loaded: 0,
      total: 0,
      percentage: 0,
      fileName: '',
      speed: 0,
      timeRemaining: 0
    });
    setUploadedUrl(null);
  }, []);

  /**
   * Cancel ongoing upload
   */
  const cancelUpload = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      resetState();
    }
  }, [resetState]);

  /**
   * Calculate upload progress metrics
   */
  const calculateProgress = useCallback((loaded: number, total: number, fileName: string) => {
    const currentTime = Date.now();
    const elapsedTime = currentTime - uploadStartTimeRef.current;
    const speed = loaded / (elapsedTime / 1000); // bytes per second
    const remainingBytes = total - loaded;
    const timeRemaining = remainingBytes / speed;

    setProgress({
      loaded,
      total,
      percentage: Math.round((loaded * 100) / total),
      fileName,
      speed,
      timeRemaining
    });
  }, []);

  /**
   * Handle file upload with validation, compression, and progress tracking
   */
  const handleUpload = useCallback(async (file: File): Promise<string> => {
    try {
      setUploading(true);
      setError(null);
      uploadStartTimeRef.current = Date.now();

      // Validate file
      const validationResult = await validateFile(file, {
        maxSize,
        allowedTypes,
        allowCompression: autoCompress,
        minWidth: 800,
        minHeight: 600
      });

      if (!validationResult.isValid) {
        throw new Error(validationResult.error || 'Invalid file');
      }

      // Process file based on type and settings
      let processedFile = file;
      if (file.type === 'image/heic' || file.type === 'image/heif') {
        const convertedBlob = await convertHeicToJpeg(file, { quality: 0.92 });
        processedFile = new File([convertedBlob], file.name.replace(/\.(heic|heif)$/i, '.jpg'), {
          type: 'image/jpeg'
        });
      }

      if (autoCompress && processedFile.size > maxSize) {
        processedFile = await compressImage(processedFile, {
          maxSizeMB: maxSize / (1024 * 1024),
          maxWidthOrHeight: 2048,
          quality: 0.85,
          preserveExif: true
        });
      }

      // Create new abort controller for this upload
      abortControllerRef.current = new AbortController();

      // Upload file with progress tracking
      const url = await uploadFile(processedFile, {
        onProgress: (loaded, total) => calculateProgress(loaded, total, processedFile.name),
        signal: abortControllerRef.current.signal,
        chunkSize,
        maxRetries,
        concurrent
      });

      setUploadedUrl(url);
      return url;

    } catch (err) {
      const uploadError: UploadError = {
        code: err.name || 'UPLOAD_ERROR',
        message: err.message || 'Upload failed',
        details: err,
        retryable: err.name !== 'AbortError'
      };
      setError(uploadError);
      throw uploadError;

    } finally {
      setUploading(false);
      abortControllerRef.current = null;
    }
  }, [maxSize, allowedTypes, autoCompress, chunkSize, maxRetries, concurrent, calculateProgress]);

  return {
    uploading,
    error,
    progress,
    uploadedUrl,
    uploadFile: handleUpload,
    cancelUpload,
    resetState
  };
};

export default useUpload;