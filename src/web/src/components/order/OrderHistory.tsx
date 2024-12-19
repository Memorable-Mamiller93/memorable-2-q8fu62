/**
 * @fileoverview Enhanced Order History component with infinite scroll, sorting, filtering,
 * and accessibility support. Implements WCAG 2.1 Level AA compliance.
 * @version 1.0.0
 */

import React, { useCallback, useRef, useState } from 'react';
import { useInfiniteQuery } from 'react-query';
import { 
  Grid, 
  Skeleton, 
  Typography,
  useMediaQuery,
  useTheme,
  Card,
  CardContent,
  IconButton,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Box,
  Alert,
  Chip
} from '@mui/material';
import { format } from 'date-fns'; // v2.30.0
import { ErrorBoundary } from 'react-error-boundary'; // v4.0.0
import { Order, OrderStatus } from '../../types/order.types';
import { useIntersectionObserver } from '../../hooks/useIntersectionObserver';
import { useAnalytics } from '../../hooks/useAnalytics';
import styles from './OrderHistory.module.css';

// Constants
const PAGE_SIZE_OPTIONS = [10, 25, 50] as const;
const SORT_OPTIONS = {
  DATE_DESC: 'createdAt:desc',
  DATE_ASC: 'createdAt:asc',
  AMOUNT_DESC: 'amount:desc',
  AMOUNT_ASC: 'amount:asc',
} as const;

// Props interface
interface OrderHistoryProps {
  className?: string;
  pageSize?: typeof PAGE_SIZE_OPTIONS[number];
  sortField?: keyof typeof SORT_OPTIONS;
  filterStatus?: OrderStatus;
}

// Custom hook for order history data management
const useOrderHistory = (
  pageSize: number,
  sortField: string,
  filterStatus?: OrderStatus
) => {
  const { trackEvent } = useAnalytics();

  return useInfiniteQuery(
    ['orders', pageSize, sortField, filterStatus],
    async ({ pageParam = 1 }) => {
      const response = await fetch(
        `/api/v1/orders?page=${pageParam}&limit=${pageSize}&sort=${sortField}${
          filterStatus ? `&status=${filterStatus}` : ''
        }`
      );
      
      if (!response.ok) {
        throw new Error('Failed to fetch orders');
      }

      return response.json();
    },
    {
      getNextPageParam: (lastPage) => {
        return lastPage.hasMore ? lastPage.page + 1 : undefined;
      },
      keepPreviousData: true,
      staleTime: 30000, // 30 seconds
      cacheTime: 300000, // 5 minutes
      onSuccess: () => {
        trackEvent('order_history_view');
      },
    }
  );
};

// Order card component
const OrderCard: React.FC<{ order: Order }> = React.memo(({ order }) => {
  const { trackEvent } = useAnalytics();

  const handleOrderClick = useCallback(() => {
    trackEvent('order_detail_click', { orderId: order.id });
  }, [order.id, trackEvent]);

  return (
    <Card 
      className={styles.orderCard}
      onClick={handleOrderClick}
      tabIndex={0}
      role="button"
      aria-label={`Order ${order.id} from ${format(new Date(order.createdAt), 'PPP')}`}
    >
      <CardContent>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={4}>
            <Typography variant="subtitle1" component="h3">
              Order #{order.id.slice(-8)}
            </Typography>
            <Typography variant="body2" color="textSecondary">
              {format(new Date(order.createdAt), 'PPP')}
            </Typography>
          </Grid>
          <Grid item xs={12} sm={4}>
            <Chip
              label={order.status.replace('_', ' ')}
              color={getStatusColor(order.status)}
              size="small"
            />
          </Grid>
          <Grid item xs={12} sm={4}>
            <Typography variant="h6" align="right">
              ${(order.amount / 100).toFixed(2)}
            </Typography>
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );
});

OrderCard.displayName = 'OrderCard';

// Error fallback component
const ErrorFallback: React.FC<{ error: Error; resetErrorBoundary: () => void }> = ({
  error,
  resetErrorBoundary,
}) => (
  <Alert 
    severity="error" 
    action={
      <IconButton
        aria-label="retry"
        color="inherit"
        size="small"
        onClick={resetErrorBoundary}
      >
        Retry
      </IconButton>
    }
  >
    {error.message}
  </Alert>
);

