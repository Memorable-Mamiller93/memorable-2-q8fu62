/**
 * @fileoverview Enhanced profile management page component with accessibility features
 * and Material Design 3.0 principles
 * @version 1.0.0
 */

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { debounce } from 'lodash'; // v4.17.21
import { ErrorBoundary } from 'react-error-boundary'; // v4.0.0

// Internal imports
import DashboardLayout from '../../layouts/DashboardLayout';
import ProfileForm from '../../components/user/ProfileForm';
import { useAuth } from '../../hooks/useAuth';

// Types
interface ProfileState {
  isUpdating: boolean;
  error: string | null;
  lastSaved: Date | null;
  cachedData: any;
}

/**
 * Enhanced Profile page component with accessibility and error handling
 */
const Profile: React.FC = () => {
  // Hooks
  const { user, updateProfile } = useAuth();
  
  // Local state
  const [state, setState] = useState<ProfileState>({
    isUpdating: false,
    error: null,
    lastSaved: null,
    cachedData: null
  });

  /**
   * Handles profile update with optimistic updates and error handling
   */
  const handleProfileUpdate = useCallback(async (formData: any) => {
    // Store previous state for rollback
    const previousData = state.cachedData || user;
    
    try {
      setState(prev => ({
        ...prev,
        isUpdating: true,
        error: null,
        cachedData: formData
      }));

      // Optimistic update
      const optimisticUpdate = {
        ...user,
        ...formData
      };

      // Update ARIA live region
      document.getElementById('profile-status')?.setAttribute(
        'aria-label',
        'Saving profile changes...'
      );

      // Attempt update
      await updateProfile(formData);

      setState(prev => ({
        ...prev,
        isUpdating: false,
        lastSaved: new Date(),
        error: null
      }));

      // Update success message
      document.getElementById('profile-status')?.setAttribute(
        'aria-label',
        'Profile updated successfully'
      );

    } catch (error) {
      // Rollback on error
      setState(prev => ({
        ...prev,
        isUpdating: false,
        error: 'Failed to update profile. Please try again.',
        cachedData: previousData
      }));

      // Update error message
      document.getElementById('profile-status')?.setAttribute(
        'aria-label',
        'Error updating profile'
      );

      console.error('Profile update failed:', error);
    }
  }, [user, updateProfile, state.cachedData]);

  /**
   * Debounced profile update to prevent rapid consecutive updates
   */
  const debouncedUpdate = useMemo(
    () => debounce(handleProfileUpdate, 500),
    [handleProfileUpdate]
  );

  /**
   * Error fallback component
   */
  const ErrorFallback = ({ error, resetErrorBoundary }: any) => (
    <div
      role="alert"
      className="error-container"
      aria-live="assertive"
    >
      <h2>Something went wrong:</h2>
      <pre>{error.message}</pre>
      <button
        onClick={resetErrorBoundary}
        className="error-reset-button"
      >
        Try again
      </button>
    </div>
  );

  // Cleanup debounced function
  useEffect(() => {
    return () => {
      debouncedUpdate.cancel();
    };
  }, [debouncedUpdate]);

  if (!user) {
    return null;
  }

  return (
    <ErrorBoundary
      FallbackComponent={ErrorFallback}
      onReset={() => {
        setState({
          isUpdating: false,
          error: null,
          lastSaved: null,
          cachedData: null
        });
      }}
    >
      <DashboardLayout>
        <main
          className="profile-page"
          role="main"
          aria-labelledby="profile-title"
        >
          <div className="profile-header">
            <h1 id="profile-title" className="profile-title">
              Profile Settings
            </h1>
            {state.lastSaved && (
              <p className="profile-last-saved" aria-live="polite">
                Last saved: {state.lastSaved.toLocaleString()}
              </p>
            )}
          </div>

          <div
            id="profile-status"
            className="visually-hidden"
            role="status"
            aria-live="polite"
          />

          {state.error && (
            <div
              className="profile-error"
              role="alert"
              aria-live="assertive"
            >
              {state.error}
            </div>
          )}

          <div className="profile-form-container">
            <ProfileForm
              user={state.cachedData || user}
              onSubmit={debouncedUpdate}
              loading={state.isUpdating}
              className="profile-form"
            />
          </div>

          <div className="profile-info">
            <h2>Account Information</h2>
            <dl>
              <dt>Member Since</dt>
              <dd>{new Date(user.createdAt).toLocaleDateString()}</dd>
              <dt>Account Type</dt>
              <dd>{user.role}</dd>
              <dt>Email Verified</dt>
              <dd>{user.isVerified ? 'Yes' : 'No'}</dd>
            </dl>
          </div>
        </main>
      </DashboardLayout>
    </ErrorBoundary>
  );
};

export default Profile;