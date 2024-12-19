/**
 * @fileoverview Enhanced dashboard page component for displaying and managing user's book collection
 * Implements Material Design 3.0 principles with comprehensive accessibility and performance optimizations
 * @version 1.0.0
 */

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Grid,
  Typography,
  Button,
  CircularProgress,
  Checkbox,
  Menu,
  MenuItem,
  Snackbar,
  Alert
} from '@mui/material';
import { useVirtualizer } from '@tanstack/react-virtual';

// Internal imports
import DashboardLayout from '../../layouts/DashboardLayout';
import BookCard from '../../components/book/BookCard';
import { useBook } from '../../hooks/useBook';
import { Book } from '../../types/book.types';
import { BOOK_ROUTES } from '../../constants/routes.constants';

// Types
type SortOption = 'date' | 'title' | 'status';
type FilterOptions = {
  status?: string[];
  theme?: string[];
  dateRange?: [Date, Date];
};

/**
 * Enhanced Books dashboard page component
 */
const Books: React.FC = () => {
  // Hooks
  const navigate = useNavigate();
  const {
    books,
    loading,
    error,
    fetchUserBooks,
    deleteBooks,
    sortBooks,
    filterBooks
  } = useBook();

  // Local state
  const [selectedBooks, setSelectedBooks] = useState<string[]>([]);
  const [sortOption, setSortOption] = useState<SortOption>('date');
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({});
  const [page, setPage] = useState(1);
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error';
  }>({ open: false, message: '', severity: 'success' });

  // Virtual scrolling setup
  const parentRef = React.useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: books.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 200,
    overscan: 5
  });

  // Memoized sorted and filtered books
  const filteredBooks = useMemo(() => {
    let result = [...books];

    // Apply filters
    if (filterOptions.status?.length) {
      result = result.filter(book => filterOptions.status!.includes(book.status.status));
    }
    if (filterOptions.theme?.length) {
      result = result.filter(book => filterOptions.theme!.includes(book.theme.name));
    }
    if (filterOptions.dateRange) {
      const [start, end] = filterOptions.dateRange;
      result = result.filter(book => {
        const date = new Date(book.createdAt);
        return date >= start && date <= end;
      });
    }

    // Apply sorting
    switch (sortOption) {
      case 'title':
        result.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case 'status':
        result.sort((a, b) => a.status.status.localeCompare(b.status.status));
        break;
      case 'date':
      default:
        result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }

    return result;
  }, [books, filterOptions, sortOption]);

  // Handlers
  const handleEditBook = useCallback((bookId: string) => {
    navigate(BOOK_ROUTES.EDIT.replace(':id', bookId));
  }, [navigate]);

  const handleBatchDelete = useCallback(async () => {
    try {
      await deleteBooks(selectedBooks);
      setSnackbar({
        open: true,
        message: 'Books deleted successfully',
        severity: 'success'
      });
      setSelectedBooks([]);
    } catch (error) {
      setSnackbar({
        open: true,
        message: 'Failed to delete books',
        severity: 'error'
      });
    }
  }, [deleteBooks, selectedBooks]);

  const handleSort = useCallback((option: SortOption) => {
    setSortOption(option);
    sortBooks(option);
  }, [sortBooks]);

  // Effects
  useEffect(() => {
    fetchUserBooks(page, 20);
  }, [fetchUserBooks, page]);

  return (
    <DashboardLayout>
      <div className="books-dashboard">
        {/* Header Section */}
        <Grid container spacing={3} alignItems="center" className="books-dashboard__header">
          <Grid item xs>
            <Typography variant="h4" component="h1">
              My Books
            </Typography>
          </Grid>
          <Grid item>
            <Button
              variant="contained"
              color="primary"
              onClick={() => navigate(BOOK_ROUTES.CREATE)}
              aria-label="Create new book"
            >
              Create New Book
            </Button>
          </Grid>
        </Grid>

        {/* Controls Section */}
        <Grid container spacing={2} className="books-dashboard__controls">
          {selectedBooks.length > 0 && (
            <Grid item>
              <Button
                variant="outlined"
                color="error"
                onClick={handleBatchDelete}
                aria-label={`Delete ${selectedBooks.length} selected books`}
              >
                Delete Selected ({selectedBooks.length})
              </Button>
            </Grid>
          )}
          
          {/* Sort and Filter Controls */}
          <Grid item>
            <Menu
              id="sort-menu"
              anchorEl={null}
              keepMounted
              open={false}
              onClose={() => {}}
            >
              <MenuItem onClick={() => handleSort('date')}>Date Created</MenuItem>
              <MenuItem onClick={() => handleSort('title')}>Title</MenuItem>
              <MenuItem onClick={() => handleSort('status')}>Status</MenuItem>
            </Menu>
          </Grid>
        </Grid>

        {/* Books Grid with Virtual Scrolling */}
        <div
          ref={parentRef}
          className="books-dashboard__grid"
          style={{ height: '70vh', overflow: 'auto' }}
        >
          {loading.fetch ? (
            <CircularProgress />
          ) : error ? (
            <Alert severity="error">{error.fetch?.message || 'Failed to load books'}</Alert>
          ) : filteredBooks.length === 0 ? (
            <Typography variant="h6" align="center">
              No books found. Start creating your first book!
            </Typography>
          ) : (
            <Grid container spacing={3} style={{ height: rowVirtualizer.getTotalSize() }}>
              {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                const book = filteredBooks[virtualRow.index];
                return (
                  <Grid
                    item
                    xs={12}
                    sm={6}
                    md={4}
                    key={book.id}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      transform: `translateY(${virtualRow.start}px)`
                    }}
                  >
                    <BookCard
                      book={book}
                      onEdit={() => handleEditBook(book.id)}
                      className="books-dashboard__card"
                    />
                  </Grid>
                );
              })}
            </Grid>
          )}
        </div>

        {/* Notifications */}
        <Snackbar
          open={snackbar.open}
          autoHideDuration={6000}
          onClose={() => setSnackbar({ ...snackbar, open: false })}
        >
          <Alert severity={snackbar.severity}>{snackbar.message}</Alert>
        </Snackbar>
      </div>
    </DashboardLayout>
  );
};

export default Books;