// Main OrderHistory component
export const OrderHistory: React.FC<OrderHistoryProps> = ({
  className,
  pageSize = 10,
  sortField = 'DATE_DESC',
  filterStatus,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [currentSort, setCurrentSort] = useState(sortField);
  const [currentFilter, setCurrentFilter] = useState(filterStatus);
  const { trackEvent } = useAnalytics();

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    status,
    error,
  } = useOrderHistory(pageSize, SORT_OPTIONS[currentSort], currentFilter);

  // Infinite scroll implementation
  const loadMoreRef = useRef<HTMLDivElement>(null);
  useIntersectionObserver({
    target: loadMoreRef,
    onIntersect: fetchNextPage,
    enabled: hasNextPage,
  });

  const handleSortChange = (event: React.ChangeEvent<{ value: unknown }>) => {
    const newSort = event.target.value as keyof typeof SORT_OPTIONS;
    setCurrentSort(newSort);
    trackEvent('order_sort_change', { sort: newSort });
  };

  const handleFilterChange = (event: React.ChangeEvent<{ value: unknown }>) => {
    const newFilter = event.target.value as OrderStatus;
    setCurrentFilter(newFilter);
    trackEvent('order_filter_change', { filter: newFilter });
  };

  if (status === 'error') {
    return <ErrorFallback error={error as Error} resetErrorBoundary={() => {}} />;
  }

  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <section 
        className={`${styles.orderHistory} ${className}`}
        aria-label="Order History"
      >
        <Box mb={3}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} sm={4}>
              <Typography variant="h5" component="h2">
                Order History
              </Typography>
            </Grid>
            <Grid item xs={12} sm={8}>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth size="small">
                    <InputLabel id="sort-select-label">Sort By</InputLabel>
                    <Select
                      labelId="sort-select-label"
                      value={currentSort}
                      onChange={handleSortChange}
                      label="Sort By"
                    >
                      <MenuItem value="DATE_DESC">Newest First</MenuItem>
                      <MenuItem value="DATE_ASC">Oldest First</MenuItem>
                      <MenuItem value="AMOUNT_DESC">Highest Amount</MenuItem>
                      <MenuItem value="AMOUNT_ASC">Lowest Amount</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth size="small">
                    <InputLabel id="filter-select-label">Filter Status</InputLabel>
                    <Select
                      labelId="filter-select-label"
                      value={currentFilter || ''}
                      onChange={handleFilterChange}
                      label="Filter Status"
                    >
                      <MenuItem value="">All Status</MenuItem>
                      {Object.values(OrderStatus).map((status) => (
                        <MenuItem key={status} value={status}>
                          {status.replace('_', ' ')}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
              </Grid>
            </Grid>
          </Grid>
        </Box>

        <div className={styles.orderList}>
          {status === 'loading' ? (
            Array.from({ length: pageSize }).map((_, index) => (
              <Skeleton
                key={index}
                variant="rectangular"
                height={100}
                className={styles.orderCardSkeleton}
              />
            ))
          ) : data?.pages.map((page) =>
              page.orders.map((order: Order) => (
                <OrderCard key={order.id} order={order} />
              ))
            )}

          <div
            ref={loadMoreRef}
            className={styles.loadMore}
            role="progressbar"
            aria-label={isFetchingNextPage ? 'Loading more orders' : undefined}
          >
            {isFetchingNextPage && (
              <Skeleton variant="rectangular" height={100} />
            )}
          </div>
        </div>

        {!hasNextPage && data?.pages[0].orders.length === 0 && (
          <Typography
            variant="body1"
            color="textSecondary"
            align="center"
            className={styles.emptyState}
          >
            No orders found
          </Typography>
        )}
      </section>
    </ErrorBoundary>
  );
};

// Helper function for status colors
const getStatusColor = (status: OrderStatus): 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning' => {
  switch (status) {
    case 'delivered':
      return 'success';
    case 'cancelled':
    case 'refunded':
      return 'error';
    case 'shipping':
    case 'preparing_print':
      return 'info';
    case 'pending_payment':
      return 'warning';
    default:
      return 'default';
  }
};

export default OrderHistory;