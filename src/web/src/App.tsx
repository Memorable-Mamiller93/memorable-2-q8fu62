/**
 * @fileoverview Root application component implementing Material Design 3.0 principles
 * with comprehensive routing, state management, and accessibility features
 * @version 1.0.0
 */

import React, { useEffect, useCallback } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { ErrorBoundary } from 'react-error-boundary';

// Internal imports
import { MainLayout } from './layouts/MainLayout';
import { store, persistor } from './redux/store';
import { useAuth } from './hooks/useAuth';
import { useTheme } from './hooks/useTheme';
import { ROUTES, AUTH_ROUTES, BOOK_ROUTES, DASHBOARD_ROUTES, ORDER_ROUTES } from './constants/routes.constants';

// Lazy-loaded components for code splitting
const Home = React.lazy(() => import('./pages/Home'));
const Demo = React.lazy(() => import('./pages/Demo'));
const Login = React.lazy(() => import('./pages/auth/Login'));
const Register = React.lazy(() => import('./pages/auth/Register'));
const BookCreator = React.lazy(() => import('./pages/book/BookCreator'));
const Dashboard = React.lazy(() => import('./pages/dashboard/Dashboard'));

/**
 * Loading screen component for suspense fallback
 */
const LoadingScreen: React.FC = () => (
  <div className="loading-screen" role="progressbar" aria-label="Loading application">
    <div className="loading-screen__spinner" aria-hidden="true" />
    <span className="loading-screen__text">Loading Memorable...</span>
  </div>
);

/**
 * Error fallback component for error boundary
 */
const ErrorFallback: React.FC<{ error: Error }> = ({ error }) => (
  <div className="error-screen" role="alert">
    <h1>Something went wrong</h1>
    <pre>{error.message}</pre>
    <button onClick={() => window.location.reload()}>Reload Application</button>
  </div>
);

/**
 * Protected route wrapper component
 */
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <>{children}</> : <Navigate to={AUTH_ROUTES.LOGIN} replace />;
};

/**
 * Root application component with comprehensive setup
 */
const App: React.FC = React.memo(() => {
  const { currentTheme } = useTheme();

  /**
   * Handle global errors and logging
   */
  const handleError = useCallback((error: Error, info: { componentStack: string }) => {
    // Log error to monitoring service
    console.error('Application Error:', error, info);
  }, []);

  /**
   * Initialize performance monitoring
   */
  useEffect(() => {
    if (process.env.NODE_ENV === 'production') {
      // Initialize performance monitoring
      window.performance.mark('app-init');
    }
  }, []);

  /**
   * Handle service worker registration
   */
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/service-worker.js').catch(error => {
          console.error('SW registration failed:', error);
        });
      });
    }
  }, []);

  return (
    <ErrorBoundary FallbackComponent={ErrorFallback} onError={handleError}>
      <Provider store={store}>
        <PersistGate loading={<LoadingScreen />} persistor={persistor}>
          <ThemeProvider theme={currentTheme}>
            <CssBaseline />
            <BrowserRouter>
              <MainLayout>
                <React.Suspense fallback={<LoadingScreen />}>
                  <Routes>
                    {/* Public Routes */}
                    <Route path={ROUTES.HOME} element={<Home />} />
                    <Route path={ROUTES.DEMO} element={<Demo />} />
                    
                    {/* Auth Routes */}
                    <Route path={AUTH_ROUTES.LOGIN} element={<Login />} />
                    <Route path={AUTH_ROUTES.REGISTER} element={<Register />} />
                    
                    {/* Protected Routes */}
                    <Route path={BOOK_ROUTES.CREATE} element={
                      <ProtectedRoute>
                        <BookCreator />
                      </ProtectedRoute>
                    } />
                    
                    {/* Dashboard Routes */}
                    <Route path={DASHBOARD_ROUTES.BOOKS} element={
                      <ProtectedRoute>
                        <Dashboard />
                      </ProtectedRoute>
                    } />
                    
                    {/* Fallback Route */}
                    <Route path="*" element={<Navigate to={ROUTES.HOME} replace />} />
                  </Routes>
                </React.Suspense>
              </MainLayout>
            </BrowserRouter>
          </ThemeProvider>
        </PersistGate>
      </Provider>
    </ErrorBoundary>
  );
});

App.displayName = 'App';

export default App;