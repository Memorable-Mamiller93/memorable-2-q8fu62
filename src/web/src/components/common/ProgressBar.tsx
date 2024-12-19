import React, { useEffect, useRef, useState } from 'react';
import styles from '../../styles/variables.css';
import componentStyles from '../../styles/components.css';

interface ProgressBarProps {
  /** Current step/progress value */
  current: number;
  /** Total number of steps/progress value */
  total: number;
  /** Whether to show step indicators */
  showSteps?: boolean;
  /** Accessible label for the progress bar */
  ariaLabel?: string;
  /** Additional CSS class names */
  className?: string;
  /** Whether to animate progress changes */
  animated?: boolean;
  /** Callback when a step is clicked */
  onStepClick?: (step: number) => void;
}

/**
 * A reusable progress bar component that visualizes completion status
 * following Material Design 3.0 principles with enhanced accessibility.
 * @version 1.0.0
 */
export const ProgressBar: React.FC<ProgressBarProps> = ({
  current,
  total,
  showSteps = false,
  ariaLabel = 'Progress indicator',
  className = '',
  animated = true,
  onStepClick
}) => {
  const [progressWidth, setProgressWidth] = useState<string>('0%');
  const [prefersReducedMotion, setPrefersReducedMotion] = useState<boolean>(false);
  const progressRef = useRef<HTMLDivElement>(null);
  const stepsRef = useRef<(HTMLButtonElement | null)[]>([]);

  // Calculate progress width based on current and total values
  const calculateProgressWidth = (current: number, total: number): string => {
    if (current < 0 || total <= 0) return '0%';
    const percentage = Math.min(Math.max((current / total) * 100, 0), 100);
    return `${percentage}%`;
  };

  // Handle keyboard navigation for step indicators
  const handleKeyNavigation = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    const isLeftArrow = event.key === 'ArrowLeft';
    const isRightArrow = event.key === 'ArrowRight';
    
    if (!isLeftArrow && !isRightArrow) return;

    event.preventDefault();
    const targetIndex = isLeftArrow ? 
      Math.max(0, index - 1) : 
      Math.min(total - 1, index + 1);

    stepsRef.current[targetIndex]?.focus();
  };

  // Check for reduced motion preference
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);

    const handleChange = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  // Update progress width when current or total changes
  useEffect(() => {
    setProgressWidth(calculateProgressWidth(current, total));
  }, [current, total]);

  // Render step indicators if enabled
  const renderSteps = () => {
    if (!showSteps) return null;

    return (
      <div 
        className={componentStyles['step-indicators']}
        role="tablist"
        aria-label={`${total} total steps`}
      >
        {Array.from({ length: total }, (_, index) => (
          <button
            key={`step-${index}`}
            ref={el => stepsRef.current[index] = el}
            role="tab"
            aria-selected={current === index + 1}
            aria-label={`Step ${index + 1} of ${total}`}
            tabIndex={current === index + 1 ? 0 : -1}
            className={`${componentStyles['step']} ${
              index + 1 <= current ? componentStyles['step-completed'] : ''
            }`}
            onClick={() => onStepClick?.(index + 1)}
            onKeyDown={(e) => handleKeyNavigation(e, index)}
          />
        ))}
      </div>
    );
  };

  return (
    <div 
      className={`${componentStyles['progress-bar']} ${className}`}
      role="progressbar"
      aria-label={ariaLabel}
      aria-valuenow={current}
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuetext={`Step ${current} of ${total}`}
      ref={progressRef}
    >
      <div className={componentStyles['progress-track']}>
        <div 
          className={`
            ${componentStyles['progress-fill']}
            ${animated && !prefersReducedMotion ? componentStyles['animated'] : ''}
          `}
          style={{ 
            width: progressWidth,
            transition: prefersReducedMotion ? 'none' : undefined
          }}
        />
      </div>
      {renderSteps()}
    </div>
  );
};

// Type export for external usage
export type { ProgressBarProps };