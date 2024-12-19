/**
 * @fileoverview Book-related constants and configuration settings
 * Defines comprehensive constant values for book creation, validation,
 * and print specifications following ISO standards
 * @version 1.0.0
 */

import { BookStatus } from '../types/book.types';

// Storage and page limits
export const BOOK_STORAGE_KEY = 'memorable-book-draft';
export const MAX_BOOK_PAGES = 24;
export const MIN_BOOK_PAGES = 12;

// Content validation limits
export const MAX_TITLE_LENGTH = 50;
export const MAX_CHARACTER_NAME_LENGTH = 30;

// CDN configuration
export const CDN_BASE_URL = process.env.REACT_APP_CDN_URL;
export const CDN_IMAGE_QUALITY = 85;
export const MAX_IMAGE_SIZE_MB = 10;
export const MIN_IMAGE_RESOLUTION = 1200;

// Accessibility settings
export const ACCESSIBILITY_HIGH_CONTRAST = false;

/**
 * Human-readable labels for book statuses
 */
export const BOOK_STATUS_LABELS: Record<BookStatus['status'], string> = {
  draft: 'Draft in Progress',
  generating: 'AI Generation in Progress',
  processing: 'Processing Book',
  complete: 'Book Complete',
  error: 'Error Occurred'
};

/**
 * Available book format options
 */
export enum BOOK_FORMATS {
  SOFTCOVER = 'softcover',
  HARDCOVER = 'hardcover',
  PREMIUM = 'premium',
  DELUXE = 'deluxe'
}

/**
 * Paper quality options following ISO standards
 */
export enum PAPER_QUALITY {
  STANDARD = 'standard',
  PREMIUM = 'premium',
  ARCHIVAL = 'archival'
}

/**
 * Comprehensive validation rules for book creation
 */
export const BOOK_VALIDATION_RULES = {
  title: {
    required: true,
    minLength: 3,
    maxLength: MAX_TITLE_LENGTH,
    pattern: /^[a-zA-Z0-9\s\-']+$/
  },
  characterName: {
    required: true,
    minLength: 2,
    maxLength: MAX_CHARACTER_NAME_LENGTH,
    pattern: /^[a-zA-Z\s\-']+$/
  },
  characterAge: {
    required: true,
    min: 1,
    max: 12
  },
  images: {
    required: true,
    minCount: 1,
    maxSize: MAX_IMAGE_SIZE_MB * 1024 * 1024, // Convert to bytes
    minResolution: MIN_IMAGE_RESOLUTION,
    aspectRatio: 1.5
  },
  accessibility: {
    altTextRequired: true,
    minContrast: 4.5,
    focusVisible: true,
    ariaLabels: true
  }
} as const;

/**
 * Supported image formats and specifications
 */
export const SUPPORTED_IMAGE_FORMATS = {
  formats: ['image/jpeg', 'image/png', 'image/heif'],
  maxSize: MAX_IMAGE_SIZE_MB * 1024 * 1024,
  minResolution: MIN_IMAGE_RESOLUTION,
  compressionQuality: CDN_IMAGE_QUALITY,
  aspectRatios: {
    cover: 1.5,
    interior: 2.0
  }
} as const;

/**
 * CDN configuration for asset management
 */
export const CDN_CONFIG = {
  baseUrl: CDN_BASE_URL,
  imageTransforms: {
    thumbnail: 'w=300,q=80',
    preview: 'w=800,q=85',
    print: 'w=2400,q=95'
  },
  cacheControl: 'public, max-age=31536000',
  errorImage: '/assets/placeholder.jpg'
} as const;

/**
 * Print specifications following ISO standards
 */
export const PRINT_SPECIFICATIONS = {
  dpi: 300,
  colorSpace: 'CMYK',
  bleed: 3, // mm
  formats: {
    [BOOK_FORMATS.SOFTCOVER]: {
      width: 210, // mm
      height: 297, // mm
      spine: 8 // mm
    },
    [BOOK_FORMATS.HARDCOVER]: {
      width: 216, // mm
      height: 303, // mm
      spine: 12 // mm
    },
    [BOOK_FORMATS.PREMIUM]: {
      width: 216, // mm
      height: 303, // mm
      spine: 15, // mm
      coverFinish: 'matte'
    },
    [BOOK_FORMATS.DELUXE]: {
      width: 216, // mm
      height: 303, // mm
      spine: 15, // mm
      coverFinish: 'gloss',
      foilStamping: true
    }
  },
  paperWeight: {
    [PAPER_QUALITY.STANDARD]: 120, // gsm
    [PAPER_QUALITY.PREMIUM]: 150, // gsm
    [PAPER_QUALITY.ARCHIVAL]: 190 // gsm
  }
} as const;