import React, { useState, useEffect, useRef } from 'react';
import { useGesture } from '@use-gesture/react';
import classNames from 'classnames';
import Loading from '../common/Loading';
import Modal from '../common/Modal';
import styles from './IllustrationPreview.module.css';

// Version comments for external dependencies
// @use-gesture/react: ^10.2.0 - Touch gesture handling
// classnames: ^2.3.2 - CSS class management
// react: ^18.2.0 - Core React functionality

interface IllustrationPreviewProps {
  /** Illustration data including URL and metadata */
  illustration: {
    imageUrl: string;
    prompt: string;
    style: string;
  } | null;
  /** Loading state indicator */
  isLoading: boolean;
  /** Demo mode flag for watermarked preview */
  isDemo: boolean;
  /** Callback for upgrade prompt click */
  onUpgradeClick: () => void;
  /** Additional CSS classes */
  className?: string;
  /** Enable/disable zoom functionality */
  zoomable?: boolean;
}

/**
 * IllustrationPreview Component
 * 
 * A responsive and accessible component for displaying AI-generated book illustrations
 * with advanced preview functionality including zoom, watermarking, and touch gestures.
 */
export const IllustrationPreview: React.FC<IllustrationPreviewProps> = ({
  illustration,
  isLoading,
  isDemo,
  onUpgradeClick,
  className,
  zoomable = true,
}) => {
  // State management
  const [imageLoaded, setImageLoaded] = useState(false);
  const [isZoomed, setIsZoomed] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [retryCount, setRetryCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  // Constants
  const MAX_ZOOM = 3;
  const MIN_ZOOM = 1;
  const MAX_RETRIES = 3;

  // Reset state when illustration changes
  useEffect(() => {
    setImageLoaded(false);
    setZoomLevel(1);
    setPosition({ x: 0, y: 0 });
    setError(null);
    setRetryCount(0);
  }, [illustration?.imageUrl]);

  // Gesture handling for zoom and pan
  const bind = useGesture(
    {
      onPinch: ({ offset: [scale] }) => {
        if (!zoomable) return;
        const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, scale));
        setZoomLevel(newZoom);
      },
      onDrag: ({ offset: [x, y], first }) => {
        if (!zoomable || zoomLevel === 1) return;
        if (first) {
          setIsZoomed(true);
        }
        setPosition({ x, y });
      },
    },
    {
      drag: {
        from: () => [position.x, position.y],
        bounds: getBoundaryConstraints(),
      },
      pinch: {
        from: () => [zoomLevel],
      },
    }
  );

  // Calculate boundary constraints for panning
  function getBoundaryConstraints() {
    if (!containerRef.current || !imageRef.current) return {};
    
    const containerBounds = containerRef.current.getBoundingClientRect();
    const imageBounds = imageRef.current.getBoundingClientRect();
    
    const maxX = (imageBounds.width * zoomLevel - containerBounds.width) / 2;
    const maxY = (imageBounds.height * zoomLevel - containerBounds.height) / 2;
    
    return {
      left: -maxX,
      right: maxX,
      top: -maxY,
      bottom: maxY,
    };
  }

  // Handle image load success
  const handleImageLoad = (event: React.SyntheticEvent<HTMLImageElement>) => {
    setImageLoaded(true);
    setError(null);
  };

  // Handle image load error with retry mechanism
  const handleImageError = () => {
    if (retryCount < MAX_RETRIES) {
      setRetryCount(prev => prev + 1);
      setError('Loading image failed. Retrying...');
    } else {
      setError('Unable to load illustration. Please try again later.');
    }
  };

  // Generate container classes
  const containerClasses = classNames(
    styles.container,
    {
      [styles.loading]: isLoading,
      [styles.demo]: isDemo,
      [styles.error]: error,
      [styles.zoomed]: isZoomed,
    },
    className
  );

  // Generate image transform style
  const imageStyle: React.CSSProperties = {
    transform: `scale(${zoomLevel}) translate(${position.x}px, ${position.y}px)`,
    transition: isZoomed ? 'none' : 'transform 0.3s ease-out',
  };

  return (
    <div 
      ref={containerRef}
      className={containerClasses}
      {...(zoomable ? bind() : {})}
      role="img"
      aria-label={illustration?.prompt || 'Book illustration'}
    >
      {isLoading && (
        <Loading 
          size="large"
          text="Generating illustration..."
          ariaLabel="Generating book illustration"
        />
      )}

      {error && (
        <div className={styles.errorContainer}>
          <p className={styles.errorMessage}>{error}</p>
          {retryCount < MAX_RETRIES && (
            <p className={styles.retryMessage}>Attempt {retryCount + 1} of {MAX_RETRIES}</p>
          )}
        </div>
      )}

      {illustration && (
        <>
          <img
            ref={imageRef}
            src={illustration.imageUrl}
            alt={illustration.prompt}
            className={styles.image}
            style={imageStyle}
            onLoad={handleImageLoad}
            onError={handleImageError}
            draggable={false}
          />

          {isDemo && (
            <div className={styles.watermark}>
              <p>Preview Mode</p>
              <button
                onClick={onUpgradeClick}
                className={styles.upgradeButton}
                aria-label="Upgrade to remove watermark"
              >
                Upgrade to Save
              </button>
            </div>
          )}

          {imageLoaded && zoomable && (
            <div className={styles.zoomInstructions} aria-hidden="true">
              <span>Pinch to zoom • Double tap to reset</span>
            </div>
          )}
        </>
      )}

      {isZoomed && (
        <Modal
          isOpen={isZoomed}
          onClose={() => setIsZoomed(false)}
          title="Illustration Preview"
          size="large"
        >
          <img
            src={illustration?.imageUrl}
            alt={illustration?.prompt}
            className={styles.modalImage}
          />
        </Modal>
      )}
    </div>
  );
};

export default IllustrationPreview;