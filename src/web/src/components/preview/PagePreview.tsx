/**
 * @fileoverview PagePreview component for rendering book page content with animations
 * Implements Material Design 3.0 principles with comprehensive accessibility features
 * @version 1.0.0
 */

import React, { memo, useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion'; // v10.12.0
import { useMediaQuery } from '@mui/material'; // v5.14.0
import { BookPage } from '../../types/book.types';
import { Loading } from '../common/Loading';

// Animation constants
const ANIMATION_DURATION = 0.3;
const TOUCH_THRESHOLD = 50;
const WATERMARK_OPACITY = 0.3;

interface PagePreviewProps {
  /** Current page data to display */
  page: BookPage;
  /** Handler for next page navigation */
  onNextPage: () => void;
  /** Handler for previous page navigation */
  onPreviousPage: () => void;
  /** Loading state indicator */
  isLoading: boolean;
  /** Demo mode flag for watermark display */
  isDemoMode: boolean;
  /** Flag to disable animations based on user preferences */
  animationDisabled?: boolean;
}

/**
 * PagePreview component for displaying book pages with animations and accessibility
 */
const PagePreview: React.FC<PagePreviewProps> = memo(({
  page,
  onNextPage,
  onPreviousPage,
  isLoading,
  isDemoMode,
  animationDisabled = false
}) => {
  // Check system preferences for reduced motion
  const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const shouldAnimate = !prefersReducedMotion && !animationDisabled;

  // Refs for touch handling
  const touchStartX = useRef<number>(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // State for image loading
  const [imageLoaded, setImageLoaded] = useState(false);

  // Animation variants
  const pageVariants = {
    enter: (direction: number) => ({
      x: direction > 0 ? '100%' : '-100%',
      opacity: 0
    }),
    center: {
      x: 0,
      opacity: 1
    },
    exit: (direction: number) => ({
      x: direction < 0 ? '100%' : '-100%',
      opacity: 0
    })
  };

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowLeft':
          onPreviousPage();
          break;
        case 'ArrowRight':
          onNextPage();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onNextPage, onPreviousPage]);

  // Touch event handlers
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    const touchEndX = e.changedTouches[0].clientX;
    const deltaX = touchEndX - touchStartX.current;

    if (Math.abs(deltaX) > TOUCH_THRESHOLD) {
      if (deltaX > 0) {
        onPreviousPage();
      } else {
        onNextPage();
      }
    }
  }, [onNextPage, onPreviousPage]);

  // Render loading state
  if (isLoading) {
    return (
      <div className="page-preview-loading" role="status">
        <Loading 
          size="large"
          text="Loading page..."
          reducedMotion={prefersReducedMotion}
          ariaLabel={`Loading page ${page.pageNumber}`}
        />
      </div>
    );
  }

  // Render watermark for demo mode
  const renderWatermark = () => (
    <div
      className="page-preview-watermark"
      aria-hidden="true"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: `repeating-linear-gradient(
          45deg,
          rgba(0, 0, 0, ${WATERMARK_OPACITY}),
          rgba(0, 0, 0, ${WATERMARK_OPACITY}) 10px,
          transparent 10px,
          transparent 20px
        )`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'none'
      }}
    >
      <span style={{ 
        transform: 'rotate(-45deg)',
        fontSize: '2rem',
        color: 'rgba(0, 0, 0, 0.5)'
      }}>
        PREVIEW
      </span>
    </div>
  );

  return (
    <div
      ref={containerRef}
      className="page-preview-container"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        backgroundColor: 'var(--color-surface)',
        borderRadius: 'var(--border-radius-lg)',
        boxShadow: 'var(--shadow-lg)'
      }}
    >
      <AnimatePresence initial={false} custom={page.pageNumber}>
        <motion.div
          key={page.pageNumber}
          custom={page.pageNumber}
          variants={pageVariants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{
            duration: shouldAnimate ? ANIMATION_DURATION : 0,
            type: 'tween',
            ease: 'easeInOut'
          }}
          className="page-preview-content"
          style={{
            position: 'absolute',
            width: '100%',
            height: '100%',
            padding: 'var(--spacing-lg)'
          }}
        >
          {/* Page content */}
          <div className="page-preview-text">
            <p style={{ fontSize: 'var(--font-size-lg)', lineHeight: 'var(--line-height-relaxed)' }}>
              {page.content}
            </p>
          </div>

          {/* Page illustration */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: imageLoaded ? 1 : 0 }}
            transition={{ duration: 0.3 }}
            className="page-preview-illustration"
          >
            <img
              src={page.illustration.url}
              alt={page.illustration.alt}
              onLoad={() => setImageLoaded(true)}
              style={{
                maxWidth: '100%',
                height: 'auto',
                borderRadius: 'var(--border-radius-md)'
              }}
              loading="lazy"
            />
          </motion.div>

          {/* Page number */}
          <div
            className="page-preview-page-number"
            aria-label={`Page ${page.pageNumber}`}
            style={{
              position: 'absolute',
              bottom: 'var(--spacing-md)',
              right: 'var(--spacing-md)',
              fontSize: 'var(--font-size-sm)',
              color: 'var(--color-text-secondary)'
            }}
          >
            {page.pageNumber}
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Navigation buttons */}
      <div className="page-preview-navigation" role="navigation">
        <button
          onClick={onPreviousPage}
          aria-label="Previous page"
          className="page-preview-nav-button"
          style={{
            position: 'absolute',
            left: 'var(--spacing-md)',
            top: '50%',
            transform: 'translateY(-50%)'
          }}
        >
          ←
        </button>
        <button
          onClick={onNextPage}
          aria-label="Next page"
          className="page-preview-nav-button"
          style={{
            position: 'absolute',
            right: 'var(--spacing-md)',
            top: '50%',
            transform: 'translateY(-50%)'
          }}
        >
          →
        </button>
      </div>

      {/* Demo mode watermark */}
      {isDemoMode && renderWatermark()}

      {/* Screen reader announcements */}
      <div className="sr-only" role="status" aria-live="polite">
        {`Viewing page ${page.pageNumber}`}
      </div>
    </div>
  );
});

PagePreview.displayName = 'PagePreview';

export default PagePreview;