/**
 * @fileoverview Enhanced Orders dashboard page component with comprehensive order management,
 * error handling, loading states, and accessibility features.
 * @version 1.0.0
 */

import React, { useEffect, useCallback } from 'react';
import { useDispatch } from 'react-redux';
import { useAppSelector } from '../../redux/hooks';
import DashboardLayout from '../../layouts/DashboardLayout';
import OrderHistory from '../../components/order/OrderHistory';
import {
  selectUserOrders,
  selectOrderLoadingState,
  selectOrderError,
} from '../../redux/slices/orderSlice';
import {
  fetchUserOrdersThunk,
  retryFailedOrderFetch,
} from '../../redux/slices/orderSlice';
import { analytics } from '@memorable/analytics';

// Props interface
interface OrdersPageProps {
  className?: string;
  refreshInterval?: number;
  initialFilter?: OrderFilterType;
}

/**
 * Enhanced Orders dashboard page component
 * Implements comprehensive order management with error handling and accessibility
 */
const Orders: React.FC<OrdersPageProps> = ({
  className,
  refreshInterval = 300000, // 5 minutes default refresh
  initialFilter
}) => {
  const dispatch = useDispatch();
  const orders = useAppSelector(selectUserOrders);
  const loading = useAppSelector(selectOrderLoadingState);
  const error = useAppSelector(selectOrderError);

  /**
   * Initializes and manages orders data lifecycle
   */
  useEffect(() => {
    let refreshTimer: NodeJS.Timeout;

    const initializeOrders = async () => {
      try {
        await dispatch(fetchUserOrdersThunk({ page: 1, limit: 10 })).unwrap();
        
        // Track successful order load
        analytics.track('orders_page_loaded', {
          orderCount: orders.length,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error('Failed to fetch orders:', error);
        
        // Track error
        analytics.track('orders_load_error', {
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }
    };

    // Initial load
    initializeOrders();

    // Set up refresh interval if specified
    if (refreshInterval > 0) {
      refreshTimer = setInterval(initializeOrders, refreshInterval);
    }

    // Cleanup
    return () => {
      if (refreshTimer) {
        clearInterval(refreshTimer);
      }
    };
  }, [dispatch, refreshInterval]);

  /**
   * Handles retry attempts for failed order fetches
   */
  const handleRetry = useCallback(async () => {
    try {
      await dispatch(retryFailedOrderFetch()).unwrap();
      
      // Track retry success
      analytics.track('orders_retry_success', {
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      // Track retry failure
      analytics.track('orders_retry_failure', {
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }, [dispatch]);

  return (
    <DashboardLayout
      className={className}
      initialFocusRef={undefined}
    >
      <div
        className="orders-page"
        role="main"
        aria-label="Orders Dashboard"
      >
        <header className="orders-page__header">
          <h1 className="orders-page__title">My Orders</h1>
          {error && (
            <div
              className="orders-page__error"
              role="alert"
              aria-live="polite"
            >
              <p>Error loading orders: {error.message}</p>
              <button
                onClick={handleRetry}
                className="orders-page__retry-button"
                aria-label="Retry loading orders"
              >
                Retry
              </button>
            </div>
          )}
        </header>

        <main className="orders-page__content">
          {loading.list ? (
            <div
              className="orders-page__loading"
              role="status"
              aria-label="Loading orders"
            >
              <div className="orders-page__loading-spinner" />
              <span className="sr-only">Loading your orders...</span>
            </div>
          ) : orders.length === 0 && !error ? (
            <div
              className="orders-page__empty"
              role="status"
              aria-label="No orders found"
            >
              <p>You haven't placed any orders yet.</p>
              <button
                onClick={() => window.location.href = '/book/create'}
                className="orders-page__create-button"
              >
                Create Your First Book
              </button>
            </div>
          ) : (
            <OrderHistory
              className="orders-page__history"
              pageSize={10}
              sortField="DATE_DESC"
              filterStatus={initialFilter}
            />
          )}
        </main>
      </div>
    </DashboardLayout>
  );
};

export default Orders;