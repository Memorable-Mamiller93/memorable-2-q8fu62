/**
 * @fileoverview BookPreview component for displaying interactive book previews
 * Implements Material Design 3.0 principles with comprehensive accessibility
 * and performance optimizations
 * @version 1.0.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion'; // v10.12.0
import classNames from 'classnames'; // v2.3.2
import { useSwipeable } from 'react-swipeable'; // v7.0.0

import { Book } from '../../types/book.types';
import PagePreview from '../preview/PagePreview';
import { useBook } from '../../hooks/useBook';

// Animation and interaction constants
const ANIMATION_DURATION = 300;
const PAGE_TRANSITION_EASING = 'ease-in-out';
const PRELOAD_ADJACENT_PAGES = 2;
const PERFORMANCE_THRESHOLD = 3000;
const GESTURE_SENSITIVITY = 50;

interface BookPreviewProps {
  /** ID of the book to preview */
  bookId: string;
  /** Flag indicating if preview is in demo mode */
  isDemo?: boolean;
  /** Callback for upgrade prompt in demo mode */
  onUpgrade?: () => void;
  /** Optional CSS class name */
  className?: string;
  /** Initial page number to display */
  initialPage?: number;
  /** Callback when page changes */
  onPageChange?: (page: number) => void;
}

/**
 * BookPreview component for displaying interactive book previews
 * with enhanced accessibility and performance optimizations
 */
const BookPreview: React.FC<BookPreviewProps> = ({
  bookId,
  isDemo = false,
  onUpgrade,
  className,
  initialPage = 1,
  onPageChange
}) => {
  // Book data and state management
  const { currentBook, loading, error } = useBook();
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const preloadedPages = useRef<Set<number>>(new Set());

  // Performance monitoring
  const renderStartTime = useRef(performance.now());
  const performanceWarningLogged = useRef(false);

  /**
   * Preloads adjacent pages for smoother navigation
   */
  const preloadAdjacentPages = useCallback((pageNumber: number) => {
    if (!currentBook?.pages) return;

    const pagesToPreload = [];
    for (let i = 1; i <= PRELOAD_ADJACENT_PAGES; i++) {
      const prevPage = pageNumber - i;
      const nextPage = pageNumber + i;

      if (prevPage > 0 && !preloadedPages.current.has(prevPage)) {
        pagesToPreload.push(prevPage);
      }
      if (nextPage <= currentBook.pages.length && !preloadedPages.current.has(nextPage)) {
        pagesToPreload.push(nextPage);
      }
    }

    pagesToPreload.forEach(page => {
      const img = new Image();
      img.src = currentBook.pages[page - 1].illustration.url;
      preloadedPages.current.add(page);
    });
  }, [currentBook]);

  /**
   * Handles page navigation with analytics and performance tracking
   */
  const handlePageChange = useCallback((pageNumber: number) => {
    if (!currentBook?.pages || isTransitioning) return;

    const totalPages = currentBook.pages.length;
    if (pageNumber < 1 || pageNumber > totalPages) return;

    setIsTransitioning(true);
    setCurrentPage(pageNumber);

    // Track analytics
    const analyticsData = {
      bookId,
      fromPage: currentPage,
      toPage: pageNumber,
      isDemo,
      timestamp: new Date().toISOString()
    };
    // Analytics tracking would go here

    // Performance monitoring
    const navigationTime = performance.now() - renderStartTime.current;
    if (navigationTime > PERFORMANCE_THRESHOLD && !performanceWarningLogged.current) {
      console.warn(`[BookPreview] Slow page navigation detected: ${navigationTime}ms`);
      performanceWarningLogged.current = true;
    }

    // Preload adjacent pages
    preloadAdjacentPages(pageNumber);

    // Update URL with current page
    const url = new URL(window.location.href);
    url.searchParams.set('page', pageNumber.toString());
    window.history.replaceState({}, '', url.toString());

    onPageChange?.(pageNumber);

    setTimeout(() => setIsTransitioning(false), ANIMATION_DURATION);
  }, [currentBook, currentPage, isDemo, isTransitioning, onPageChange, preloadAdjacentPages, bookId]);

  /**
   * Touch gesture handler for page navigation
   */
  const swipeHandlers = useSwipeable({
    onSwipedLeft: () => handlePageChange(currentPage + 1),
    onSwipedRight: () => handlePageChange(currentPage - 1),
    preventDefaultTouchmoveEvent: true,
    trackMouse: true,
    delta: GESTURE_SENSITIVITY
  });

  // Initialize book preview
  useEffect(() => {
    renderStartTime.current = performance.now();
    preloadedPages.current.clear();
    
    if (currentBook?.pages) {
      preloadAdjacentPages(currentPage);
    }
  }, [currentBook, currentPage, preloadAdjacentPages]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowLeft':
          handlePageChange(currentPage - 1);
          break;
        case 'ArrowRight':
          handlePageChange(currentPage + 1);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentPage, handlePageChange]);

  if (error) {
    return (
      <div className="book-preview-error" role="alert">
        <p>Error loading book preview: {error.error}</p>
      </div>
    );
  }

  if (!currentBook || loading.fetch) {
    return (
      <div className="book-preview-loading" role="status">
        <p>Loading book preview...</p>
      </div>
    );
  }

  const currentPageData = currentBook.pages[currentPage - 1];

  return (
    <div
      className={classNames('book-preview', className, {
        'book-preview--demo': isDemo
      })}
      {...swipeHandlers}
      role="region"
      aria-label="Book preview"
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={currentPage}
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -50 }}
          transition={{
            duration: ANIMATION_DURATION / 1000,
            ease: PAGE_TRANSITION_EASING
          }}
          className="book-preview__page-container"
        >
          <PagePreview
            page={currentPageData}
            isDemo={isDemo}
            loading={isTransitioning}
          />
        </motion.div>
      </AnimatePresence>

      <div className="book-preview__controls" role="navigation">
        <button
          onClick={() => handlePageChange(currentPage - 1)}
          disabled={currentPage === 1 || isTransitioning}
          aria-label="Previous page"
          className="book-preview__nav-button"
        >
          Previous
        </button>
        
        <span className="book-preview__page-indicator">
          Page {currentPage} of {currentBook.pages.length}
        </span>
        
        <button
          onClick={() => handlePageChange(currentPage + 1)}
          disabled={currentPage === currentBook.pages.length || isTransitioning}
          aria-label="Next page"
          className="book-preview__nav-button"
        >
          Next
        </button>
      </div>

      {isDemo && (
        <div className="book-preview__upgrade-prompt">
          <p>Preview mode - Some features are limited</p>
          <button
            onClick={onUpgrade}
            className="book-preview__upgrade-button"
          >
            Upgrade to unlock full access
          </button>
        </div>
      )}

      {/* Screen reader announcements */}
      <div className="sr-only" role="status" aria-live="polite">
        {`Viewing page ${currentPage} of ${currentBook.pages.length}`}
      </div>
    </div>
  );
};

export default BookPreview;