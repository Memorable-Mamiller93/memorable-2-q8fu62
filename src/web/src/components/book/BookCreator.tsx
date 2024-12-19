/**
 * @fileoverview Enhanced book creation interface component with accessibility and performance optimizations
 * Implements Material Design 3.0 principles with comprehensive theming support
 * @version 1.0.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { useTranslation } from 'react-i18next';
import ThemeSelector from './ThemeSelector';
import { useTheme } from '../../hooks/useTheme';
import { Theme } from '../../types/theme.types';
import styles from './BookCreator.module.css';

// Performance monitoring constants
const PERFORMANCE_THRESHOLDS = {
  themeSelection: 1000, // 1 second
  pageLoad: 3000,      // 3 seconds
  aiGeneration: 30000  // 30 seconds
};

interface BookCreatorProps {
  isDemo?: boolean;
  bookId?: string;
  onComplete: (book: Book) => void;
  className?: string;
  analyticsContext?: Record<string, any>;
}

interface Book {
  id: string;
  theme: Theme;
  pages: BookPage[];
  metadata: BookMetadata;
}

interface BookPage {
  id: string;
  content: string;
  illustrations: string[];
}

interface BookMetadata {
  title: string;
  created: Date;
  lastModified: Date;
  status: 'draft' | 'complete';
}

/**
 * Enhanced book creation interface with accessibility and performance optimizations
 */
const BookCreator: React.FC<BookCreatorProps> = ({
  isDemo = false,
  bookId,
  onComplete,
  className = '',
  analyticsContext = {}
}) => {
  const { t } = useTranslation();
  const { currentTheme, setTheme, themeError, isHighContrastMode } = useTheme();
  
  // State management
  const [book, setBook] = useState<Book | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  const [progress, setProgress] = useState<number>(0);

  // Performance tracking refs
  const performanceRef = useRef<{
    themeSelectionStart?: number;
    pageLoadStart?: number;
  }>({});

  // Accessibility refs
  const liveRegionRef = useRef<HTMLDivElement>(null);
  const mainContentRef = useRef<HTMLDivElement>(null);

  /**
   * Handles theme selection with performance tracking and analytics
   */
  const handleThemeSelect = useCallback(async (theme: Theme) => {
    try {
      performanceRef.current.themeSelectionStart = performance.now();
      setLoading(true);

      // Create or update book with selected theme
      const updatedBook = book ? {
        ...book,
        theme
      } : {
        id: bookId || crypto.randomUUID(),
        theme,
        pages: [],
        metadata: {
          title: '',
          created: new Date(),
          lastModified: new Date(),
          status: 'draft'
        }
      };

      // Apply theme
      await setTheme(theme);
      setBook(updatedBook);

      // Track performance
      const selectionTime = performance.now() - performanceRef.current.themeSelectionStart!;
      if (selectionTime > PERFORMANCE_THRESHOLDS.themeSelection) {
        console.warn(`Theme selection took ${selectionTime}ms, exceeding threshold`);
      }

      // Update progress
      setProgress(25);

      // Announce to screen readers
      if (liveRegionRef.current) {
        liveRegionRef.current.textContent = t('book.theme.selected', { theme: theme.name });
      }

    } catch (error) {
      handleError(error as Error);
    } finally {
      setLoading(false);
    }
  }, [book, bookId, setTheme, t]);

  /**
   * Handles component errors with logging and user feedback
   */
  const handleError = useCallback((error: Error) => {
    console.error('BookCreator error:', error);
    setError(error);

    // Announce error to screen readers
    if (liveRegionRef.current) {
      liveRegionRef.current.textContent = t('book.error.occurred');
    }
  }, [t]);

  /**
   * Initializes existing book data
   */
  useEffect(() => {
    if (bookId) {
      performanceRef.current.pageLoadStart = performance.now();
      // Implementation for loading existing book
      // This would typically involve an API call
    }
  }, [bookId]);

  /**
   * Handles keyboard navigation
   */
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        mainContentRef.current?.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <ErrorBoundary
      fallback={<div role="alert" className={styles.error}>{t('book.error.boundary')}</div>}
      onError={handleError}
    >
      <div 
        className={`${styles.creatorContainer} ${className}`}
        ref={mainContentRef}
        tabIndex={-1}
        aria-busy={loading}
      >
        {/* Progress indicator */}
        <div 
          role="progressbar" 
          aria-valuenow={progress} 
          aria-valuemin={0} 
          aria-valuemax={100}
          className={styles.progress}
        >
          <div style={{ width: `${progress}%` }} />
        </div>

        {/* Theme selection section */}
        <section 
          className={styles.themeSection}
          aria-label={t('book.theme.section')}
        >
          <h2>{t('book.theme.title')}</h2>
          <ThemeSelector
            onThemeSelect={handleThemeSelect}
            selectedThemeId={book?.theme?.id}
            reduceMotion={false}
            highContrast={isHighContrastMode}
          />
        </section>

        {/* Book editor section - conditionally rendered */}
        {book && (
          <section 
            className={styles.editorSection}
            aria-label={t('book.editor.section')}
          >
            {/* Editor implementation would go here */}
          </section>
        )}

        {/* Preview section - conditionally rendered */}
        {book && (
          <section 
            className={styles.previewSection}
            aria-label={t('book.preview.section')}
          >
            {/* Preview implementation would go here */}
          </section>
        )}

        {/* Controls */}
        <div className={styles.controls}>
          {book && (
            <>
              <button
                onClick={() => onComplete(book)}
                disabled={loading || !book.theme}
                aria-busy={loading}
              >
                {t('book.action.complete')}
              </button>
              {!isDemo && (
                <button
                  onClick={() => setBook(null)}
                  disabled={loading}
                >
                  {t('book.action.reset')}
                </button>
              )}
            </>
          )}
        </div>

        {/* Error display */}
        {error && (
          <div role="alert" className={styles.error}>
            {error.message}
          </div>
        )}

        {/* Live region for screen reader announcements */}
        <div
          ref={liveRegionRef}
          role="status"
          aria-live="polite"
          className={styles.visuallyHidden}
        />
      </div>
    </ErrorBoundary>
  );
};

export default BookCreator;