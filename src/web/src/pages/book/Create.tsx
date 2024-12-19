/**
 * @fileoverview Book creation page component implementing Material Design 3.0 principles
 * with comprehensive error handling, performance optimizations, and accessibility support
 * @version 1.0.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useBeforeUnload } from 'react-router-dom';
import classNames from 'classnames';

// Internal imports
import BookCreator from '../../components/book/BookCreator';
import CreatorLayout from '../../layouts/CreatorLayout';
import { useBook } from '../../hooks/useBook';
import { useAuth } from '../../hooks/useAuth';
import { BOOK_ROUTES, ROUTES, AUTH_ROUTES } from '../../constants/routes.constants';
import type { Book } from '../../types/book.types';

// Styles
import styles from './Create.module.css';

// Constants
const AUTOSAVE_INTERVAL = 30000; // 30 seconds
const PROGRESS_THRESHOLD = 25; // Minimum progress before showing exit warning

interface CreatePageProps {
  isDemo?: boolean;
  initialState?: Partial<Book>;
}

/**
 * Enhanced book creation page component with optimized performance and user experience
 */
const CreatePage: React.FC<CreatePageProps> = ({
  isDemo = false,
  initialState
}) => {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  const { createBook, updateBook, error: bookError } = useBook();

  // State management
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Refs for cleanup and optimization
  const autosaveTimerRef = useRef<NodeJS.Timeout>();
  const bookRef = useRef<Book | null>(null);

  /**
   * Handles successful book creation completion
   */
  const handleBookComplete = useCallback(async (completedBook: Book) => {
    try {
      setLoading(true);

      if (isDemo) {
        // Store demo state and redirect to registration
        sessionStorage.setItem('demo_book', JSON.stringify(completedBook));
        navigate(AUTH_ROUTES.REGISTER, { 
          state: { returnUrl: BOOK_ROUTES.PREVIEW.replace(':id', 'demo') }
        });
        return;
      }

      // Create or update book
      const book = bookRef.current
        ? await updateBook(bookRef.current.id, completedBook)
        : await createBook(completedBook.metadata);

      navigate(BOOK_ROUTES.PREVIEW.replace(':id', book.id));
    } catch (error) {
      console.error('Error completing book:', error);
      setError(error as Error);
    } finally {
      setLoading(false);
    }
  }, [isDemo, navigate, createBook, updateBook]);

  /**
   * Handles progress updates with debounced autosave
   */
  const handleProgress = useCallback(async (currentProgress: number, currentState: Book) => {
    setProgress(currentProgress);
    setHasUnsavedChanges(true);

    // Clear existing autosave timer
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
    }

    // Set new autosave timer
    autosaveTimerRef.current = setTimeout(async () => {
      try {
        if (bookRef.current && !isDemo) {
          await updateBook(bookRef.current.id, currentState);
          setHasUnsavedChanges(false);
        }
      } catch (error) {
        console.error('Autosave failed:', error);
      }
    }, AUTOSAVE_INTERVAL);
  }, [isDemo, updateBook]);

  /**
   * Handles navigation warning for unsaved changes
   */
  useBeforeUnload(useCallback((event) => {
    if (hasUnsavedChanges && progress > PROGRESS_THRESHOLD) {
      event.preventDefault();
      return (event.returnValue = 'You have unsaved changes. Are you sure you want to leave?');
    }
  }, [hasUnsavedChanges, progress]));

  /**
   * Authentication check and cleanup
   */
  useEffect(() => {
    if (!isDemo && !isAuthenticated) {
      navigate(AUTH_ROUTES.LOGIN, {
        state: { returnUrl: BOOK_ROUTES.CREATE }
      });
    }

    return () => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
      }
    };
  }, [isDemo, isAuthenticated, navigate]);

  return (
    <CreatorLayout
      className={styles.createPage}
      requireAuth={!isDemo}
    >
      <div 
        className={classNames(styles.container, {
          [styles.loading]: loading,
          [styles.error]: error || bookError
        })}
        role="main"
        aria-busy={loading}
      >
        {/* Loading indicator */}
        {loading && (
          <div 
            className={styles.loadingOverlay}
            role="progressbar"
            aria-valuetext="Creating your book..."
          >
            <div className={styles.spinner} />
          </div>
        )}

        {/* Error display */}
        {(error || bookError) && (
          <div 
            className={styles.errorContainer}
            role="alert"
            aria-live="assertive"
          >
            <h2>Error</h2>
            <p>{error?.message || bookError?.message}</p>
            <button 
              onClick={() => setError(null)}
              className={styles.retryButton}
            >
              Try Again
            </button>
          </div>
        )}

        {/* Book creator component */}
        <BookCreator
          isDemo={isDemo}
          initialState={initialState}
          onComplete={handleBookComplete}
          onProgress={handleProgress}
          className={styles.creator}
        />

        {/* Progress indicator */}
        <div 
          className={styles.progressContainer}
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div 
            className={styles.progressBar}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </CreatorLayout>
  );
};

export default CreatePage;