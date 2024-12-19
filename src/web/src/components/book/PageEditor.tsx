/**
 * @fileoverview Enhanced PageEditor component for the Memorable platform
 * Provides comprehensive page editing capabilities with AI-powered content generation,
 * real-time validation, and accessibility features
 * @version 1.0.0
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react'; // v18.2.0
import debounce from 'lodash/debounce'; // v4.17.21
import sanitizeHtml from 'sanitize-html'; // v2.11.0

import { Book, BookPage } from '../../types/book.types';
import { useBook } from '../../hooks/useBook';
import Input from '../common/Input';
import { generateStory, generateIllustration, StoryComplexity, IllustrationStyle } from '../../api/ai.api';
import styles from './PageEditor.module.css';

// Constants for content validation and generation
const CONTENT_LIMITS = {
  MIN_LENGTH: 50,
  MAX_LENGTH: 500,
  SAVE_DEBOUNCE: 1000, // 1 second
  GENERATION_TIMEOUT: 30000 // 30 seconds
} as const;

// Safety settings for AI content generation
const SAFETY_SETTINGS = {
  contentFilter: true,
  ageAppropriate: true,
  violenceLevel: 'none' as const,
  languageControl: true
};

export interface PageEditorProps {
  bookId: string;
  page: BookPage;
  onSave: (page: BookPage) => Promise<void>;
  onGenerateContent: (progress: number) => void;
  onError: (error: Error) => void;
}

/**
 * Enhanced PageEditor component with AI-powered content generation
 */
export const PageEditor: React.FC<PageEditorProps> = ({
  bookId,
  page,
  onSave,
  onGenerateContent,
  onError
}) => {
  // State management
  const [content, setContent] = useState(page.content);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  // Custom hooks
  const { updateBook, optimisticUpdate, rollbackUpdate } = useBook();

  /**
   * Sanitizes and validates content
   */
  const validateContent = useCallback((value: string): boolean => {
    const sanitized = sanitizeHtml(value, {
      allowedTags: ['p', 'b', 'i', 'em', 'strong'],
      allowedAttributes: {}
    });

    return sanitized.length >= CONTENT_LIMITS.MIN_LENGTH && 
           sanitized.length <= CONTENT_LIMITS.MAX_LENGTH;
  }, []);

  /**
   * Debounced save handler with optimistic updates
   */
  const debouncedSave = useMemo(
    () =>
      debounce(async (newContent: string) => {
        try {
          const updatedPage = { ...page, content: newContent };
          
          // Optimistic update
          optimisticUpdate(bookId, { pages: [updatedPage] });
          
          await onSave(updatedPage);
          setIsDirty(false);
        } catch (err) {
          // Rollback on error
          rollbackUpdate(bookId);
          onError(err as Error);
          setError('Failed to save changes. Please try again.');
        }
      }, CONTENT_LIMITS.SAVE_DEBOUNCE),
    [bookId, page, onSave, optimisticUpdate, rollbackUpdate, onError]
  );

  /**
   * Handles content changes with validation
   */
  const handleContentChange = useCallback((newContent: string) => {
    const sanitized = sanitizeHtml(newContent);
    
    if (validateContent(sanitized)) {
      setContent(sanitized);
      setError(null);
      setIsDirty(true);
      debouncedSave(sanitized);
    } else {
      setError('Content must be between 50 and 500 characters.');
    }
  }, [validateContent, debouncedSave]);

  /**
   * Generates AI content with progress tracking
   */
  const handleGenerateContent = useCallback(async () => {
    try {
      setIsGenerating(true);
      setProgress(0);
      setError(null);

      // Generate story
      const storyResponse = await generateStory({
        characterName: page.metadata?.character?.name || 'Hero',
        characterAge: page.metadata?.character?.age || 8,
        interests: page.metadata?.character?.interests || [],
        theme: page.metadata?.theme || 'adventure',
        tone: 'friendly',
        complexity: StoryComplexity.MODERATE,
        safetySettings: SAFETY_SETTINGS
      });

      setProgress(50);
      onGenerateContent(50);

      // Generate matching illustration
      const illustrationResponse = await generateIllustration({
        prompt: storyResponse.data,
        style: IllustrationStyle.CARTOON,
        width: 512,
        height: 512,
        format: 'webp',
        safetySettings: SAFETY_SETTINGS
      });

      setProgress(100);
      onGenerateContent(100);

      // Update page content
      handleContentChange(storyResponse.data);
      
      // Update illustration
      await updateBook(bookId, {
        pages: [{
          ...page,
          illustration: {
            url: illustrationResponse.data,
            alt: `Illustration for page ${page.pageNumber}`,
            metadata: {
              width: 512,
              height: 512,
              format: 'webp'
            }
          }
        }]
      });

    } catch (err) {
      setError('Failed to generate content. Please try again.');
      onError(err as Error);
    } finally {
      setIsGenerating(false);
    }
  }, [bookId, page, updateBook, handleContentChange, onGenerateContent, onError]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      debouncedSave.cancel();
    };
  }, [debouncedSave]);

  return (
    <div className={styles['editor-container']} role="region" aria-label="Page Editor">
      <div className={styles['content-area']}>
        <Input
          id={`page-${page.pageNumber}-content`}
          name="content"
          type="text"
          value={content}
          label={`Page ${page.pageNumber} Content`}
          onChange={handleContentChange}
          validationOptions={{
            required: true,
            minLength: CONTENT_LIMITS.MIN_LENGTH,
            maxLength: CONTENT_LIMITS.MAX_LENGTH
          }}
          error={error || undefined}
          disabled={isGenerating}
        />
      </div>

      <div className={styles['illustration-area']}>
        {page.illustration && (
          <img
            src={page.illustration.url}
            alt={page.illustration.alt}
            className={styles['illustration']}
            width={page.illustration.metadata.width}
            height={page.illustration.metadata.height}
          />
        )}
      </div>

      <div className={styles['controls']}>
        <button
          onClick={handleGenerateContent}
          disabled={isGenerating}
          className={styles['generate-button']}
          aria-busy={isGenerating}
        >
          {isGenerating ? 'Generating...' : 'Generate Content'}
        </button>

        {isGenerating && (
          <div 
            className={styles['progress']}
            role="progressbar"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            {progress}%
          </div>
        )}

        {isDirty && (
          <span className={styles['save-status']} role="status">
            Saving changes...
          </span>
        )}

        {error && (
          <div className={styles['error']} role="alert">
            {error}
          </div>
        )}
      </div>
    </div>
  );
};

export default PageEditor;