/**
 * @fileoverview Enhanced Footer component implementing Material Design 3.0 principles
 * Features responsive layout, accessibility support, and theme integration
 * @version 1.0.0
 */

import React, { useMemo } from 'react';
import { Link } from 'react-router-dom'; // v6.14.0
import classNames from 'classnames'; // v2.3.2
import { Button } from '../common/Button';
import { useTheme } from '../hooks/useTheme';

/**
 * Props interface for the Footer component
 */
interface FooterProps {
  /** Additional CSS classes for the footer container */
  className?: string;
  /** Footer variant determining content display and layout */
  variant?: 'default' | 'minimal' | 'expanded';
  /** Toggle social media links visibility */
  showSocial?: boolean;
  /** Optional analytics tracking ID */
  analyticsId?: string;
}

/**
 * Enhanced Footer component with accessibility and responsive design
 */
export const Footer: React.FC<FooterProps> = ({
  className,
  variant = 'default',
  showSocial = true,
  analyticsId
}) => {
  const { currentTheme, isHighContrastMode } = useTheme();

  // Memoized current year for copyright notice
  const currentYear = useMemo(() => new Date().getFullYear(), []);

  // Navigation sections with ARIA labels
  const navigationSections = [
    {
      title: 'Product',
      ariaLabel: 'Product navigation',
      links: [
        { text: 'Features', href: '/features' },
        { text: 'Pricing', href: '/pricing' },
        { text: 'Demo', href: '/demo' },
        { text: 'How It Works', href: '/how-it-works' }
      ]
    },
    {
      title: 'Company',
      ariaLabel: 'Company information',
      links: [
        { text: 'About Us', href: '/about' },
        { text: 'Contact', href: '/contact' },
        { text: 'Terms of Service', href: '/terms' },
        { text: 'Privacy Policy', href: '/privacy' }
      ]
    },
    {
      title: 'Support',
      ariaLabel: 'Customer support',
      links: [
        { text: 'Help Center', href: '/help' },
        { text: 'FAQs', href: '/faqs' },
        { text: 'Shipping', href: '/shipping' },
        { text: 'Returns', href: '/returns' }
      ]
    }
  ];

  // Social media links with tracking
  const socialLinks = [
    { platform: 'Facebook', href: 'https://facebook.com/memorable', icon: '📘' },
    { platform: 'Twitter', href: 'https://twitter.com/memorable', icon: '🐦' },
    { platform: 'Instagram', href: 'https://instagram.com/memorable', icon: '📸' },
    { platform: 'LinkedIn', href: 'https://linkedin.com/company/memorable', icon: '💼' }
  ];

  // Handle social media link clicks with analytics
  const handleSocialClick = (platform: string) => {
    if (analyticsId) {
      // Track social click event
      window.gtag?.('event', 'social_click', {
        analytics_id: analyticsId,
        platform,
        source: 'footer'
      });
    }
  };

  return (
    <footer
      className={classNames(
        'footer',
        `footer--${variant}`,
        {
          'footer--high-contrast': isHighContrastMode,
          'footer--expanded': variant === 'expanded'
        },
        className
      )}
      role="contentinfo"
      aria-label="Site footer navigation and information"
    >
      <div className="footer__container">
        {/* Logo and Company Info */}
        <div className="footer__brand">
          <Link to="/" className="footer__logo" aria-label="Memorable home">
            <img
              src="/assets/logo.svg"
              alt="Memorable"
              width="150"
              height="40"
              loading="lazy"
            />
          </Link>
          <p className="footer__tagline">
            Creating magical personalized stories for children
          </p>
        </div>

        {/* Navigation Links */}
        <nav className="footer__navigation">
          {navigationSections.map((section) => (
            <div
              key={section.title}
              className="footer__nav-section"
              role="navigation"
              aria-label={section.ariaLabel}
            >
              <h2 className="footer__nav-title">{section.title}</h2>
              <ul className="footer__nav-list">
                {section.links.map((link) => (
                  <li key={link.text} className="footer__nav-item">
                    <Link
                      to={link.href}
                      className="footer__nav-link"
                      onClick={() => {
                        analyticsId && window.gtag?.('event', 'footer_link_click', {
                          analytics_id: analyticsId,
                          link_text: link.text,
                          section: section.title
                        });
                      }}
                    >
                      {link.text}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        {/* Social Media Links */}
        {showSocial && (
          <div
            className="footer__social"
            role="navigation"
            aria-label="Social media links"
          >
            {socialLinks.map((social) => (
              <Button
                key={social.platform}
                variant="text"
                size="small"
                aria-label={`Follow us on ${social.platform}`}
                onClick={() => handleSocialClick(social.platform)}
                className="footer__social-link"
              >
                <span aria-hidden="true">{social.icon}</span>
                <span className="visually-hidden">{social.platform}</span>
              </Button>
            ))}
          </div>
        )}

        {/* Copyright and Legal */}
        <div className="footer__bottom">
          <p className="footer__copyright">
            © {currentYear} Memorable. All rights reserved.
          </p>
          <div className="footer__legal">
            <Button
              variant="text"
              size="small"
              className="footer__legal-link"
              onClick={() => window.location.href = '/accessibility'}
            >
              Accessibility
            </Button>
            <Button
              variant="text"
              size="small"
              className="footer__legal-link"
              onClick={() => window.location.href = '/sitemap'}
            >
              Sitemap
            </Button>
          </div>
        </div>
      </div>
    </footer>
  );
};

export type { FooterProps };
export default Footer;