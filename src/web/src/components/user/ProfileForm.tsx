/**
 * @fileoverview ProfileForm component for user profile management
 * Implements Material Design 3.0 principles with comprehensive validation and accessibility
 * @version 1.0.0
 */

import React, { useCallback, useEffect, useState } from 'react';
import { debounce } from 'lodash'; // v4.17.21

// Internal imports
import { User } from '../../types/user.types';
import { useForm } from '../../hooks/useForm';
import Input from '../common/Input';
import Button from '../common/Button';
import ValidationUtils from '../../utils/validation.utils';

/**
 * Props interface for ProfileForm component
 */
interface ProfileFormProps {
  user: User;
  onSubmit: (values: ProfileFormData) => Promise<void>;
  loading?: boolean;
  className?: string;
}

/**
 * Interface for validated form data
 */
interface ProfileFormData {
  firstName: string;
  lastName: string;
  email: string;
  preferences: {
    theme: string;
    notifications: {
      email: boolean;
      push: boolean;
      orderUpdates: boolean;
      marketing: boolean;
    };
    defaultBookSettings: {
      defaultTheme: string;
      paperQuality: string;
      coverType: string;
      fontSize: number;
    };
  };
}

/**
 * Validation schema for profile form
 */
const validationSchema = {
  firstName: async (value: string) => {
    if (!value.trim()) {
      return {
        field: 'firstName',
        message: 'First name is required',
        code: 'VALIDATION_ERROR',
        path: ['firstName'],
        value,
        rule: 'required',
        severity: 'error'
      };
    }
    if (value.length < 2 || value.length > 50) {
      return {
        field: 'firstName',
        message: 'First name must be between 2 and 50 characters',
        code: 'VALIDATION_ERROR',
        path: ['firstName'],
        value,
        rule: 'length',
        severity: 'error'
      };
    }
  },
  lastName: async (value: string) => {
    if (!value.trim()) {
      return {
        field: 'lastName',
        message: 'Last name is required',
        code: 'VALIDATION_ERROR',
        path: ['lastName'],
        value,
        rule: 'required',
        severity: 'error'
      };
    }
    if (value.length < 2 || value.length > 50) {
      return {
        field: 'lastName',
        message: 'Last name must be between 2 and 50 characters',
        code: 'VALIDATION_ERROR',
        path: ['lastName'],
        value,
        rule: 'length',
        severity: 'error'
      };
    }
  },
  email: async (value: string) => {
    const result = ValidationUtils.validateEmail(value);
    if (!result.isValid) {
      return {
        field: 'email',
        message: Object.values(result.errors)[0],
        code: 'VALIDATION_ERROR',
        path: ['email'],
        value,
        rule: 'email',
        severity: 'error'
      };
    }
  }
};

/**
 * ProfileForm Component
 * Implements comprehensive profile management with real-time validation
 */
export const ProfileForm: React.FC<ProfileFormProps> = ({
  user,
  onSubmit,
  loading = false,
  className
}) => {
  // Form state management with validation
  const {
    values,
    errors,
    touched,
    handleChange,
    handleBlur,
    handleSubmit,
    resetForm,
    getFieldProps
  } = useForm({
    initialValues: {
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      preferences: user.preferences || {
        theme: 'light',
        notifications: {
          email: true,
          push: true,
          orderUpdates: true,
          marketing: false
        },
        defaultBookSettings: {
          defaultTheme: 'magical',
          paperQuality: 'premium',
          coverType: 'hardcover',
          fontSize: 16
        }
      }
    },
    validationSchema,
    onSubmit: async (formValues) => {
      try {
        await onSubmit(formValues as ProfileFormData);
      } catch (error) {
        console.error('Profile update failed:', error);
      }
    },
    validateOnChange: true,
    validateOnBlur: true,
    sanitizeInputs: true
  });

  // Debounced form validation
  const debouncedValidation = useCallback(
    debounce(() => {
      // Trigger validation
    }, 300),
    []
  );

  // Effect for handling validation
  useEffect(() => {
    debouncedValidation();
    return () => {
      debouncedValidation.cancel();
    };
  }, [values, debouncedValidation]);

  return (
    <form
      onSubmit={handleSubmit}
      className={className}
      noValidate
      aria-label="Profile Settings"
    >
      <div className="form-group">
        <Input
          id="firstName"
          label="First Name"
          type="text"
          required
          {...getFieldProps('firstName')}
          error={touched.firstName ? errors.firstName?.message : undefined}
          autoComplete="given-name"
        />
      </div>

      <div className="form-group">
        <Input
          id="lastName"
          label="Last Name"
          type="text"
          required
          {...getFieldProps('lastName')}
          error={touched.lastName ? errors.lastName?.message : undefined}
          autoComplete="family-name"
        />
      </div>

      <div className="form-group">
        <Input
          id="email"
          label="Email Address"
          type="email"
          required
          {...getFieldProps('email')}
          error={touched.email ? errors.email?.message : undefined}
          autoComplete="email"
        />
      </div>

      <div className="form-actions">
        <Button
          type="submit"
          variant="primary"
          loading={loading}
          disabled={loading || Object.keys(errors).length > 0}
          aria-label={loading ? 'Saving changes...' : 'Save changes'}
        >
          {loading ? 'Saving...' : 'Save Changes'}
        </Button>

        <Button
          type="button"
          variant="text"
          onClick={() => resetForm()}
          disabled={loading}
          aria-label="Reset form"
        >
          Reset
        </Button>
      </div>
    </form>
  );
};

export default ProfileForm;