/**
 * @fileoverview Enhanced book editing page component implementing Material Design 3.0
 * principles with comprehensive accessibility features and performance optimizations
 * @version 1.0.0
 */

import React, { useEffect, useCallback, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useAppDispatch } from '../../redux/hooks';
import { showNotification } from '../../redux/slices/uiSlice';

// Internal components and hooks
import BookCreator from '../../components/book/BookCreator';
import CreatorLayout from '../../layouts/CreatorLayout';
import { useBook } from '../../hooks/useBook';
import { useTheme } from '../../hooks/useTheme';

// Types and constants
import type { Book } from '../../types/book.types';
import { BOOK_ROUTES, resolveRoute } from '../../constants/routes.constants';

// Constants for auto-save and validation
const AUTO_SAVE_DELAY = 3000; // 3 seconds
const MAX_TITLE_LENGTH = 100;

/**
 * Enhanced book editing page component with auto-save and progress tracking
 */
const EditBook: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useAppDispatch();

  // Hooks
  const { currentBook, updateBook, saveProgress } = useBook();
  const { currentTheme } = useTheme();

  // Local state
  const [isLoading, setIsLoading] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  /**
   * Validates book ID and loads book data
   */
  const validateAndLoadBook = useCallback(async () => {
    if (!id) {
      dispatch(showNotification({
        type: 'error',
        message: 'Invalid book ID',
        duration: 5000
      }));
      navigate(BOOK_ROUTES.CREATE);
      return;
    }

    setIsLoading(true);
    try {
      // Book data is loaded through useBook hook
      if (!currentBook || currentBook.id !== id) {
        throw new Error('Book not found');
      }
    } catch (error) {
      dispatch(showNotification({
        type: 'error',
        message: 'Failed to load book',
        duration: 5000
      }));
      navigate(BOOK_ROUTES.CREATE);
    } finally {
      setIsLoading(false);
    }
  }, [id, navigate, dispatch, currentBook]);

  /**
   * Handles successful book completion
   */
  const handleBookComplete = useCallback(async (updatedBook: Book) => {
    try {
      await updateBook(updatedBook.id, {
        ...updatedBook,
        status: { status: 'complete', progress: 100 }
      });

      dispatch(showNotification({
        type: 'success',
        message: 'Book completed successfully!',
        duration: 5000
      }));

      navigate(resolveRoute(BOOK_ROUTES.PREVIEW, { id: updatedBook.id }));
    } catch (error) {
      dispatch(showNotification({
        type: 'error',
        message: 'Failed to complete book',
        duration: 5000
      }));
    }
  }, [updateBook, navigate, dispatch]);

  /**
   * Handles auto-save functionality with debouncing
   */
  const handleAutoSave = useCallback(async (bookData: Book) => {
    setHasUnsavedChanges(true);
    try {
      await saveProgress(bookData);
      setLastSaved(new Date());
      setHasUnsavedChanges(false);
    } catch (error) {
      console.error('Auto-save failed:', error);
      dispatch(showNotification({
        type: 'warning',
        message: 'Auto-save failed. Please save manually.',
        duration: 5000
      }));
    }
  }, [saveProgress, dispatch]);

  /**
   * Handles exit confirmation
   */
  const handleExit = useCallback(() => {
    if (hasUnsavedChanges) {
      const confirmed = window.confirm('You have unsaved changes. Are you sure you want to leave?');
      if (!confirmed) return;
    }
    navigate(-1);
  }, [hasUnsavedChanges, navigate]);

  // Load book data on mount
  useEffect(() => {
    validateAndLoadBook();
  }, [validateAndLoadBook]);

  // Set up beforeunload handler for unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  return (
    <CreatorLayout onExit={handleExit}>
      <div 
        className="edit-book"
        role="main"
        aria-busy={isLoading}
      >
        {isLoading ? (
          <div 
            className="edit-book__loading"
            role="status"
            aria-label="Loading book"
          >
            Loading...
          </div>
        ) : (
          <>
            <BookCreator
              bookId={id}
              onComplete={handleBookComplete}
              onAutoSave={handleAutoSave}
              className="edit-book__creator"
            />
            {lastSaved && (
              <div 
                className="edit-book__save-status"
                role="status"
                aria-live="polite"
              >
                Last saved: {lastSaved.toLocaleTimeString()}
              </div>
            )}
          </>
        )}
      </div>
    </CreatorLayout>
  );
};

export default EditBook;