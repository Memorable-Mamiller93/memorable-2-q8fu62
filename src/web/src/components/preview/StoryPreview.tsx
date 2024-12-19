/**
 * @fileoverview Enhanced story preview component with production features
 * Implements real-time preview updates, content protection, and accessibility
 * @version 1.0.0
 */

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import classNames from 'classnames';
import { useInView } from 'react-intersection-observer';
import { Book } from '../../types/book.types';
import { Loading } from '../common/Loading';
import { useBook } from '../../hooks/useBook';

// Constants for content protection and watermarking
const WATERMARK_OPACITY = 0.15;
const DEMO_PAGE_LIMIT = 3;
const TOUCH_THRESHOLD = 50;

interface StoryPreviewProps {
  /** Flag indicating if preview is in demo mode */
  isDemo: boolean;
  /** Current page number being displayed */
  currentPage: number;
  /** Callback for page navigation with analytics */
  onPageChange: (page: number) => void;
  /** Optional CSS class name */
  className?: string;
  /** Error handling callback */
  onError?: (error: Error) => void;
  /** Custom watermark renderer */
  renderCustomWatermark?: () => React.ReactNode;
  /** Content protection configuration */
  contentProtection?: {
    disableCopy?: boolean;
    disableRightClick?: boolean;
    watermarkText?: string;
  };
}

/**
 * Enhanced story preview component with comprehensive features
 * Supports demo mode, content protection, and accessibility
 */
export const StoryPreview: React.FC<StoryPreviewProps> = ({
  isDemo,
  currentPage,
  onPageChange,
  className,
  onError,
  renderCustomWatermark,
  contentProtection = {
    disableCopy: true,
    disableRightClick: true,
    watermarkText: 'Preview Only'
  }
}) => {
  // Book data and loading state
  const { currentBook, loading, progress } = useBook();
  
  // Touch handling state
  const [touchStart, setTouchStart] = useState<number | null>(null);
  
  // Intersection observer for lazy loading
  const { ref: pageRef, inView } = useInView({
    threshold: 0.1,
    triggerOnce: true
  });

  // Memoized content protection handlers
  const protectionHandlers = useMemo(() => ({
    onCopy: (e: ClipboardEvent) => {
      if (contentProtection.disableCopy) {
        e.preventDefault();
      }
    },
    onContextMenu: (e: MouseEvent) => {
      if (contentProtection.disableRightClick) {
        e.preventDefault();
      }
    }
  }), [contentProtection]);

  // Set up content protection listeners
  useEffect(() => {
    document.addEventListener('copy', protectionHandlers.onCopy);
    document.addEventListener('contextmenu', protectionHandlers.onContextMenu);

    return () => {
      document.removeEventListener('copy', protectionHandlers.onCopy);
      document.removeEventListener('contextmenu', protectionHandlers.onContextMenu);
    };
  }, [protectionHandlers]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        handlePageChange(currentPage - 1);
      } else if (e.key === 'ArrowRight') {
        handlePageChange(currentPage + 1);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [currentPage]);

  // Touch event handlers for swipe navigation
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    setTouchStart(e.touches[0].clientX);
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!touchStart) return;

    const touchEnd = e.changedTouches[0].clientX;
    const diff = touchStart - touchEnd;

    if (Math.abs(diff) > TOUCH_THRESHOLD) {
      handlePageChange(diff > 0 ? currentPage + 1 : currentPage - 1);
    }

    setTouchStart(null);
  }, [touchStart, currentPage]);

  // Page navigation handler with validation
  const handlePageChange = useCallback((newPage: number) => {
    if (!currentBook?.pages) return;

    const maxPages = isDemo ? DEMO_PAGE_LIMIT : currentBook.pages.length;
    if (newPage >= 1 && newPage <= maxPages) {
      onPageChange(newPage);
    }
  }, [currentBook, isDemo, onPageChange]);

  // Render watermark for demo mode
  const renderWatermark = useCallback(() => {
    if (renderCustomWatermark) {
      return renderCustomWatermark();
    }

    return (
      <div 
        className="absolute inset-0 pointer-events-none select-none"
        style={{
          background: `repeating-linear-gradient(
            -45deg,
            rgba(0, 0, 0, ${WATERMARK_OPACITY}),
            rgba(0, 0, 0, ${WATERMARK_OPACITY}) 20px,
            transparent 20px,
            transparent 40px
          )`
        }}
      >
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-gray-500 text-xl rotate-[-45deg]">
            {contentProtection.watermarkText}
          </span>
        </div>
      </div>
    );
  }, [contentProtection.watermarkText, renderCustomWatermark]);

  // Handle loading and error states
  if (loading.fetch) {
    return <Loading size="large" text="Loading preview..." />;
  }

  if (!currentBook) {
    return (
      <div className="text-center text-red-500">
        Error loading preview. Please try again.
      </div>
    );
  }

  // Render the preview content
  return (
    <div
      className={classNames(
        'relative w-full h-full overflow-hidden',
        'bg-white dark:bg-gray-900',
        'rounded-lg shadow-lg',
        className
      )}
      ref={pageRef}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      role="region"
      aria-label="Story Preview"
    >
      {/* Current page content */}
      <div className="relative h-full p-8">
        {inView && currentBook.pages[currentPage - 1] && (
          <div className="prose dark:prose-invert max-w-none">
            <div 
              className="page-content"
              dangerouslySetInnerHTML={{ 
                __html: currentBook.pages[currentPage - 1].content 
              }}
            />
            {currentBook.pages[currentPage - 1].illustration && (
              <img
                src={currentBook.pages[currentPage - 1].illustration.url}
                alt={currentBook.pages[currentPage - 1].illustration.alt}
                className="w-full h-auto rounded-lg shadow-md"
                loading="lazy"
              />
            )}
          </div>
        )}

        {/* Demo mode watermark */}
        {isDemo && renderWatermark()}
      </div>

      {/* Navigation controls */}
      <div className="absolute bottom-0 left-0 right-0 p-4 flex justify-between bg-gradient-to-t from-black/20 to-transparent">
        <button
          onClick={() => handlePageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="btn btn-text text-white"
          aria-label="Previous page"
        >
          Previous
        </button>
        <span className="text-white">
          Page {currentPage} of {isDemo ? DEMO_PAGE_LIMIT : currentBook.pages.length}
        </span>
        <button
          onClick={() => handlePageChange(currentPage + 1)}
          disabled={currentPage === (isDemo ? DEMO_PAGE_LIMIT : currentBook.pages.length)}
          className="btn btn-text text-white"
          aria-label="Next page"
        >
          Next
        </button>
      </div>

      {/* Demo mode upgrade prompt */}
      {isDemo && currentPage === DEMO_PAGE_LIMIT && (
        <div className="absolute top-0 left-0 right-0 p-4 bg-primary text-white text-center">
          <p>Like what you see? Sign up to create your own story!</p>
          <button className="btn btn-secondary mt-2">
            Create Account
          </button>
        </div>
      )}
    </div>
  );
};

export default React.memo(StoryPreview);