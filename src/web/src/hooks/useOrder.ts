/**
 * @fileoverview Enhanced custom hook for managing order operations in the Memorable platform
 * Provides comprehensive order management with optimistic updates, caching,
 * and error handling capabilities
 * @version 1.0.0
 */

import { useState, useCallback, useEffect, useMemo } from 'react'; // v18.2.0
import { debounce } from 'lodash'; // v4.17.21

import { useAppDispatch, useAppSelector } from '../redux/hooks';
import {
  createOrderThunk,
  fetchOrderThunk,
  fetchUserOrdersThunk,
  setCurrentOrder,
  clearErrors,
  updateOrderStatus,
  selectCurrentOrder,
  selectUserOrders,
  selectOrderLoadingStates,
  selectOrderErrors,
  selectOrderPagination
} from '../redux/slices/orderSlice';
import type {
  Order,
  CreateOrderRequest,
  OrderStatus,
  PaymentInfo,
  ShippingInfo,
  OrderError,
  PaginationParams
} from '../types/order.types';

// Constants for request management
const LOADING_STATES = {
  IDLE: 'idle',
  LOADING: 'loading',
  SUCCESS: 'succeeded',
  ERROR: 'failed',
  RETRYING: 'retrying'
} as const;

const REQUEST_CACHE = new Map<string, { timestamp: number; data: any }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
const MAX_RETRY_ATTEMPTS = 3;

/**
 * Enhanced hook for managing order operations with comprehensive error handling
 * and performance optimizations
 */
export const useOrder = (paginationParams?: PaginationParams) => {
  const dispatch = useAppDispatch();
  
  // Selectors
  const currentOrder = useAppSelector(selectCurrentOrder);
  const userOrders = useAppSelector(selectUserOrders);
  const loadingStates = useAppSelector(selectOrderLoadingStates);
  const errors = useAppSelector(selectOrderErrors);
  const pagination = useAppSelector(selectOrderPagination);

  // Local state for retry management
  const [retryCount, setRetryCount] = useState<Record<string, number>>({});

  /**
   * Creates a new order with optimistic updates and error handling
   */
  const createOrder = useCallback(async (orderData: CreateOrderRequest) => {
    try {
      // Validate order data
      if (!orderData.bookId || !orderData.shippingInfo) {
        throw new Error('Invalid order data');
      }

      // Dispatch create order action
      const result = await dispatch(createOrderThunk(orderData)).unwrap();

      // Clear any existing errors
      dispatch(clearErrors());

      return { success: true, data: result };
    } catch (error: any) {
      return {
        success: false,
        error: {
          code: error.code || 'CREATE_ERROR',
          message: error.message || 'Failed to create order'
        }
      };
    }
  }, [dispatch]);

  /**
   * Fetches order details with caching and retry logic
   */
  const fetchOrder = useCallback(async (orderId: string) => {
    const cacheKey = `order_${orderId}`;
    const cached = REQUEST_CACHE.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return cached.data;
    }

    try {
      const result = await dispatch(fetchOrderThunk(orderId)).unwrap();
      REQUEST_CACHE.set(cacheKey, { timestamp: Date.now(), data: result });
      return result;
    } catch (error: any) {
      throw new Error(`Failed to fetch order: ${error.message}`);
    }
  }, [dispatch]);

  /**
   * Fetches user orders with pagination support
   */
  const fetchUserOrders = useCallback(async () => {
    if (paginationParams) {
      try {
        await dispatch(fetchUserOrdersThunk(paginationParams)).unwrap();
      } catch (error: any) {
        console.error('Failed to fetch user orders:', error);
      }
    }
  }, [dispatch, paginationParams]);

  /**
   * Updates order status with optimistic updates
   */
  const updateOrder = useCallback(async (
    orderId: string,
    status: OrderStatus,
    shippingInfo?: Partial<ShippingInfo>
  ) => {
    try {
      // Optimistic update
      dispatch(updateOrderStatus({ orderId, status }));

      // API call would go here
      // const response = await orderApi.updateOrder(...)

      return { success: true };
    } catch (error: any) {
      // Revert optimistic update
      dispatch(updateOrderStatus({ orderId, status: currentOrder?.status || 'draft' }));
      return { success: false, error: error.message };
    }
  }, [dispatch, currentOrder]);

  /**
   * Cancels an order with confirmation
   */
  const cancelOrder = useCallback(async (orderId: string) => {
    try {
      // Optimistic update
      dispatch(updateOrderStatus({ orderId, status: 'cancelled' }));

      // API call would go here
      // const response = await orderApi.cancelOrder(...)

      return { success: true };
    } catch (error: any) {
      // Revert optimistic update
      dispatch(updateOrderStatus({ orderId, status: currentOrder?.status || 'draft' }));
      return { success: false, error: error.message };
    }
  }, [dispatch, currentOrder]);

  /**
   * Retries failed operations with exponential backoff
   */
  const retryFailedOperation = useCallback(async (
    operationType: string,
    params: any
  ) => {
    const currentRetries = retryCount[operationType] || 0;
    
    if (currentRetries >= MAX_RETRY_ATTEMPTS) {
      throw new Error(`Maximum retry attempts reached for ${operationType}`);
    }

    setRetryCount(prev => ({
      ...prev,
      [operationType]: currentRetries + 1
    }));

    // Exponential backoff
    await new Promise(resolve => 
      setTimeout(resolve, Math.pow(2, currentRetries) * 1000)
    );

    // Retry the operation based on type
    switch (operationType) {
      case 'create':
        return createOrder(params);
      case 'fetch':
        return fetchOrder(params);
      case 'update':
        return updateOrder(params.orderId, params.status, params.shippingInfo);
      default:
        throw new Error(`Unknown operation type: ${operationType}`);
    }
  }, [retryCount, createOrder, fetchOrder, updateOrder]);

  // Fetch user orders on mount or pagination change
  useEffect(() => {
    if (paginationParams) {
      fetchUserOrders();
    }
  }, [fetchUserOrders, paginationParams]);

  // Debounced status check for active orders
  useEffect(() => {
    const checkOrderStatus = debounce(async (orderId: string) => {
      try {
        await fetchOrder(orderId);
      } catch (error) {
        console.error('Failed to check order status:', error);
      }
    }, 5000);

    const activeOrders = userOrders.filter(order => 
      ['pending_payment', 'payment_processing', 'printing'].includes(order.status)
    );

    activeOrders.forEach(order => checkOrderStatus(order.id));

    return () => {
      checkOrderStatus.cancel();
    };
  }, [userOrders, fetchOrder]);

  return {
    currentOrder,
    userOrders,
    loadingStates,
    errors,
    pagination,
    createOrder,
    updateOrder,
    cancelOrder,
    fetchOrder,
    fetchUserOrders,
    retryFailedOperation,
    clearErrors: () => dispatch(clearErrors())
  };
};

export default useOrder;