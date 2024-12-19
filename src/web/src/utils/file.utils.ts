// External dependencies
import heic2any from 'heic2any'; // v0.0.4
import imageCompression from 'browser-image-compression'; // v2.0.2
import { v4 as uuidv4 } from 'uuid'; // v9.0.0

/**
 * Result of file validation operation including detailed feedback
 */
export interface FileValidationResult {
  isValid: boolean;
  error: string | null;
  warnings: string[];
}

/**
 * Configuration options for comprehensive file validation
 */
export interface FileValidationOptions {
  maxSize: number;
  allowedTypes: string[];
  allowCompression: boolean;
  minWidth: number;
  minHeight: number;
}

/**
 * Configuration options for image compression
 */
export interface CompressionOptions {
  maxSizeMB: number;
  maxWidthOrHeight: number;
  quality: number;
  preserveExif: boolean;
}

/**
 * Validates file against specified criteria including size, type, and dimensions
 * @param file - File to validate
 * @param options - Validation configuration options
 * @returns Promise resolving to detailed validation result
 */
export async function validateFile(
  file: File,
  options: FileValidationOptions
): Promise<FileValidationResult> {
  const result: FileValidationResult = {
    isValid: true,
    error: null,
    warnings: [],
  };

  // Check if file exists and is not corrupted
  if (!file || file.size === 0) {
    return {
      isValid: false,
      error: 'Invalid or corrupted file',
      warnings: [],
    };
  }

  // Validate file size
  if (file.size > options.maxSize) {
    if (options.allowCompression) {
      result.warnings.push('File will be compressed to meet size requirements');
    } else {
      return {
        isValid: false,
        error: `File size exceeds maximum limit of ${options.maxSize} bytes`,
        warnings: [],
      };
    }
  }

  // Validate file type
  const fileType = file.type.toLowerCase();
  if (!options.allowedTypes.includes(fileType)) {
    // Special handling for HEIC/HEIF formats
    if (fileType === 'image/heic' || fileType === 'image/heif') {
      result.warnings.push('HEIC/HEIF format will be converted to JPEG');
    } else {
      return {
        isValid: false,
        error: `Unsupported file type. Allowed types: ${options.allowedTypes.join(', ')}`,
        warnings: [],
      };
    }
  }

  // Validate image dimensions
  if (file.type.startsWith('image/')) {
    try {
      const dimensions = await getImageDimensions(file);
      if (dimensions.width < options.minWidth || dimensions.height < options.minHeight) {
        return {
          isValid: false,
          error: `Image dimensions must be at least ${options.minWidth}x${options.minHeight}`,
          warnings: [],
        };
      }
    } catch (error) {
      return {
        isValid: false,
        error: 'Unable to verify image dimensions',
        warnings: [],
      };
    }
  }

  return result;
}

/**
 * Converts HEIC/HEIF images to JPEG format
 * @param file - HEIC/HEIF file to convert
 * @param conversionOptions - Options for conversion
 * @returns Promise resolving to converted JPEG blob
 */
export async function convertHeicToJpeg(
  file: File,
  conversionOptions: { quality?: number } = {}
): Promise<Blob> {
  try {
    const blob = await heic2any({
      blob: file,
      toType: 'image/jpeg',
      quality: conversionOptions.quality || 0.92,
    });

    return Array.isArray(blob) ? blob[0] : blob;
  } catch (error) {
    throw new Error(`HEIC conversion failed: ${error.message}`);
  }
}

/**
 * Compresses images while maintaining quality within specified limits
 * @param file - Image file to compress
 * @param options - Compression configuration options
 * @returns Promise resolving to compressed image file
 */
export async function compressImage(
  file: File,
  options: CompressionOptions
): Promise<File> {
  try {
    const compressedBlob = await imageCompression(file, {
      maxSizeMB: options.maxSizeMB,
      maxWidthOrHeight: options.maxWidthOrHeight,
      useWebWorker: true,
      preserveExif: options.preserveExif,
      initialQuality: options.quality,
    });

    return new File([compressedBlob], file.name, {
      type: 'image/jpeg',
      lastModified: Date.now(),
    });
  } catch (error) {
    throw new Error(`Image compression failed: ${error.message}`);
  }
}

/**
 * Generates a unique filename while preserving the original extension
 * @param originalFilename - Original file name
 * @param preserveOriginalName - Whether to include original name in the generated filename
 * @returns Unique filename with original extension
 */
export function generateUniqueFilename(
  originalFilename: string,
  preserveOriginalName: boolean = false
): string {
  const extension = originalFilename.split('.').pop() || '';
  const uuid = uuidv4();
  
  if (preserveOriginalName) {
    const baseName = originalFilename.substring(
      0,
      originalFilename.length - extension.length - 1
    );
    const sanitizedBaseName = baseName
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .substring(0, 32);
    return `${sanitizedBaseName}-${uuid}.${extension}`;
  }
  
  return `${uuid}.${extension}`;
}

/**
 * Helper function to get image dimensions
 * @param file - Image file
 * @returns Promise resolving to image dimensions
 */
async function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      resolve({
        width: img.width,
        height: img.height,
      });
    };
    img.onerror = () => {
      reject(new Error('Failed to load image'));
    };
    img.src = URL.createObjectURL(file);
  });
}