/**
 * @fileoverview Order confirmation page component with enhanced accessibility and performance
 * Displays order details, shipping information, and next steps after successful book purchase
 * @version 1.0.0
 */

import React, { useEffect } from 'react';
import { useSelector } from 'react-redux';
import { useParams, useNavigate } from 'react-router-dom';
import OrderConfirmation from '../../components/order/OrderConfirmation';
import { selectCurrentOrder } from '../../redux/slices/orderSlice';
import type { Order } from '../../types/order.types';

/**
 * Enhanced order confirmation page with accessibility and performance optimizations
 */
const ConfirmationPage: React.FC = React.memo(() => {
  // Hooks
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const order = useSelector(selectCurrentOrder);

  // Track page view and initialize analytics
  useEffect(() => {
    if (orderId) {
      // Track page view with enhanced analytics
      window.analytics?.track('Order Confirmation Page Viewed', {
        orderId,
        timestamp: new Date().toISOString(),
        path: window.location.pathname
      });

      // Set page metadata for SEO and accessibility
      document.title = `Order Confirmation #${orderId} - Memorable`;
      
      // Add structured data for rich search results
      const structuredData = {
        '@context': 'https://schema.org',
        '@type': 'OrderConfirmation',
        'orderNumber': orderId,
        'orderStatus': order?.status
      };
      
      const script = document.createElement('script');
      script.type = 'application/ld+json';
      script.text = JSON.stringify(structuredData);
      document.head.appendChild(script);

      return () => {
        document.head.removeChild(script);
      };
    }
  }, [orderId, order?.status]);

  // Handle invalid order scenarios
  if (!orderId) {
    return (
      <div 
        className="error-container"
        role="alert"
        aria-live="polite"
      >
        <h1>Invalid Order</h1>
        <p>No order ID was provided. Please check your URL and try again.</p>
        <button
          onClick={() => navigate('/dashboard/orders')}
          className="primary-button"
          aria-label="Return to order history"
        >
          View Order History
        </button>
      </div>
    );
  }

  // Handle loading state with skeleton UI
  if (!order) {
    return (
      <div 
        className="confirmation-page loading"
        role="status"
        aria-busy="true"
        aria-label="Loading order details"
      >
        <div className="loading-skeleton">
          <div className="shimmer h-8 w-3/4 mb-4" />
          <div className="shimmer h-4 w-1/2 mb-2" />
          <div className="shimmer h-4 w-2/3 mb-4" />
          <div className="shimmer h-16 w-full mb-4" />
          <div className="shimmer h-24 w-full mb-4" />
        </div>
      </div>
    );
  }

  return (
    <main 
      className="confirmation-page"
      role="main"
      aria-labelledby="confirmation-title"
    >
      <div className="confirmation-content">
        <h1 
          id="confirmation-title"
          className="visually-hidden"
        >
          Order Confirmation
        </h1>

        <OrderConfirmation
          orderId={orderId}
          showAnimation={true}
        />

        {/* Keyboard navigation region */}
        <nav 
          className="navigation-controls"
          role="navigation"
          aria-label="Post-order navigation"
        >
          <button
            onClick={() => navigate('/dashboard/orders')}
            className="secondary-button"
            aria-label="View all orders"
          >
            View Order History
          </button>
          <button
            onClick={() => navigate('/book/create')}
            className="primary-button"
            aria-label="Create another book"
          >
            Create Another Book
          </button>
        </nav>

        {/* Support information */}
        <aside 
          className="support-info"
          role="complementary"
          aria-label="Customer support information"
        >
          <p>
            Need help with your order? Contact our support team at{' '}
            <a 
              href="mailto:support@memorable.com"
              className="support-link"
              aria-label="Email customer support"
            >
              support@memorable.com
            </a>
          </p>
        </aside>
      </div>
    </main>
  );
});

// Display name for debugging
ConfirmationPage.displayName = 'ConfirmationPage';

export default ConfirmationPage;