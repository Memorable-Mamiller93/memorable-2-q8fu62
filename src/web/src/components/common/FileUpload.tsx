/**
 * @fileoverview Advanced file upload component with drag-and-drop, image validation,
 * compression, and accessibility support following Material Design 3.0 principles
 * @version 1.0.0
 */

import React, { useCallback, useRef, useState, useEffect } from 'react'; // v18.2.0
import classNames from 'classnames'; // v2.3.2
import heic2any from 'heic2any'; // v0.0.4
import { useUpload } from '../../hooks/useUpload';
import { validateFile } from '../../utils/file.utils';
import { ProgressBar } from './ProgressBar';

// Constants for file upload configuration
const DEFAULT_MAX_SIZE = 10 * 1024 * 1024; // 10MB
const DEFAULT_ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/heic', 'image/heif'];
const COMPRESSION_QUALITY = 0.8;
const MAX_FILES = 10;

/**
 * Enhanced props for FileUpload component
 */
export interface FileUploadProps {
  onFileSelect: (files: File[]) => void;
  onUploadComplete: (urls: string[]) => void;
  onUploadError: (error: UploadError) => void;
  maxSize?: number;
  allowedTypes?: string[];
  autoCompress?: boolean;
  compressionOptions?: CompressionOptions;
  uploadOptions?: UploadOptions;
  className?: string;
  customValidation?: (file: File) => Promise<boolean>;
}

/**
 * Advanced file upload component with comprehensive features
 */
export const FileUpload: React.FC<FileUploadProps> = ({
  onFileSelect,
  onUploadComplete,
  onUploadError,
  maxSize = DEFAULT_MAX_SIZE,
  allowedTypes = DEFAULT_ALLOWED_TYPES,
  autoCompress = true,
  compressionOptions,
  uploadOptions,
  className,
  customValidation
}) => {
  // State management
  const [isDragActive, setIsDragActive] = useState(false);
  const [dragCounter, setDragCounter] = useState(0);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  // Custom hook for upload functionality
  const { uploadFile, uploading, progress, cancelUpload, retryUpload } = useUpload();

  /**
   * Validates and processes files before upload
   */
  const processFiles = async (files: FileList | File[]): Promise<void> => {
    try {
      const validFiles: File[] = [];
      const errors: string[] = [];

      for (const file of Array.from(files)) {
        // Validate file
        const validationResult = await validateFile(file, {
          maxSize,
          allowedTypes,
          allowCompression: autoCompress,
          minWidth: 800,
          minHeight: 600
        });

        if (!validationResult.isValid) {
          errors.push(`${file.name}: ${validationResult.error}`);
          continue;
        }

        // Custom validation if provided
        if (customValidation && !(await customValidation(file))) {
          errors.push(`${file.name}: Failed custom validation`);
          continue;
        }

        // Handle HEIC/HEIF conversion
        let processedFile = file;
        if (file.type === 'image/heic' || file.type === 'image/heif') {
          try {
            const blob = await heic2any({
              blob: file,
              toType: 'image/jpeg',
              quality: COMPRESSION_QUALITY
            });
            processedFile = new File(
              [Array.isArray(blob) ? blob[0] : blob],
              file.name.replace(/\.(heic|heif)$/i, '.jpg'),
              { type: 'image/jpeg' }
            );
          } catch (error) {
            errors.push(`${file.name}: HEIC/HEIF conversion failed`);
            continue;
          }
        }

        validFiles.push(processedFile);
      }

      if (errors.length > 0) {
        setErrorMessage(errors.join('\n'));
      }

      if (validFiles.length > 0) {
        setSelectedFiles(prevFiles => [...prevFiles, ...validFiles].slice(0, MAX_FILES));
        onFileSelect(validFiles);
      }
    } catch (error) {
      setErrorMessage('Error processing files');
      onUploadError({ code: 'PROCESSING_ERROR', message: error.message });
    }
  };

  /**
   * Handles drag over events with enhanced touch support
   */
  const handleDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragActive(true);
  }, []);

  /**
   * Handles drag enter with counter for nested elements
   */
  const handleDragEnter = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setDragCounter(prev => prev + 1);
    setIsDragActive(true);
  }, []);

  /**
   * Handles drag leave with counter for nested elements
   */
  const handleDragLeave = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setDragCounter(prev => prev - 1);
    if (dragCounter - 1 === 0) {
      setIsDragActive(false);
    }
  }, [dragCounter]);

  /**
   * Handles file drop with comprehensive validation
   */
  const handleDrop = useCallback(async (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragActive(false);
    setDragCounter(0);

    const { files } = event.dataTransfer;
    if (files?.length) {
      await processFiles(files);
    }
  }, []);

  /**
   * Handles file input change
   */
  const handleFileInputChange = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const { files } = event.target;
    if (files?.length) {
      await processFiles(files);
    }
    // Reset input value to allow selecting the same file again
    event.target.value = '';
  }, []);

  /**
   * Triggers file input click
   */
  const handleClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  /**
   * Effect to handle upload completion
   */
  useEffect(() => {
    if (selectedFiles.length > 0 && !uploading) {
      const uploadFiles = async () => {
        try {
          const urls = await Promise.all(
            selectedFiles.map(file => uploadFile(file))
          );
          onUploadComplete(urls);
          setSelectedFiles([]);
        } catch (error) {
          onUploadError(error);
        }
      };
      uploadFiles();
    }
  }, [selectedFiles, uploading]);

  return (
    <div
      ref={dropZoneRef}
      className={classNames(
        'file-upload',
        { 'drag-active': isDragActive },
        className
      )}
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      aria-label="Upload files by clicking or dragging and dropping"
    >
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={allowedTypes.join(',')}
        onChange={handleFileInputChange}
        className="file-input"
        aria-hidden="true"
        tabIndex={-1}
      />

      <div className="upload-content">
        <div className="upload-icon" aria-hidden="true">
          {uploading ? '📤' : '📁'}
        </div>
        
        <div className="upload-text">
          {isDragActive ? (
            <span>Drop files here</span>
          ) : (
            <span>
              Drag and drop files or <button className="browse-button">browse</button>
            </span>
          )}
        </div>

        {errorMessage && (
          <div 
            className="error-message" 
            role="alert"
            aria-live="polite"
          >
            {errorMessage}
          </div>
        )}

        {uploading && (
          <div className="upload-progress" role="status" aria-live="polite">
            <ProgressBar
              current={progress.loaded}
              total={progress.total}
              showSteps={false}
              ariaLabel="Upload progress"
              animated
            />
            <div className="progress-details">
              {Math.round(progress.percentage)}% uploaded
              <button 
                onClick={cancelUpload}
                className="cancel-button"
                aria-label="Cancel upload"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FileUpload;