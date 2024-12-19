/**
 * @fileoverview Book type definitions for the Memorable platform
 * Defines comprehensive type system for book creation, customization,
 * and state management with enhanced CDN support
 * @version 1.0.0
 */

import { Theme } from '../types/theme.types';

/**
 * Character information with photo support
 */
interface Character {
  name: string;
  age?: number;
  photoUrl?: string;
  traits: string[];
  interests: string[];
}

/**
 * Book customization settings
 */
interface BookSettings {
  fontSize: number;
  fontFamily: string;
  lineSpacing: number;
  pageLayout: 'standard' | 'premium';
  dedication?: string;
  isGiftWrapped: boolean;
}

/**
 * Print specifications following ISO standards
 */
interface PrintOptions {
  format: 'softcover' | 'hardcover' | 'premium';
  paperType: string;
  colorProfile: 'CMYK' | 'RGB';
  resolution: number;
  bleed: number;
  spine: number;
  coverFinish: 'matte' | 'gloss';
}

/**
 * AI generation metadata for tracking
 */
interface AIGenerationMetadata {
  storyPrompt: string;
  illustrationStyle: string;
  generatedAt: Date;
  modelVersion: string;
  iterations: number;
  confidence: number;
}

/**
 * Book page content structure
 */
interface BookPage {
  readonly pageNumber: number;
  content: string;
  illustration: {
    url: string;
    alt: string;
    metadata: {
      width: number;
      height: number;
      format: string;
    };
  };
}

/**
 * Generation step tracking
 */
type GenerationStep = 
  | 'story_generation'
  | 'illustration_creation'
  | 'layout_composition'
  | 'quality_check';

/**
 * Error codes for book creation
 */
type ErrorCode = 
  | 'GENERATION_FAILED'
  | 'INVALID_CONTENT'
  | 'STORAGE_ERROR'
  | 'THEME_INCOMPATIBLE';

/**
 * Book creation status with discriminated union
 */
export type BookStatus = 
  | { status: 'draft'; progress: number }
  | { status: 'generating'; step: GenerationStep }
  | { status: 'complete'; publishedAt: Date }
  | { status: 'error'; message: string; code: ErrorCode };

/**
 * Pagination metadata for book listings
 */
interface PaginationMetadata {
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
}

/**
 * Book filtering options
 */
interface BookFilters {
  status?: BookStatus['status'];
  theme?: string;
  dateRange?: {
    start: Date;
    end: Date;
  };
  searchTerm?: string;
}

/**
 * Enhanced book metadata interface
 */
export interface BookMetadata {
  mainCharacter: Character;
  supportingCharacters: readonly Character[];
  settings: BookSettings;
  printOptions: PrintOptions;
  aiGeneration: AIGenerationMetadata;
}

/**
 * Core book interface with branded types
 */
export interface Book {
  id: string & { readonly brand: 'BookId' };
  userId: string & { readonly brand: 'UserId' };
  themeId: string & { readonly brand: 'ThemeId' };
  title: string;
  metadata: BookMetadata;
  status: BookStatus;
  theme: Theme;
  pages: readonly BookPage[];
  createdAt: Date;
  updatedAt: Date;
  version: number;
}

/**
 * Redux store state for book management
 */
export type BookState = {
  currentBook: Book | null;
  userBooks: readonly Book[];
  loading: boolean;
  error: string | null;
  pagination: PaginationMetadata;
  filters: BookFilters;
};