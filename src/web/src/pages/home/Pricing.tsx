import React, { useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom'; // ^6.14.0
import { useAnalytics } from '@memorable/analytics'; // ^1.0.0
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { useTheme } from '../../hooks/useTheme';
import { BOOK_ROUTES } from '../../constants/routes.constants';
import { ThemeMode } from '../../types/theme.types';

/**
 * Interface for pricing tier configuration
 */
interface PricingTier {
  name: string;
  price: number;
  period: 'month' | 'year';
  features: string[];
  isPopular: boolean;
  buttonText: string;
  analyticsId: string;
  theme: {
    primary: string;
    secondary: string;
    accent: string;
  };
}

/**
 * Pricing tier configurations with feature sets and theming
 */
const PRICING_TIERS: PricingTier[] = [
  {
    name: 'Basic',
    price: 9.99,
    period: 'month',
    features: [
      '1 Book per month',
      'Standard themes',
      'Basic customization',
      'Digital preview',
      'Email support'
    ],
    isPopular: false,
    buttonText: 'Start Basic',
    analyticsId: 'pricing_basic',
    theme: {
      primary: 'var(--color-primary)',
      secondary: 'var(--color-secondary)',
      accent: 'var(--color-accent)'
    }
  },
  {
    name: 'Premium',
    price: 19.99,
    period: 'month',
    features: [
      '3 Books per month',
      'Premium themes',
      'Advanced customization',
      'Digital & Print copies',
      'Priority support',
      'Exclusive designs'
    ],
    isPopular: true,
    buttonText: 'Go Premium',
    analyticsId: 'pricing_premium',
    theme: {
      primary: 'var(--color-primary-variant)',
      secondary: 'var(--color-secondary-variant)',
      accent: 'var(--color-accent)'
    }
  },
  {
    name: 'Family',
    price: 29.99,
    period: 'month',
    features: [
      '5 Books per month',
      'All themes',
      'Full customization',
      'Digital & Print copies',
      '24/7 Priority support',
      'Exclusive designs',
      'Family sharing'
    ],
    isPopular: false,
    buttonText: 'Choose Family',
    analyticsId: 'pricing_family',
    theme: {
      primary: 'var(--color-secondary)',
      secondary: 'var(--color-primary)',
      accent: 'var(--color-accent)'
    }
  }
];

/**
 * FAQ items for pricing section
 */
const FAQ_ITEMS = [
  {
    question: 'What payment methods do you accept?',
    answer: 'We accept all major credit cards, PayPal, and Apple Pay.',
    id: 'payment-methods'
  },
  {
    question: 'Can I cancel my subscription?',
    answer: 'Yes, you can cancel your subscription at any time with no penalties.',
    id: 'cancellation'
  },
  // Add more FAQ items as needed
];

/**
 * Individual pricing card component with accessibility support
 */
const PricingCard: React.FC<{
  tier: PricingTier;
  onSelect: (tier: PricingTier) => void;
}> = ({ tier, onSelect }) => {
  const { currentTheme } = useTheme();
  const isDarkMode = currentTheme?.settings.mode === ThemeMode.DARK;

  return (
    <Card
      variant={tier.isPopular ? 'elevated' : 'default'}
      elevation="medium"
      interactive
      onClick={() => onSelect(tier)}
      className="pricing-card"
      ariaLabel={`${tier.name} plan at ${tier.price} per ${tier.period}`}
      focusable
    >
      {tier.isPopular && (
        <div
          className="popular-badge"
          role="note"
          aria-label="Most popular choice"
        >
          Most Popular
        </div>
      )}

      <h3 className="tier-name">{tier.name}</h3>
      <div className="price-container" aria-label={`${tier.price} dollars per ${tier.period}`}>
        <span className="currency">$</span>
        <span className="amount">{tier.price}</span>
        <span className="period">/{tier.period}</span>
      </div>

      <ul className="features-list" aria-label="Plan features">
        {tier.features.map((feature, index) => (
          <li key={index} className="feature-item">
            {feature}
          </li>
        ))}
      </ul>

      <Button
        variant="primary"
        fullWidth
        size="large"
        onClick={() => onSelect(tier)}
        ariaLabel={`Select ${tier.name} plan`}
        theme={isDarkMode ? 'dark' : 'light'}
      >
        {tier.buttonText}
      </Button>
    </Card>
  );
};

/**
 * Main pricing component with enhanced features and analytics
 */
export const Pricing: React.FC = () => {
  const navigate = useNavigate();
  const { trackEvent, trackConversion } = useAnalytics();
  const { currentTheme } = useTheme();

  // Memoized theme-aware styles
  const styles = useMemo(() => ({
    container: {
      backgroundColor: currentTheme?.settings.colors.background.base,
      color: currentTheme?.settings.colors.text.primary.base,
      padding: 'var(--spacing-xl)',
      transition: 'background-color var(--transition-duration-normal) var(--transition-easing-standard)'
    },
    grid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
      gap: 'var(--spacing-lg)',
      maxWidth: '1200px',
      margin: '0 auto'
    }
  }), [currentTheme]);

  // Handle pricing selection with analytics
  const handlePricingSelect = useCallback((tier: PricingTier) => {
    // Track pricing selection event
    trackEvent('pricing_selected', {
      tier: tier.name,
      price: tier.price,
      period: tier.period
    });

    // Track conversion funnel progress
    trackConversion('pricing_to_book_creation', {
      tierId: tier.analyticsId
    });

    // Navigate to book creation with selected tier
    navigate(BOOK_ROUTES.CREATE, {
      state: { selectedTier: tier }
    });
  }, [navigate, trackEvent, trackConversion]);

  return (
    <section
      style={styles.container}
      className="pricing-section"
      aria-labelledby="pricing-title"
    >
      <h2
        id="pricing-title"
        className="section-title"
        tabIndex={-1}
      >
        Choose Your Perfect Plan
      </h2>

      <div style={styles.grid} role="list" aria-label="Pricing plans">
        {PRICING_TIERS.map((tier) => (
          <div key={tier.name} role="listitem">
            <PricingCard
              tier={tier}
              onSelect={handlePricingSelect}
            />
          </div>
        ))}
      </div>

      {/* FAQ Section */}
      <section className="faq-section" aria-labelledby="faq-title">
        <h3 id="faq-title">Frequently Asked Questions</h3>
        <div className="faq-grid">
          {FAQ_ITEMS.map((item) => (
            <details
              key={item.id}
              className="faq-item"
              id={item.id}
            >
              <summary>{item.question}</summary>
              <p>{item.answer}</p>
            </details>
          ))}
        </div>
      </section>
    </section>
  );
};

export default Pricing;