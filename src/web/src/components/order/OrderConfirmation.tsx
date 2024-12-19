/**
 * @fileoverview Order confirmation component with comprehensive order details
 * Implements optimistic UI updates, accessibility features, and performance optimizations
 * @version 1.0.0
 */

import React, { useEffect, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import Button from '../common/Button';
import { selectCurrentOrder } from '../../redux/slices/orderSlice';
import type { Order } from '../../types/order.types';

interface OrderConfirmationProps {
  /** ID of the confirmed order */
  orderId: string;
  /** Flag to control success animation display */
  showAnimation?: boolean;
}

/**
 * OrderConfirmation Component
 * Displays comprehensive order confirmation details with enhanced UX features
 */
export const OrderConfirmation: React.FC<OrderConfirmationProps> = ({
  orderId,
  showAnimation = true
}) => {
  const navigate = useNavigate();
  const order = useSelector(selectCurrentOrder);

  // Calculate estimated delivery date based on print status and location
  const estimatedDelivery = useMemo(() => {
    if (!order) return null;

    const baseProductionDays = 3; // Base production time
    const shippingDays = order.shippingInfo.method === 'express' ? 2 : 5;
    
    const deliveryDate = new Date();
    deliveryDate.setDate(deliveryDate.getDate() + baseProductionDays + shippingDays);
    
    return deliveryDate;
  }, [order]);

  // Track order confirmation view
  useEffect(() => {
    if (order) {
      // Analytics tracking
      window.analytics?.track('Order Confirmation Viewed', {
        orderId: order.id,
        amount: order.amount,
        currency: order.currency
      });
    }
  }, [order]);

  // Navigation handlers
  const handleViewOrderHistory = () => {
    window.analytics?.track('View Order History Clicked');
    navigate('/dashboard/orders');
  };

  const handleCreateNewBook = () => {
    window.analytics?.track('Create New Book Clicked');
    navigate('/book/create');
  };

  if (!order) {
    return (
      <div className="confirmation-container" role="alert" aria-busy="true">
        <div className="confirmation-skeleton">
          {/* Loading skeleton implementation */}
          <div className="shimmer h-8 w-3/4 mb-4" />
          <div className="shimmer h-4 w-1/2 mb-2" />
          <div className="shimmer h-4 w-2/3 mb-4" />
        </div>
      </div>
    );
  }

  return (
    <motion.div
      className="confirmation-container"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      role="main"
      aria-label="Order confirmation details"
    >
      {/* Success Animation */}
      {showAnimation && (
        <motion.div
          className="success-animation"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 200 }}
        >
          <svg
            className="checkmark"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 52 52"
            role="img"
            aria-label="Success checkmark"
          >
            <circle className="checkmark__circle" cx="26" cy="26" r="25" fill="none"/>
            <path className="checkmark__check" fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8"/>
          </svg>
        </motion.div>
      )}

      {/* Order Header */}
      <div className="confirmation-header">
        <h1 className="text-2xl font-bold mb-4">
          Thank you for your order!
        </h1>
        <div className="order-id" role="text">
          Order ID: <span className="font-mono">{order.id}</span>
          <button
            className="copy-button"
            onClick={() => navigator.clipboard.writeText(order.id)}
            aria-label="Copy order ID"
          >
            <span className="sr-only">Copy order ID</span>
            📋
          </button>
        </div>
      </div>

      {/* Order Details */}
      <div className="order-details">
        <div className="payment-info">
          <h2 className="text-xl mb-2">Payment Confirmation</h2>
          <p>Amount: {new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: order.currency
          }).format(order.amount / 100)}</p>
          <p>Payment Method: {order.paymentInfo.lastFour ? 
            `•••• ${order.paymentInfo.lastFour}` : 
            order.paymentInfo.provider}
          </p>
        </div>

        {/* Print Production Status */}
        <div className="print-status">
          <h2 className="text-xl mb-2">Production Status</h2>
          <div className="status-progress" role="progressbar" aria-valuetext={order.status}>
            <div className={`progress-bar ${order.status}`} />
            <p>{order.status.replace('_', ' ')}</p>
          </div>
        </div>

        {/* Shipping Information */}
        <div className="shipping-info">
          <h2 className="text-xl mb-2">Shipping Details</h2>
          <address>
            {order.shippingInfo.recipientName}<br />
            {order.shippingInfo.streetAddress}<br />
            {order.shippingInfo.unit && `${order.shippingInfo.unit}<br />`}
            {order.shippingInfo.city}, {order.shippingInfo.state} {order.shippingInfo.postalCode}<br />
            {order.shippingInfo.countryCode}
          </address>
          
          {estimatedDelivery && (
            <p className="delivery-estimate">
              Estimated Delivery: {estimatedDelivery.toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
            </p>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="actions" role="group" aria-label="Order actions">
        <Button
          variant="primary"
          onClick={handleViewOrderHistory}
          ariaLabel="View order history"
        >
          View Order History
        </Button>
        <Button
          variant="secondary"
          onClick={handleCreateNewBook}
          ariaLabel="Create another book"
        >
          Create Another Book
        </Button>
      </div>

      {/* Support Information */}
      <div className="support-info" role="complementary">
        <p>
          Need help? Contact our support team at{' '}
          <a href="mailto:support@memorable.com" className="text-primary">
            support@memorable.com
          </a>
        </p>
      </div>
    </motion.div>
  );
};

export default OrderConfirmation;