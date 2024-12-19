/**
 * @fileoverview Enhanced landing page component for the Memorable platform
 * Implements Material Design 3.0 principles with comprehensive accessibility
 * and performance optimizations
 * @version 1.0.0
 */

import React, { useCallback, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAnalytics } from '@analytics/react';

// Internal imports
import MainLayout from '../../layouts/MainLayout';
import BookCard from '../../components/book/BookCard';
import Button from '../../components/common/Button';
import { ROUTES } from '../../constants/routes.constants';

// Types
interface SampleBook {
  id: string;
  title: string;
  coverImage: string;
  theme: string;
  alt: string;
}

// Sample books data with accessibility metadata
const SAMPLE_BOOKS: SampleBook[] = [
  {
    id: 'sample-1',
    title: 'The Magical Adventure',
    coverImage: '/assets/samples/magical-adventure.jpg',
    theme: 'magical',
    alt: 'A colorful storybook cover showing a child on a magical journey through a fantasy world'
  },
  {
    id: 'sample-2',
    title: 'Ocean Explorer',
    coverImage: '/assets/samples/ocean-explorer.jpg',
    theme: 'adventure',
    alt: 'An underwater scene featuring a child discovering marine life and treasures'
  }
];

/**
 * Enhanced Home component implementing the landing page
 */
export const Home: React.FC = () => {
  const navigate = useNavigate();
  const analytics = useAnalytics();

  // Track page view
  useEffect(() => {
    analytics.track('page_view', {
      page: 'home',
      timestamp: new Date().toISOString()
    });
  }, [analytics]);

  // Navigation handlers with analytics tracking
  const handleDemoClick = useCallback(() => {
    analytics.track('cta_click', {
      button: 'try_demo',
      location: 'hero_section'
    });
    navigate(ROUTES.DEMO);
  }, [navigate, analytics]);

  const handleLearnMoreClick = useCallback(() => {
    analytics.track('cta_click', {
      button: 'learn_more',
      location: 'hero_section'
    });
    navigate(ROUTES.FEATURES);
  }, [navigate, analytics]);

  // Memoized section content
  const heroSection = useMemo(() => (
    <section 
      className="hero"
      aria-labelledby="hero-title"
    >
      <h1 
        id="hero-title"
        className="hero__title"
      >
        Create Magical Stories for Children
      </h1>
      <p className="hero__subtitle">
        Transform your loved ones into storybook characters with AI-powered
        personalization and professional illustrations
      </p>
      <div 
        className="hero__actions"
        aria-label="Get started actions"
      >
        <Button
          variant="primary"
          size="large"
          onClick={handleDemoClick}
          ariaLabel="Try demo now"
          className="hero__cta-primary"
        >
          Try Demo Now
        </Button>
        <Button
          variant="secondary"
          size="large"
          onClick={handleLearnMoreClick}
          ariaLabel="Learn how it works"
          className="hero__cta-secondary"
        >
          See How It Works
        </Button>
      </div>
    </section>
  ), [handleDemoClick, handleLearnMoreClick]);

  const samplesSection = useMemo(() => (
    <section 
      className="samples"
      aria-labelledby="samples-title"
    >
      <h2 
        id="samples-title"
        className="samples__title"
      >
        Sample Books
      </h2>
      <div 
        className="samples__grid"
        role="list"
        aria-label="Sample book previews"
      >
        {SAMPLE_BOOKS.map(book => (
          <div 
            key={book.id}
            role="listitem"
            className="samples__item"
          >
            <BookCard
              book={{
                id: book.id,
                title: book.title,
                metadata: {
                  mainCharacter: {
                    photoUrl: book.coverImage
                  }
                },
                theme: {
                  name: book.theme
                },
                status: { status: 'complete' }
              } as any}
              ariaLabel={`Sample book: ${book.title}`}
              className="samples__card"
            />
          </div>
        ))}
      </div>
    </section>
  ), []);

  const featuresSection = useMemo(() => (
    <section 
      className="features"
      aria-labelledby="features-title"
    >
      <h2 
        id="features-title"
        className="features__title"
      >
        Key Features
      </h2>
      <div 
        className="features__grid"
        role="list"
      >
        <div role="listitem" className="features__item">
          <h3>AI-Powered Stories</h3>
          <p>Create unique, personalized stories using advanced AI technology</p>
        </div>
        <div role="listitem" className="features__item">
          <h3>Professional Illustrations</h3>
          <p>Beautiful, custom illustrations that bring your stories to life</p>
        </div>
        <div role="listitem" className="features__item">
          <h3>Easy Customization</h3>
          <p>Customize every aspect of your book with our intuitive editor</p>
        </div>
      </div>
    </section>
  ), []);

  return (
    <MainLayout className="home">
      <main 
        className="home__content"
        id="main-content"
      >
        {heroSection}
        {samplesSection}
        {featuresSection}
        
        <section 
          className="cta"
          aria-labelledby="cta-title"
        >
          <h2 
            id="cta-title"
            className="cta__title"
          >
            Ready to Create Your Story?
          </h2>
          <Button
            variant="primary"
            size="large"
            onClick={handleDemoClick}
            ariaLabel="Start creating your story"
            className="cta__button"
          >
            Start Creating Now
          </Button>
        </section>
      </main>
    </MainLayout>
  );
};

export default Home;