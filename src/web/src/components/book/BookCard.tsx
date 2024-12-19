import React, { useCallback, useMemo } from 'react';
import classNames from 'classnames'; // v2.3.2
import Card from '../common/Card';
import Button from '../common/Button';
import { Book, BookStatus } from '../../types/book.types';
import { useTheme } from '../../hooks/useTheme';
import styles from './BookCard.module.css';

/**
 * Props for the BookCard component with enhanced accessibility
 */
interface BookCardProps {
  /** Book object containing all book information */
  book: Book;
  /** Async handler for edit action with loading state */
  onEdit?: (bookId: string) => Promise<void>;
  /** Async handler for preview action with loading state */
  onPreview?: (bookId: string) => Promise<void>;
  /** Async handler for delete action with confirmation */
  onDelete?: (bookId: string) => Promise<void>;
  /** Optional additional CSS classes */
  className?: string;
  /** Accessible label for the card */
  ariaLabel?: string;
}

/**
 * Returns appropriate semantic color class based on book status
 */
const getStatusColor = (status: BookStatus['status'], theme: string): string => {
  const baseClass = 'status-indicator';
  const statusMap: Record<BookStatus['status'], string> = {
    draft: `${baseClass} status-draft`,
    generating: `${baseClass} status-generating`,
    complete: `${baseClass} status-complete`,
    error: `${baseClass} status-error`
  };
  
  return classNames(statusMap[status], `theme-${theme}`);
};

/**
 * Returns localized and accessible status text
 */
const getStatusText = (status: BookStatus['status']): string => {
  const statusMap: Record<BookStatus['status'], string> = {
    draft: 'Draft',
    generating: 'Generating',
    complete: 'Complete',
    error: 'Error'
  };
  
  return statusMap[status];
};

/**
 * BookCard Component
 * 
 * A reusable card component that displays book information with comprehensive
 * accessibility support and theme awareness.
 */
export const BookCard: React.FC<BookCardProps> = ({
  book,
  onEdit,
  onPreview,
  onDelete,
  className,
  ariaLabel
}) => {
  const { currentTheme } = useTheme();

  // Memoized status classes
  const statusClasses = useMemo(() => 
    getStatusColor(book.status.status, currentTheme?.settings.mode || 'light'),
    [book.status.status, currentTheme?.settings.mode]
  );

  // Memoized progress calculation for generating status
  const progress = useMemo(() => {
    if (book.status.status === 'generating' && 'progress' in book.status) {
      return book.status.progress;
    }
    return null;
  }, [book.status]);

  // Action handlers with loading states
  const handleEdit = useCallback(async () => {
    if (onEdit) {
      try {
        await onEdit(book.id);
      } catch (error) {
        console.error('Error editing book:', error);
      }
    }
  }, [book.id, onEdit]);

  const handlePreview = useCallback(async () => {
    if (onPreview) {
      try {
        await onPreview(book.id);
      } catch (error) {
        console.error('Error previewing book:', error);
      }
    }
  }, [book.id, onPreview]);

  const handleDelete = useCallback(async () => {
    if (onDelete && window.confirm('Are you sure you want to delete this book?')) {
      try {
        await onDelete(book.id);
      } catch (error) {
        console.error('Error deleting book:', error);
      }
    }
  }, [book.id, onDelete]);

  return (
    <Card
      variant="elevated"
      elevation="medium"
      className={classNames(styles.bookCard, className)}
      ariaLabel={ariaLabel || `Book: ${book.title}`}
      role="article"
    >
      {/* Book Cover Image */}
      <div className={styles.coverWrapper} aria-hidden="true">
        <img
          src={book.metadata.mainCharacter.photoUrl || '/placeholder-cover.jpg'}
          alt=""
          className={styles.coverImage}
          loading="lazy"
        />
      </div>

      {/* Book Information */}
      <div className={styles.content}>
        <h3 
          id={`book-title-${book.id}`}
          className={styles.title}
        >
          {book.title}
        </h3>

        {/* Status Indicator */}
        <div 
          className={statusClasses}
          aria-label={`Status: ${getStatusText(book.status.status)}`}
        >
          <span className={styles.statusText}>
            {getStatusText(book.status.status)}
          </span>
          {progress !== null && (
            <span className={styles.progressText}>
              {`${Math.round(progress)}%`}
            </span>
          )}
        </div>

        {/* Theme Badge */}
        <div 
          className={classNames(styles.themeBadge, styles[book.theme.name.toLowerCase()])}
          aria-label={`Theme: ${book.theme.name}`}
        >
          {book.theme.name}
        </div>

        {/* Action Buttons */}
        <div 
          className={styles.actions}
          aria-label="Book actions"
        >
          <Button
            variant="secondary"
            size="small"
            onClick={handlePreview}
            disabled={book.status.status === 'generating'}
            ariaLabel="Preview book"
            startIcon="👁️"
          >
            Preview
          </Button>
          <Button
            variant="primary"
            size="small"
            onClick={handleEdit}
            disabled={book.status.status === 'generating'}
            ariaLabel="Edit book"
            startIcon="✏️"
          >
            Edit
          </Button>
          <Button
            variant="text"
            size="small"
            onClick={handleDelete}
            disabled={book.status.status === 'generating'}
            ariaLabel="Delete book"
            startIcon="🗑️"
          >
            Delete
          </Button>
        </div>

        {/* Error Message */}
        {book.status.status === 'error' && 'message' in book.status && (
          <div 
            className={styles.errorMessage}
            role="alert"
            aria-live="polite"
          >
            {book.status.message}
          </div>
        )}
      </div>
    </Card>
  );
};

export default React.memo(BookCard);