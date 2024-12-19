/**
 * @fileoverview Book Preview Page Component
 * Implements full-screen book preview with demo/authenticated modes,
 * interactive navigation, and enhanced conversion features
 * @version 1.0.0
 */

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useSwipeable } from 'react-swipeable'; // v7.0.0

import BookPreview from '../../components/book/BookPreview';
import { useBook } from '../../hooks/useBook';
import { Loading } from '../../components/common/Loading';

// Analytics event types for preview interactions
const PREVIEW_EVENTS = {
  START: 'preview_start',
  PAGE_VIEW: 'page_view',
  UPGRADE_CLICK: 'upgrade_click',
  SHARE: 'preview_share',
  COMPLETE: 'preview_complete'
} as const;

// Performance monitoring thresholds
const PERFORMANCE_THRESHOLDS = {
  LOAD_TIME: 3000, // 3s max load time per requirements
  INTERACTION_DELAY: 100
} as const;

interface PreviewPageParams {
  bookId: string;
  mode?: 'demo' | 'full';
}

interface PreviewAnalytics {
  eventType: keyof typeof PREVIEW_EVENTS;
  metadata: {
    bookId: string;
    mode: 'demo' | 'full';
    timestamp: string;
    [key: string]: any;
  };
}

/**
 * Book Preview Page Component
 * Provides interactive book preview with conversion optimization
 */
const Preview: React.FC = () => {
  const { bookId, mode = 'full' } = useParams<PreviewPageParams>();
  const navigate = useNavigate();
  const { currentBook, loading } = useBook();
  
  // State management
  const [previewStartTime] = useState<number>(Date.now());
  const [interactionCount, setInteractionCount] = useState<number>(0);
  const analyticsQueue = useRef<PreviewAnalytics[]>([]);

  /**
   * Tracks preview analytics events
   */
  const trackAnalytics = useCallback((
    eventType: keyof typeof PREVIEW_EVENTS,
    additionalMetadata: Record<string, any> = {}
  ) => {
    const event: PreviewAnalytics = {
      eventType,
      metadata: {
        bookId: bookId!,
        mode,
        timestamp: new Date().toISOString(),
        ...additionalMetadata
      }
    };
    analyticsQueue.current.push(event);
  }, [bookId, mode]);

  /**
   * Handles upgrade flow for demo users
   */
  const handleUpgrade = useCallback(() => {
    trackAnalytics('UPGRADE_CLICK', {
      timeSpent: Date.now() - previewStartTime,
      interactionCount
    });

    // Save preview state for continuation after signup
    sessionStorage.setItem('preview_state', JSON.stringify({
      bookId,
      lastPage: currentBook?.pages?.length || 1,
      timestamp: Date.now()
    }));

    navigate('/signup', { 
      state: { 
        source: 'preview',
        bookId 
      }
    });
  }, [bookId, currentBook, interactionCount, navigate, previewStartTime, trackAnalytics]);

  /**
   * Initializes preview session
   */
  useEffect(() => {
    trackAnalytics('START');

    // Performance monitoring
    const loadTime = Date.now() - previewStartTime;
    if (loadTime > PERFORMANCE_THRESHOLDS.LOAD_TIME) {
      console.warn(`[Preview] Slow load time: ${loadTime}ms`);
    }

    return () => {
      // Flush analytics queue on unmount
      trackAnalytics('COMPLETE', {
        totalTime: Date.now() - previewStartTime,
        totalInteractions: interactionCount
      });
    };
  }, [previewStartTime, trackAnalytics, interactionCount]);

  /**
   * Touch gesture handlers for mobile interaction
   */
  const swipeHandlers = useSwipeable({
    onSwipedLeft: () => setInteractionCount(prev => prev + 1),
    onSwipedRight: () => setInteractionCount(prev => prev + 1),
    preventDefaultTouchmoveEvent: true,
    trackMouse: true
  });

  // Loading state
  if (loading.fetch) {
    return (
      <div className="preview-loading" role="status">
        <Loading 
          size="large"
          text="Loading preview..."
          fullScreen
          ariaLabel="Loading book preview"
        />
      </div>
    );
  }

  // Error state
  if (!currentBook) {
    return (
      <div className="preview-error" role="alert">
        <h2>Preview Unavailable</h2>
        <p>Unable to load book preview. Please try again later.</p>
      </div>
    );
  }

  return (
    <div 
      className="preview-container"
      {...swipeHandlers}
      style={{
        height: '100vh',
        width: '100vw',
        position: 'fixed',
        top: 0,
        left: 0,
        backgroundColor: 'var(--color-background)',
        zIndex: 'var(--z-index-modal)'
      }}
    >
      <BookPreview
        bookId={bookId!}
        isDemo={mode === 'demo'}
        onUpgrade={handleUpgrade}
      />

      {/* Navigation overlay */}
      <div 
        className="preview-navigation"
        style={{
          position: 'absolute',
          top: 'var(--spacing-md)',
          left: 'var(--spacing-md)',
          zIndex: 'var(--z-index-modal)'
        }}
      >
        <button
          onClick={() => navigate(-1)}
          className="btn btn-text"
          aria-label="Close preview"
        >
          ← Back
        </button>
      </div>

      {/* Demo mode upgrade prompt */}
      {mode === 'demo' && (
        <div 
          className="preview-upgrade-prompt"
          style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            padding: 'var(--spacing-lg)',
            backgroundColor: 'var(--color-surface)',
            boxShadow: 'var(--shadow-lg)',
            textAlign: 'center',
            zIndex: 'var(--z-index-modal)'
          }}
        >
          <p>You're viewing a demo preview. Create an account to save and customize your book.</p>
          <button
            onClick={handleUpgrade}
            className="btn btn-primary"
            style={{ marginTop: 'var(--spacing-md)' }}
          >
            Upgrade Now
          </button>
        </div>
      )}

      {/* Screen reader announcements */}
      <div className="sr-only" role="status" aria-live="polite">
        {`Viewing ${mode === 'demo' ? 'demo ' : ''}preview of ${currentBook.title}`}
      </div>
    </div>
  );
};

export default Preview;