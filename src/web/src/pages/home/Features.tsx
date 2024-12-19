import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom'; // v6.14.0
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import { ROUTES } from '../../constants/routes.constants';

// Icons for feature items
const StoryIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
    <path
      fill="currentColor"
      d="M18 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 18H6V4h12v16z"
    />
    <path fill="currentColor" d="M8 6h8v2H8zm0 4h8v2H8zm0 4h5v2H8z" />
  </svg>
);

const IllustrationIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
    <path
      fill="currentColor"
      d="M21 3H3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H3V5h18v14z"
    />
    <path
      fill="currentColor"
      d="M15 10l-4 4-2-2-4 4h14l-4-6z"
    />
  </svg>
);

const PrintIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
    <path
      fill="currentColor"
      d="M19 8h-1V3H6v5H5c-1.66 0-3 1.34-3 3v6h4v4h12v-4h4v-6c0-1.66-1.34-3-3-3zM8 5h8v3H8V5zm8 14H8v-4h8v4zm4-4h-2v-2H6v2H4v-4c0-.55.45-1 1-1h14c.55 0 1 .45 1 1v4z"
    />
  </svg>
);

const CustomizeIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
    <path
      fill="currentColor"
      d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"
    />
  </svg>
);

interface FeatureItem {
  title: string;
  description: string;
  icon: React.ReactNode;
}

const FEATURE_ITEMS: FeatureItem[] = [
  {
    title: 'AI-Powered Story Generation',
    description: 'Create unique, personalized stories using advanced AI technology',
    icon: <StoryIcon />,
  },
  {
    title: 'Custom Illustrations',
    description: 'Generate beautiful, custom illustrations for every page',
    icon: <IllustrationIcon />,
  },
  {
    title: 'Professional Printing',
    description: 'High-quality, eco-friendly printing with local partners',
    icon: <PrintIcon />,
  },
  {
    title: 'Easy Customization',
    description: 'Simple tools to personalize every aspect of your book',
    icon: <CustomizeIcon />,
  },
];

export const Features: React.FC = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDemoClick = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      await navigate(ROUTES.DEMO);
      // Announce navigation for screen readers
      const announcement = document.createElement('div');
      announcement.setAttribute('role', 'status');
      announcement.setAttribute('aria-live', 'polite');
      announcement.textContent = 'Navigating to demo page';
      document.body.appendChild(announcement);
      setTimeout(() => document.body.removeChild(announcement), 1000);
    } catch (err) {
      setError('Unable to load demo. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section
      className="features-section"
      aria-labelledby="features-title"
      role="region"
    >
      <div className="features-header">
        <h2 
          id="features-title"
          className="features-title"
        >
          Create Magical Stories for Children
        </h2>
        <p className="features-subtitle">
          Transform your ideas into beautiful, personalized children's books with our AI-powered platform
        </p>
      </div>

      <div 
        className="features-grid"
        role="list"
      >
        {FEATURE_ITEMS.map((feature, index) => (
          <Card
            key={feature.title}
            variant="elevated"
            elevation="medium"
            interactive
            className="feature-card"
            ariaLabel={`Feature: ${feature.title}`}
            role="listitem"
            focusable
          >
            <div className="feature-icon" aria-hidden="true">
              {feature.icon}
            </div>
            <h3 className="feature-title">
              {feature.title}
            </h3>
            <p className="feature-description">
              {feature.description}
            </p>
          </Card>
        ))}
      </div>

      <div className="features-cta">
        <Button
          variant="primary"
          size="large"
          onClick={handleDemoClick}
          loading={isLoading}
          disabled={isLoading}
          ariaLabel="Try demo now"
          minTouchTarget
        >
          Try Demo Now
        </Button>
        {error && (
          <div 
            className="error-message" 
            role="alert"
            aria-live="polite"
          >
            {error}
          </div>
        )}
      </div>

      <style jsx>{`
        .features-section {
          padding: var(--spacing-2xl) var(--spacing-lg);
          background: var(--color-surface);
        }

        .features-header {
          text-align: center;
          margin-bottom: var(--spacing-xl);
        }

        .features-title {
          font-size: var(--font-size-2xl);
          font-weight: var(--font-weight-bold);
          color: var(--color-text-primary);
          margin-bottom: var(--spacing-md);
        }

        .features-subtitle {
          font-size: var(--font-size-lg);
          color: var(--color-text-secondary);
          max-width: 600px;
          margin: 0 auto;
        }

        .features-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: var(--spacing-lg);
          margin-bottom: var(--spacing-xl);
        }

        .feature-card {
          padding: var(--spacing-lg);
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          gap: var(--spacing-md);
        }

        .feature-icon {
          color: var(--color-primary);
          background: var(--color-surface-variant);
          padding: var(--spacing-md);
          border-radius: var(--border-radius-full);
          margin-bottom: var(--spacing-sm);
        }

        .feature-title {
          font-size: var(--font-size-lg);
          font-weight: var(--font-weight-medium);
          color: var(--color-text-primary);
        }

        .feature-description {
          color: var(--color-text-secondary);
          line-height: var(--line-height-relaxed);
        }

        .features-cta {
          text-align: center;
          margin-top: var(--spacing-xl);
        }

        .error-message {
          color: var(--color-error);
          margin-top: var(--spacing-md);
          font-size: var(--font-size-sm);
        }

        @media (max-width: var(--breakpoint-sm)) {
          .features-section {
            padding: var(--spacing-xl) var(--spacing-md);
          }

          .features-grid {
            grid-template-columns: 1fr;
            gap: var(--spacing-md);
          }
        }
      `}</style>
    </section>
  );
};

export default Features;