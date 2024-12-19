/**
 * @fileoverview Enhanced login page component implementing Material Design 3.0 principles
 * with comprehensive security features, accessibility compliance, and cross-tab synchronization
 * @version 1.0.0
 */

import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AuthLayout from '../../layouts/AuthLayout';
import LoginForm from '../../components/user/LoginForm';
import { useAuth } from '../../hooks/useAuth';
import { ErrorBoundary } from 'react-error-boundary';

// Performance tracking decorator
const performanceTrack = (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
  const originalMethod = descriptor.value;
  descriptor.value = async function (...args: any[]) {
    const start = performance.now();
    try {
      const result = await originalMethod.apply(this, args);
      const duration = performance.now() - start;
      
      // Log slow operations in development
      if (process.env.NODE_ENV === 'development' && duration > 1000) {
        console.warn(`Slow operation: ${propertyKey} took ${duration.toFixed(2)}ms`);
      }
      
      return result;
    } catch (error) {
      console.error(`Error in ${propertyKey}:`, error);
      throw error;
    }
  };
  return descriptor;
};

/**
 * Props interface for the Login page component
 */
interface LoginPageProps {
  onSecurityEvent?: (event: string, details: any) => void;
  performanceConfig?: {
    slowThreshold: number;
    trackMetrics: boolean;
  };
}

/**
 * Enhanced Login page component with security features and accessibility
 */
const Login: React.FC<LoginPageProps> = ({
  onSecurityEvent,
  performanceConfig = { slowThreshold: 1000, trackMetrics: true }
}) => {
  const navigate = useNavigate();
  const { isAuthenticated, deviceFingerprint, syncSession } = useAuth();
  const [securityChecks, setSecurityChecks] = useState({
    deviceVerified: false,
    sessionValid: false
  });

  /**
   * Handles successful login with enhanced security checks
   */
  @performanceTrack
  const handleLoginSuccess = useCallback(async (response: any) => {
    try {
      // Verify device fingerprint
      const currentFingerprint = await deviceFingerprint();
      if (response.deviceFingerprint !== currentFingerprint) {
        onSecurityEvent?.('device_mismatch', {
          expected: response.deviceFingerprint,
          received: currentFingerprint
        });
        throw new Error('Device verification failed');
      }

      // Initialize cross-tab session sync
      await syncSession(response.sessionId);
      setSecurityChecks({
        deviceVerified: true,
        sessionValid: true
      });

      // Navigate to dashboard or intended route
      navigate('/dashboard');
    } catch (error) {
      console.error('Login security check failed:', error);
      throw error;
    }
  }, [navigate, deviceFingerprint, syncSession, onSecurityEvent]);

  /**
   * Handles login errors with comprehensive error tracking
   */
  const handleLoginError = useCallback((error: Error) => {
    onSecurityEvent?.('login_error', {
      message: error.message,
      timestamp: new Date().toISOString(),
      deviceInfo: {
        userAgent: navigator.userAgent,
        platform: navigator.platform
      }
    });
  }, [onSecurityEvent]);

  /**
   * Fallback component for error boundary
   */
  const ErrorFallback = ({ error, resetErrorBoundary }: any) => (
    <div role="alert" className="error-container">
      <h2>Something went wrong</h2>
      <pre>{error.message}</pre>
      <button onClick={resetErrorBoundary}>Try again</button>
    </div>
  );

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard');
    }
  }, [isAuthenticated, navigate]);

  // Set up performance monitoring
  useEffect(() => {
    if (performanceConfig.trackMetrics) {
      const observer = new PerformanceObserver((list) => {
        list.getEntries().forEach((entry) => {
          if (entry.duration > performanceConfig.slowThreshold) {
            console.warn(`Slow interaction detected: ${entry.name} took ${entry.duration}ms`);
          }
        });
      });
      
      observer.observe({ entryTypes: ['measure'] });
      return () => observer.disconnect();
    }
  }, [performanceConfig]);

  return (
    <ErrorBoundary
      FallbackComponent={ErrorFallback}
      onError={handleLoginError}
      onReset={() => setSecurityChecks({
        deviceVerified: false,
        sessionValid: false
      })}
    >
      <AuthLayout>
        <main
          className="login-page"
          role="main"
          aria-label="Login page content"
        >
          <LoginForm
            onSuccess={handleLoginSuccess}
            enableDeviceFingerprinting={true}
            enableCrossTabSync={true}
          />
          
          {/* Accessibility status announcements */}
          <div
            role="status"
            aria-live="polite"
            className="sr-only"
          >
            {securityChecks.deviceVerified && 'Device verification completed'}
            {securityChecks.sessionValid && 'Session established securely'}
          </div>
        </main>
      </AuthLayout>
    </ErrorBoundary>
  );
};

export default Login;