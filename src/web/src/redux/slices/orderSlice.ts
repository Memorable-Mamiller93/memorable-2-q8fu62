/**
 * @fileoverview Redux slice for managing order state in the Memorable platform frontend
 * Implements comprehensive order management with optimistic updates and granular loading states
 * @version 1.0.0
 */

import { createSlice, createAsyncThunk, createSelector } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import { v4 as uuidv4 } from 'uuid'; // v9.0.0

import { Order, OrderStatus } from '../../types/order.types';
import { OrderApiResponse } from '../../types/api.types';
import orderApi from '../../api/order.api';

// Constants for cache and retry configuration
const CACHE_DURATION = 300000; // 5 minutes in milliseconds
const RETRY_ATTEMPTS = 3;

/**
 * Interface for granular loading states
 */
interface LoadingStates {
  create: boolean;
  fetch: boolean;
  list: boolean;
  update: boolean;
  cancel: boolean;
}

/**
 * Interface for error states
 */
interface ErrorStates {
  create: string | null;
  fetch: string | null;
  list: string | null;
  update: string | null;
  cancel: string | null;
}

/**
 * Interface for pagination state
 */
interface PaginationState {
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
}

/**
 * Interface for order cache entries
 */
interface CacheEntry {
  data: Order;
  timestamp: number;
}

/**
 * Interface for the order slice state
 */
interface OrderState {
  currentOrder: Order | null;
  userOrders: Order[];
  loadingStates: LoadingStates;
  errors: ErrorStates;
  pagination: PaginationState;
  cache: Record<string, CacheEntry>;
}

/**
 * Initial state for the order slice
 */
const initialState: OrderState = {
  currentOrder: null,
  userOrders: [],
  loadingStates: {
    create: false,
    fetch: false,
    list: false,
    update: false,
    cancel: false
  },
  errors: {
    create: null,
    fetch: null,
    list: null,
    update: null,
    cancel: null
  },
  pagination: {
    page: 1,
    limit: 10,
    total: 0,
    hasMore: false
  },
  cache: {}
};

/**
 * Async thunk for creating a new order with optimistic updates
 */
export const createOrderThunk = createAsyncThunk(
  'order/create',
  async (orderData: Partial<Order>, { rejectWithValue, dispatch }) => {
    try {
      // Generate temporary ID for optimistic update
      const tempId = uuidv4();
      const optimisticOrder: Order = {
        ...orderData,
        id: tempId,
        status: 'draft',
        createdAt: new Date(),
        updatedAt: new Date()
      } as Order;

      // Dispatch optimistic update
      dispatch(orderSlice.actions.setCurrentOrder(optimisticOrder));

      // Create order with retry logic
      let attempts = 0;
      let error;

      while (attempts < RETRY_ATTEMPTS) {
        try {
          const response = await orderApi.createOrder(orderData);
          return response.data;
        } catch (err) {
          error = err;
          attempts++;
          if (attempts === RETRY_ATTEMPTS) break;
          await new Promise(resolve => setTimeout(resolve, 1000 * attempts));
        }
      }

      // Revert optimistic update on failure
      dispatch(orderSlice.actions.setCurrentOrder(null));
      return rejectWithValue(error);
    } catch (error) {
      return rejectWithValue(error);
    }
  }
);

/**
 * Async thunk for fetching order details with caching
 */
export const fetchOrderThunk = createAsyncThunk(
  'order/fetch',
  async (orderId: string, { getState, rejectWithValue }) => {
    try {
      // Check cache
      const state = getState() as { order: OrderState };
      const cachedOrder = state.order.cache[orderId];
      
      if (cachedOrder && Date.now() - cachedOrder.timestamp < CACHE_DURATION) {
        return cachedOrder.data;
      }

      const response = await orderApi.getOrder(orderId);
      return response.data;
    } catch (error) {
      return rejectWithValue(error);
    }
  }
);

/**
 * Async thunk for fetching user orders with pagination
 */
