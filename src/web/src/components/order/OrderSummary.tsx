import React, { useCallback, useMemo, useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { useSubscription } from 'use-subscription';
import Card from '../common/Card';
import styles from './OrderSummary.module.css';

// Version comments for external dependencies
/**
 * @external react ^18.2.0
 * @external react-redux ^8.1.0
 * @external use-subscription ^1.8.0
 */

import type { 
  Order, 
  OrderStatus,
  PaymentInfo,
  ShippingInfo,
  PrintingDetails 
} from '../../types/order.types';

interface OrderSummaryProps {
  orderId: string;
  className?: string;
  onStatusChange?: (status: OrderStatus) => void;
}

/**
 * OrderSummary Component
 * Displays comprehensive order information with real-time status updates
 * Implements WCAG 2.1 Level AA accessibility standards
 */
const OrderSummary: React.FC<OrderSummaryProps> = ({
  orderId,
  className,
  onStatusChange
}) => {
  // Local state for order status updates
  const [currentStatus, setCurrentStatus] = useState<OrderStatus>();
  
  // Fetch order data from Redux store
  const order = useSelector((state: any) => 
    state.orders.userOrders.find((order: Order) => order.id === orderId)
  );

  // Real-time order status subscription
  const statusSubscription = useMemo(
    () => ({
      getCurrentValue: () => currentStatus,
      subscribe: (callback: () => void) => {
        const eventSource = new EventSource(`/api/orders/${orderId}/status`);
        eventSource.onmessage = (event) => {
          const newStatus = JSON.parse(event.data).status;
          setCurrentStatus(newStatus);
          callback();
        };
        return () => eventSource.close();
      },
    }),
    [orderId, currentStatus]
  );

  useSubscription(statusSubscription);

  // Currency formatter with memoization
  const formatCurrency = useMemo(() => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: order?.currency || 'USD'
    });
  }, [order?.currency]);

  // Handle status updates
  const handleStatusUpdate = useCallback((newStatus: OrderStatus) => {
    setCurrentStatus(newStatus);
    onStatusChange?.(newStatus);
  }, [onStatusChange]);

  useEffect(() => {
    if (order?.status !== currentStatus) {
      handleStatusUpdate(order?.status);
    }
  }, [order?.status, currentStatus, handleStatusUpdate]);

  if (!order) {
    return (
      <Card 
        className={styles.skeletonLoader}
        aria-label="Loading order summary"
        ariaLive="polite"
      >
        <div className={styles.skeleton} />
      </Card>
    );
  }

  return (
    <Card
      className={`${styles.orderSummary} ${className || ''}`}
      variant="elevated"
      elevation="medium"
      ariaLabel={`Order summary for order ${orderId}`}
      ariaLive="polite"
    >
      {/* Order Header */}
      <header className={styles.header}>
        <h2 className={styles.orderId}>
          Order #{order.id}
        </h2>
        <span 
          className={`${styles.statusBadge} ${styles[`status-${order.status}`]}`}
          role="status"
          aria-label={`Order status: ${order.status.replace('_', ' ')}`}
        >
          {order.status.replace('_', ' ')}
        </span>
      </header>

      {/* Payment Information */}
      <section className={styles.section} aria-labelledby="payment-heading">
        <h3 id="payment-heading" className={styles.sectionTitle}>
          Payment Details
        </h3>
        <div className={styles.paymentInfo}>
          <p>Method: {order.paymentInfo.provider}</p>
          {order.paymentInfo.lastFour && (
            <p>Card ending in: {order.paymentInfo.lastFour}</p>
          )}
          <p>Status: {order.paymentInfo.status}</p>
        </div>
      </section>

      {/* Shipping Information */}
      <section className={styles.section} aria-labelledby="shipping-heading">
        <h3 id="shipping-heading" className={styles.sectionTitle}>
          Shipping Details
        </h3>
        <div className={styles.shippingInfo}>
          <p>{order.shippingInfo.recipientName}</p>
          <p>{order.shippingInfo.streetAddress}</p>
          {order.shippingInfo.unit && <p>Unit: {order.shippingInfo.unit}</p>}
          <p>
            {order.shippingInfo.city}, {order.shippingInfo.state} {order.shippingInfo.postalCode}
          </p>
          <p>Method: {order.shippingInfo.method}</p>
          {order.shippingInfo.trackingNumber && (
            <p>
              Tracking: 
              <a 
                href={`/track/${order.shippingInfo.trackingNumber}`}
                className={styles.trackingLink}
                aria-label={`Track order ${order.shippingInfo.trackingNumber}`}
              >
                {order.shippingInfo.trackingNumber}
              </a>
            </p>
          )}
        </div>
      </section>

      {/* Print Details */}
      <section className={styles.section} aria-labelledby="print-heading">
        <h3 id="print-heading" className={styles.sectionTitle}>
          Print Specifications
        </h3>
        <div className={styles.printDetails}>
          <p>Format: {order.printingDetails.format}</p>
          <p>Paper: {order.printingDetails.paperType}</p>
          <p>Cover Finish: {order.printingDetails.coverFinish}</p>
          {order.printingDetails.qualityMetrics && (
            <div className={styles.qualityMetrics}>
              <h4>Quality Metrics</h4>
              <ul>
                <li>Color Accuracy: {order.printingDetails.qualityMetrics.colorAccuracy}%</li>
                <li>Binding Strength: {order.printingDetails.qualityMetrics.bindingStrength}%</li>
                <li>Print Alignment: {order.printingDetails.qualityMetrics.printAlignment}%</li>
              </ul>
            </div>
          )}
        </div>
      </section>

      {/* Total Amount */}
      <footer className={styles.footer}>
        <div className={styles.total}>
          <span>Total Amount:</span>
          <strong>{formatCurrency.format(order.amount / 100)}</strong>
        </div>
      </footer>
    </Card>
  );
};

export default OrderSummary;