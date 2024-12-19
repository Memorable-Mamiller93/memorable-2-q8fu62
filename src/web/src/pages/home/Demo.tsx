/**
 * @fileoverview Demo page component implementing a high-conversion demo-to-paid flow
 * Features AI-powered book creation preview, watermarked content, and strategic upgrade prompts
 * @version 1.0.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ErrorBoundary } from 'react-error-boundary';
import { v4 as uuidv4 } from 'uuid';

import ThemeSelector from '../../components/book/ThemeSelector';
import BookPreview from '../../components/book/BookPreview';
import Loading from '../../components/common/Loading';

// Constants for demo flow
const DEMO_STEPS = 4;
const MAX_GENERATION_TIME = 30000; // 30 seconds
const UPGRADE_PROMPT_INTERVALS = [2, 3, 4]; // Show prompts after these steps
const ANALYTICS_EVENTS = {
  THEME_SELECT: 'demo_theme_select',
  UPGRADE_CLICK: 'demo_upgrade_click',
  COMPLETE: 'demo_complete'
} as const;

// Types for demo state management
interface DemoState {
  step: number;
  themeId: string | null;
  characterName: string;
  characterAge: number;
  interests: string[];
  sessionId: string;
  startTime: number;
  interactions: DemoInteraction[];
}

interface DemoInteraction {
  action: string;
  timestamp: number;
  metadata?: Record<string, any>;
}

/**
 * Demo page component implementing a high-conversion demo-to-paid flow
 */
const Demo: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [demoState, setDemoState] = useState<DemoState>({
    step: 1,
    themeId: null,
    characterName: '',
    characterAge: 0,
    interests: [],
    sessionId: uuidv4(),
    startTime: Date.now(),
    interactions: []
  });

  const [isGenerating, setIsGenerating] = useState(false);
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);
  const generationTimeout = useRef<NodeJS.Timeout>();

  // Track demo interactions
  const trackInteraction = useCallback((action: string, metadata?: Record<string, any>) => {
    setDemoState(prev => ({
      ...prev,
      interactions: [
        ...prev.interactions,
        {
          action,
          timestamp: Date.now(),
          metadata
        }
      ]
    }));
  }, []);

  // Handle theme selection with analytics
  const handleThemeSelect = useCallback((theme: any) => {
    trackInteraction(ANALYTICS_EVENTS.THEME_SELECT, { themeId: theme.id });
    
    setDemoState(prev => ({
      ...prev,
      themeId: theme.id,
      step: prev.step + 1
    }));

    // Simulate AI generation with optimistic UI
    setIsGenerating(true);
    generationTimeout.current = setTimeout(() => {
      setIsGenerating(false);
      if (UPGRADE_PROMPT_INTERVALS.includes(demoState.step + 1)) {
        setShowUpgradePrompt(true);
      }
    }, Math.min(3000, MAX_GENERATION_TIME)); // Keep within performance budget
  }, [demoState.step, trackInteraction]);

  // Handle upgrade prompt interaction
  const handleUpgradeClick = useCallback(() => {
    const sessionDuration = Date.now() - demoState.startTime;
    trackInteraction(ANALYTICS_EVENTS.UPGRADE_CLICK, {
      step: demoState.step,
      sessionDuration,
      interactions: demoState.interactions.length
    });

    // Save demo state for continuation after registration
    sessionStorage.setItem('demo_state', JSON.stringify(demoState));
    
    // Navigate to registration with demo state
    navigate('/register', {
      state: { 
        source: 'demo',
        sessionId: demoState.sessionId,
        progress: demoState.step / DEMO_STEPS
      }
    });
  }, [demoState, navigate, trackInteraction]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (generationTimeout.current) {
        clearTimeout(generationTimeout.current);
      }
    };
  }, []);

  // Error fallback component
  const ErrorFallback = ({ error, resetErrorBoundary }: any) => (
    <div role="alert" className="demo-error">
      <h2>Something went wrong</h2>
      <pre>{error.message}</pre>
      <button onClick={resetErrorBoundary}>Try again</button>
    </div>
  );

  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <div className="demo-container" role="main">
        <header className="demo-header">
          <h1>Create Your Personalized Story</h1>
          <p>Experience the magic of AI-powered storytelling</p>
        </header>

        <div className="demo-content">
          {/* Theme Selection */}
          <section 
            className="demo-section"
            aria-label="Theme Selection"
          >
            <ThemeSelector
              onThemeSelect={handleThemeSelect}
              selectedThemeId={demoState.themeId}
              ariaLabel="Choose your story theme"
              className="demo-theme-selector"
            />
          </section>

          {/* Book Preview */}
          {demoState.themeId && (
            <section 
              className="demo-section"
              aria-label="Book Preview"
            >
              <BookPreview
                bookId={demoState.sessionId}
                isDemo={true}
                onUpgrade={handleUpgradeClick}
              />
            </section>
          )}

          {/* Loading State */}
          {isGenerating && (
            <Loading
              size="large"
              text="Creating your story..."
              fullScreen={false}
              className="demo-loading"
              reducedMotion={false}
              ariaLabel="Generating story content"
            />
          )}

          {/* Upgrade Prompt */}
          {showUpgradePrompt && (
            <div 
              className="demo-upgrade-prompt"
              role="complementary"
              aria-label="Upgrade prompt"
            >
              <h2>Ready to Create Your Story?</h2>
              <p>Unlock full access to create and customize your personalized book</p>
              <button
                onClick={handleUpgradeClick}
                className="demo-upgrade-button"
                aria-label="Upgrade to full access"
              >
                Create Your Book Now
              </button>
            </div>
          )}
        </div>

        {/* Progress Indicator */}
        <footer className="demo-footer">
          <div 
            className="demo-progress"
            role="progressbar"
            aria-valuenow={(demoState.step / DEMO_STEPS) * 100}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            Step {demoState.step} of {DEMO_STEPS}
          </div>
        </footer>
      </div>
    </ErrorBoundary>
  );
};

export default Demo;