export const fetchUserOrdersThunk = createAsyncThunk(
  'order/fetchUserOrders',
  async (params: { page: number; limit: number }, { rejectWithValue }) => {
    try {
      const response = await orderApi.getUserOrders(params);
      return response;
    } catch (error) {
      return rejectWithValue(error);
    }
  }
);

/**
 * Order slice with reducers and actions
 */
const orderSlice = createSlice({
  name: 'order',
  initialState,
  reducers: {
    setCurrentOrder: (state, action: PayloadAction<Order | null>) => {
      state.currentOrder = action.payload;
    },
    clearErrors: (state) => {
      state.errors = initialState.errors;
    },
    resetState: () => initialState,
    updateOrderStatus: (state, action: PayloadAction<{ orderId: string; status: OrderStatus }>) => {
      const { orderId, status } = action.payload;
      if (state.currentOrder?.id === orderId) {
        state.currentOrder.status = status;
      }
      const orderIndex = state.userOrders.findIndex(order => order.id === orderId);
      if (orderIndex !== -1) {
        state.userOrders[orderIndex].status = status;
      }
    }
  },
  extraReducers: (builder) => {
    // Create order reducers
    builder
      .addCase(createOrderThunk.pending, (state) => {
        state.loadingStates.create = true;
        state.errors.create = null;
      })
      .addCase(createOrderThunk.fulfilled, (state, action) => {
        state.loadingStates.create = false;
        state.currentOrder = action.payload;
        state.userOrders.unshift(action.payload);
      })
      .addCase(createOrderThunk.rejected, (state, action) => {
        state.loadingStates.create = false;
        state.errors.create = action.payload as string;
      })

    // Fetch order reducers
    builder
      .addCase(fetchOrderThunk.pending, (state) => {
        state.loadingStates.fetch = true;
        state.errors.fetch = null;
      })
      .addCase(fetchOrderThunk.fulfilled, (state, action) => {
        state.loadingStates.fetch = false;
        state.currentOrder = action.payload;
        state.cache[action.payload.id] = {
          data: action.payload,
          timestamp: Date.now()
        };
      })
      .addCase(fetchOrderThunk.rejected, (state, action) => {
        state.loadingStates.fetch = false;
        state.errors.fetch = action.payload as string;
      })

    // Fetch user orders reducers
    builder
      .addCase(fetchUserOrdersThunk.pending, (state) => {
        state.loadingStates.list = true;
        state.errors.list = null;
      })
      .addCase(fetchUserOrdersThunk.fulfilled, (state, action: PayloadAction<OrderApiResponse>) => {
        state.loadingStates.list = false;
        state.userOrders = action.payload.data;
        state.pagination = {
          page: action.payload.meta.page,
          limit: action.payload.meta.limit,
          total: action.payload.meta.total,
          hasMore: action.payload.meta.hasMore
        };
      })
      .addCase(fetchUserOrdersThunk.rejected, (state, action) => {
        state.loadingStates.list = false;
        state.errors.list = action.payload as string;
      });
  }
});

// Selectors
export const selectCurrentOrder = (state: { order: OrderState }) => state.order.currentOrder;
export const selectUserOrders = (state: { order: OrderState }) => state.order.userOrders;
export const selectOrderLoadingStates = (state: { order: OrderState }) => state.order.loadingStates;
export const selectOrderErrors = (state: { order: OrderState }) => state.order.errors;
export const selectOrderPagination = (state: { order: OrderState }) => state.order.pagination;

// Memoized selectors
export const selectOrderById = createSelector(
  [selectUserOrders, (_, orderId: string) => orderId],
  (orders, orderId) => orders.find(order => order.id === orderId)
);

export const selectOrdersByStatus = createSelector(
  [selectUserOrders, (_, status: OrderStatus) => status],
  (orders, status) => orders.filter(order => order.status === status)
);

// Export actions and reducer
export const { setCurrentOrder, clearErrors, resetState, updateOrderStatus } = orderSlice.actions;
export default orderSlice.reducer;