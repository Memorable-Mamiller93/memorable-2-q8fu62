import React, { useCallback, useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate, useLocation } from 'react-router-dom';
import { analytics } from '@segment/analytics-next'; // ^1.51.0
import { ErrorBoundary } from 'react-error-boundary'; // ^4.0.0

import OrderSummary from '../../components/order/OrderSummary';
import Card from '../../components/common/Card';
import { Order, OrderStatus } from '../../types/order.types';
import styles from './Review.module.css';

/**
 * Props interface for the Review page component
 */
interface ReviewPageProps {
  className?: string;
  onConfirm?: () => Promise<void>;
  onEdit?: () => void;
}

/**
 * Error fallback component for error boundary
 */
const ErrorFallback: React.FC<{ error: Error; resetErrorBoundary: () => void }> = ({
  error,
  resetErrorBoundary
}) => (
  <Card
    className={styles.errorCard}
    variant="outlined"
    ariaLabel="Error occurred during order review"
    ariaLive="assertive"
  >
    <h2>Something went wrong</h2>
    <p>{error.message}</p>
    <button 
      onClick={resetErrorBoundary}
      className={styles.retryButton}
      aria-label="Retry loading order review"
    >
      Try again
    </button>
  </Card>
);

/**
 * ReviewPage Component
 * Provides a comprehensive order review experience with accessibility and error handling
 */
const ReviewPage: React.FC<ReviewPageProps> = ({
  className,
  onConfirm,
  onEdit
}) => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const [isConfirming, setIsConfirming] = useState(false);

  // Get current order from Redux store
  const currentOrder = useSelector((state: any) => state.orders.currentOrder);

  useEffect(() => {
    // Track page view
    analytics.page('Order Review', {
      orderId: currentOrder?.id,
      orderStatus: currentOrder?.status
    });

    // Validate order data
    if (!currentOrder) {
      navigate('/orders/create', { replace: true });
    }
  }, [currentOrder, navigate]);

  /**
   * Handles order confirmation with validation and analytics
   */
  const handleConfirmOrder = useCallback(async () => {
    if (!currentOrder) return;

    try {
      setIsConfirming(true);

      // Track confirmation attempt
      analytics.track('Order Confirmation Started', {
        orderId: currentOrder.id,
        amount: currentOrder.amount,
        currency: currentOrder.currency
      });

      // Call confirmation callback if provided
      if (onConfirm) {
        await onConfirm();
      }

      // Track successful confirmation
      analytics.track('Order Confirmed', {
        orderId: currentOrder.id,
        amount: currentOrder.amount,
        currency: currentOrder.currency
      });

      // Navigate to confirmation page
      navigate(`/orders/${currentOrder.id}/confirmation`);
    } catch (error) {
      console.error('Order confirmation failed:', error);
      throw new Error('Failed to confirm order. Please try again.');
    } finally {
      setIsConfirming(false);
    }
  }, [currentOrder, onConfirm, navigate]);

  /**
   * Handles navigation back to order editing
   */
  const handleEditOrder = useCallback(() => {
    if (!currentOrder) return;

    // Track edit action
    analytics.track('Order Edit Started', {
      orderId: currentOrder.id,
      currentStatus: currentOrder.status
    });

    if (onEdit) {
      onEdit();
    } else {
      navigate(`/orders/${currentOrder.id}/edit`);
    }
  }, [currentOrder, onEdit, navigate]);

  if (!currentOrder) {
    return (
      <Card
        className={styles.loadingCard}
        ariaLabel="Loading order review"
        ariaLive="polite"
      >
        <div className={`${styles.skeleton} shimmer`} />
      </Card>
    );
  }

  return (
    <ErrorBoundary
      FallbackComponent={ErrorFallback}
      onReset={() => navigate(0)}
    >
      <main 
        className={`${styles.reviewPage} ${className || ''}`}
        role="main"
        aria-label="Order Review Page"
      >
        <header className={styles.header}>
          <h1>Review Your Order</h1>
          <p className={styles.subtitle}>
            Please review your order details before confirming
          </p>
        </header>

        <OrderSummary
          orderId={currentOrder.id}
          className={styles.summary}
          onStatusChange={(status: OrderStatus) => {
            // Handle status changes if needed
          }}
        />

        <footer className={styles.actions}>
          <button
            onClick={handleEditOrder}
            className={styles.editButton}
            aria-label="Edit order details"
            disabled={isConfirming}
          >
            Edit Order
          </button>
          <button
            onClick={handleConfirmOrder}
            className={styles.confirmButton}
            aria-label="Confirm and place order"
            disabled={isConfirming}
          >
            {isConfirming ? 'Confirming...' : 'Confirm Order'}
          </button>
        </footer>
      </main>
    </ErrorBoundary>
  );
};

export default ReviewPage;