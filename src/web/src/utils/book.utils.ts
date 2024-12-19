/**
 * @fileoverview Book utility functions for the Memorable platform
 * Provides comprehensive validation, formatting, and progress tracking utilities
 * for book creation and management
 * @version 1.0.0
 */

import { format } from 'date-fns'; // v2.30.0
import {
  Book,
  BookMetadata,
  BookStatus,
  Character
} from '../types/book.types';
import {
  BOOK_STATUS_LABELS,
  BOOK_FORMATS,
  BOOK_VALIDATION_RULES,
  MAX_TITLE_LENGTH,
  MAX_CHARACTER_NAME_LENGTH
} from '../constants/book.constants';

/**
 * Validates book title against length and content rules
 * @param title - The book title to validate
 * @returns boolean indicating if the title is valid
 */
export const validateBookTitle = (title: string): boolean => {
  if (!title?.trim()) {
    return false;
  }

  const { pattern, maxLength } = BOOK_VALIDATION_RULES.title;
  return title.length <= maxLength && pattern.test(title);
};

/**
 * Interface for character validation results
 */
interface CharacterValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Enhanced validation for character information
 * @param character - Character information to validate
 * @returns Detailed validation result with errors and warnings
 */
export const validateCharacterInfo = (character: Character): CharacterValidationResult => {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Name validation
  if (!character.name?.trim()) {
    errors.push('Character name is required');
  } else {
    const { pattern, maxLength } = BOOK_VALIDATION_RULES.characterName;
    
    if (character.name.length > maxLength) {
      errors.push(`Name must be ${maxLength} characters or less`);
    }
    
    if (!pattern.test(character.name)) {
      errors.push('Name contains invalid characters');
    }
  }

  // Age validation
  if (character.age !== undefined) {
    const { min, max } = BOOK_VALIDATION_RULES.characterAge;
    if (character.age < min || character.age > max) {
      errors.push(`Age must be between ${min} and ${max} years`);
    }
  } else {
    warnings.push('Age is recommended for better story personalization');
  }

  // Traits validation
  if (!character.traits?.length) {
    errors.push('At least one character trait is required');
  } else if (character.traits.length < 2) {
    warnings.push('Adding more traits will enhance character development');
  }

  // Interests validation
  if (!character.interests?.length) {
    warnings.push('Character interests help create more engaging stories');
  }

  // Photo validation
  if (!character.photoUrl) {
    warnings.push('Adding a photo will enhance the personalization');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
};

/**
 * Interface for formatted book metadata
 */
interface FormattedBookMetadata extends BookMetadata {
  formattedDate?: string;
}

/**
 * Enhanced metadata formatting with proper case and normalization
 * @param metadata - Book metadata to format
 * @returns Normalized and formatted metadata
 */
export const formatBookMetadata = (metadata: BookMetadata): FormattedBookMetadata => {
  const formatted: FormattedBookMetadata = {
    ...metadata,
    mainCharacter: {
      ...metadata.mainCharacter,
      name: formatCharacterName(metadata.mainCharacter.name),
      traits: [...new Set(metadata.mainCharacter.traits)].sort(),
      interests: [...new Set(metadata.mainCharacter.interests)].sort()
    },
    supportingCharacters: metadata.supportingCharacters.map(char => ({
      ...char,
      name: formatCharacterName(char.name),
      traits: [...new Set(char.traits)].sort(),
      interests: [...new Set(char.interests)].sort()
    })),
    aiGeneration: {
      ...metadata.aiGeneration,
      generatedAt: new Date(metadata.aiGeneration.generatedAt)
    }
  };

  // Add formatted date
  formatted.formattedDate = format(
    formatted.aiGeneration.generatedAt,
    'MMMM dd, yyyy'
  );

  return formatted;
};

/**
 * Helper function to format character names
 * @param name - Character name to format
 * @returns Properly formatted name
 */
const formatCharacterName = (name: string): string => {
  return name
    .trim()
    .split(/\s+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

/**
 * Interface for book progress information
 */
interface BookProgress {
  progress: number;
  stage: string;
  remainingTasks: string[];
}

/**
 * Enhanced progress calculation including illustration status
 * @param book - Book object to calculate progress for
 * @returns Detailed progress information
 */
export const getBookProgress = (book: Book): BookProgress => {
  const remainingTasks: string[] = [];
  let progress = 0;

  // Metadata validation (20%)
  const hasValidMetadata = validateBookTitle(book.title) &&
    validateCharacterInfo(book.metadata.mainCharacter).isValid;
  if (hasValidMetadata) {
    progress += 20;
  } else {
    remainingTasks.push('Complete required book information');
  }

  // Story content (30%)
  const hasStoryContent = book.pages.every(page => page.content.trim().length > 0);
  if (hasStoryContent) {
    progress += 30;
  } else {
    remainingTasks.push('Complete story content');
  }

  // Illustrations (30%)
  const hasIllustrations = book.pages.every(page => page.illustration?.url);
  if (hasIllustrations) {
    progress += 30;
  } else {
    remainingTasks.push('Generate illustrations');
  }

  // Format selection (20%)
  const hasFormat = book.metadata.printOptions.format in BOOK_FORMATS;
  if (hasFormat) {
    progress += 20;
  } else {
    remainingTasks.push('Select book format');
  }

  // Determine current stage
  let stage = 'Planning';
  if (progress >= 20) stage = 'Content Creation';
  if (progress >= 50) stage = 'Illustration';
  if (progress >= 80) stage = 'Finalization';
  if (progress === 100) stage = 'Complete';

  return {
    progress,
    stage,
    remainingTasks
  };
};

/**
 * Gets human-readable label for book status
 * @param status - Book status to get label for
 * @returns User-friendly status label
 */
export const getBookStatusLabel = (status: BookStatus['status']): string => {
  return BOOK_STATUS_LABELS[status] || 'Unknown Status';
};