/**
 * @fileoverview Entry point for the Memorable web application
 * Initializes React application with core providers, error boundaries,
 * and performance monitoring following Material Design 3.0 principles
 * @version 1.0.0
 */

import React from 'react'; // ^18.2.0
import ReactDOM from 'react-dom/client'; // ^18.2.0
import { Provider } from 'react-redux'; // ^8.1.1
import { PersistGate } from 'redux-persist/integration/react'; // ^6.0.0
import { reportWebVitals } from 'web-vitals'; // ^3.0.0

// Internal imports
import App from './App';
import { store, persistor } from './redux/store';

// Constants
const PERFORMANCE_THRESHOLD = {
  FCP: 2000, // First Contentful Paint threshold (ms)
  LCP: 2500, // Largest Contentful Paint threshold (ms)
  FID: 100,  // First Input Delay threshold (ms)
  CLS: 0.1   // Cumulative Layout Shift threshold
};

/**
 * Performance monitoring callback
 * Tracks and reports core web vitals metrics
 */
const reportMetrics = (metric: any) => {
  // Log metrics in development
  if (process.env.NODE_ENV === 'development') {
    console.log(metric);
  }

  // Send metrics to analytics in production
  if (process.env.NODE_ENV === 'production') {
    // Check against thresholds
    const isPerformant = metric.value <= (PERFORMANCE_THRESHOLD as any)[metric.name];
    
    // Report to analytics
    window.gtag?.('event', 'web_vitals', {
      metric_name: metric.name,
      metric_value: metric.value,
      metric_rating: isPerformant ? 'good' : 'poor',
      metric_id: metric.id,
      metric_delta: metric.delta
    });
  }
};

/**
 * Error boundary fallback component
 */
const ErrorFallback: React.FC<{ error: Error }> = ({ error }) => (
  <div role="alert" className="error-boundary">
    <h1>Something went wrong</h1>
    <pre>{error.message}</pre>
    <button onClick={() => window.location.reload()}>
      Reload Application
    </button>
  </div>
);

/**
 * Initialize and render the React application
 * Sets up providers, error boundaries, and performance monitoring
 */
const renderApp = () => {
  const rootElement = document.getElementById('root');
  
  if (!rootElement) {
    throw new Error('Root element not found. Ensure there is a div with id="root" in index.html');
  }

  // Create root with error boundary
  const root = ReactDOM.createRoot(rootElement);

  // Enable React concurrent features
  root.render(
    <React.StrictMode>
      <Provider store={store}>
        <PersistGate loading={null} persistor={persistor}>
          <React.Suspense
            fallback={
              <div role="progressbar" aria-label="Loading application">
                Loading...
              </div>
            }
          >
            <App />
          </React.Suspense>
        </PersistGate>
      </Provider>
    </React.StrictMode>
  );

  // Initialize performance monitoring
  reportWebVitals(reportMetrics);

  // Log application version in development
  if (process.env.NODE_ENV === 'development') {
    console.log(
      `Memorable Web v${process.env.VITE_APP_VERSION} - Development Mode`
    );
  }

  // Register service worker for production
  if (process.env.NODE_ENV === 'production' && 'serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/service-worker.js')
        .then(registration => {
          console.log('SW registered:', registration);
        })
        .catch(error => {
          console.error('SW registration failed:', error);
        });
    });
  }
};

// Initialize application
renderApp();

// Enable hot module replacement in development
if (process.env.NODE_ENV === 'development' && module.hot) {
  module.hot.accept('./App', () => {
    renderApp();
  });
}