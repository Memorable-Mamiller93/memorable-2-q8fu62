/**
 * @fileoverview Registration page component with comprehensive security and validation
 * Implements Material Design 3.0 principles with enhanced accessibility
 * @version 1.0.0
 */

import React, { useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSnackbar } from '@mui/material';
import { useAnalytics } from '@analytics/react';

// Internal imports
import RegisterForm from '../../components/user/RegisterForm';
import AuthLayout from '../../layouts/AuthLayout';
import { useAuth } from '../../hooks/useAuth';
import { ValidationUtils } from '../../utils/validation.utils';
import type { AuthResponse } from '../../types/user.types';

/**
 * Registration page component with enhanced security and validation
 */
const Register: React.FC = () => {
  const navigate = useNavigate();
  const { register, loading, error, clearError } = useAuth();
  const { enqueueSnackbar } = useSnackbar();
  const analytics = useAnalytics();

  // Clear any existing errors on mount
  useEffect(() => {
    clearError();
    return () => clearError();
  }, [clearError]);

  /**
   * Handles successful registration with analytics tracking
   */
  const handleRegistrationSuccess = useCallback(async (response: AuthResponse) => {
    try {
      // Track successful registration
      analytics.track('user_registered', {
        userId: response.user.id,
        timestamp: new Date().toISOString(),
        source: 'web'
      });

      // Show success message
      enqueueSnackbar('Registration successful! Welcome to Memorable.', {
        variant: 'success',
        autoHideDuration: 5000
      });

      // Navigate to dashboard
      navigate('/dashboard', { replace: true });
    } catch (error) {
      console.error('Error handling registration success:', error);
    }
  }, [navigate, analytics, enqueueSnackbar]);

  /**
   * Handles registration errors with user feedback
   */
  const handleRegistrationError = useCallback((error: Error) => {
    // Log error for monitoring
    console.error('Registration error:', {
      message: error.message,
      timestamp: new Date().toISOString()
    });

    // Track failed registration attempt
    analytics.track('registration_error', {
      error: error.message,
      timestamp: new Date().toISOString()
    });

    // Show error message to user
    enqueueSnackbar(
      ValidationUtils.isCommonPassword(error.message)
        ? 'Please choose a stronger password'
        : 'Registration failed. Please try again.',
      {
        variant: 'error',
        autoHideDuration: 7000
      }
    );
  }, [analytics, enqueueSnackbar]);

  return (
    <AuthLayout
      maxWidth="480px"
      showHeader={true}
      showFooter={true}
    >
      <div 
        className="register-container"
        role="main"
        aria-labelledby="register-title"
      >
        <RegisterForm
          onSuccess={handleRegistrationSuccess}
          redirectPath="/dashboard"
          analyticsEnabled={true}
        />

        {/* Error Handling */}
        {error && (
          <div 
            className="register-error"
            role="alert"
            aria-live="polite"
          >
            {error}
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div 
            className="register-loading"
            role="status"
            aria-label="Registration in progress"
          >
            Processing your registration...
          </div>
        )}
      </div>
    </AuthLayout>
  );
};

export default Register;