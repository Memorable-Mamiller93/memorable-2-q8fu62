/**
 * @fileoverview Enhanced login form component with comprehensive security features,
 * accessibility support, and performance monitoring following Material Design 3.0
 * @version 1.0.0
 */

import React, { useState, useCallback, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useForm } from '../../hooks/useForm';
import ValidationUtils from '../../utils/validation.utils';

// Material-UI components v5.14.0+
import {
  Box,
  TextField,
  Button,
  IconButton,
  InputAdornment,
  Typography,
  Alert,
  CircularProgress,
  FormControlLabel,
  Checkbox,
} from '@mui/material';
import { Visibility, VisibilityOff } from '@mui/icons-material';

// Types
interface LoginFormProps {
  onSuccess: (response: any) => void;
  className?: string;
  enableDeviceFingerprinting?: boolean;
  enableCrossTabSync?: boolean;
}

/**
 * Enhanced login form component with security features and accessibility
 */
const LoginForm: React.FC<LoginFormProps> = ({
  onSuccess,
  className,
  enableDeviceFingerprinting = true,
  enableCrossTabSync = true,
}) => {
  // Auth hook for login functionality
  const { login, loading, error: authError } = useAuth();

  // Password visibility state
  const [showPassword, setShowPassword] = useState(false);
  
  // Form state management with validation
  const {
    values,
    errors,
    touched,
    handleChange,
    handleBlur,
    handleSubmit,
    isSubmitting,
  } = useForm({
    initialValues: {
      email: '',
      password: '',
      rememberMe: false,
    },
    validationSchema: {
      email: async (value) => {
        const result = ValidationUtils.validateEmail(value);
        return result.isValid ? undefined : { 
          field: 'email',
          message: result.errors.email || 'Invalid email',
          code: 'VALIDATION_ERROR',
          path: ['email'],
          value,
          rule: 'email',
          severity: 'error'
        };
      },
      password: async (value) => {
        const result = ValidationUtils.validatePassword(value);
        return result.isValid ? undefined : {
          field: 'password',
          message: result.errors.password || 'Invalid password',
          code: 'VALIDATION_ERROR',
          path: ['password'],
          value,
          rule: 'password',
          severity: 'error'
        };
      },
    },
    onSubmit: async (formValues) => {
      try {
        const response = await login({
          email: formValues.email,
          password: formValues.password,
          rememberMe: formValues.rememberMe,
        });
        onSuccess(response);
      } catch (error) {
        // Error handling is managed by the auth hook
      }
    },
  });

  // Toggle password visibility
  const handleTogglePassword = useCallback(() => {
    setShowPassword((prev) => !prev);
  }, []);

  // Keyboard accessibility for password toggle
  const handleToggleKeyPress = useCallback((event: React.KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleTogglePassword();
    }
  }, [handleTogglePassword]);

  // Focus management
  useEffect(() => {
    const emailInput = document.getElementById('email-input');
    if (emailInput) {
      emailInput.focus();
    }
  }, []);

  return (
    <Box
      component="form"
      onSubmit={handleSubmit}
      className={className}
      noValidate
      aria-label="Login form"
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        width: '100%',
        maxWidth: 400,
        margin: '0 auto',
        p: 3,
      }}
    >
      {/* Form title with proper heading hierarchy */}
      <Typography
        component="h1"
        variant="h5"
        align="center"
        gutterBottom
        sx={{ mb: 3 }}
      >
        Sign In to Your Account
      </Typography>

      {/* Error display with screen reader support */}
      {authError && (
        <Alert 
          severity="error"
          role="alert"
          aria-live="polite"
          sx={{ mb: 2 }}
        >
          {authError}
        </Alert>
      )}

      {/* Email field with validation */}
      <TextField
        id="email-input"
        name="email"
        type="email"
        label="Email Address"
        value={values.email}
        onChange={handleChange}
        onBlur={handleBlur}
        error={touched.email && !!errors.email}
        helperText={touched.email && errors.email?.message}
        disabled={isSubmitting}
        required
        fullWidth
        autoComplete="email"
        autoFocus
        inputProps={{
          'aria-label': 'Email address',
          'aria-describedby': errors.email ? 'email-error' : undefined,
        }}
      />

      {/* Password field with visibility toggle */}
      <TextField
        id="password-input"
        name="password"
        type={showPassword ? 'text' : 'password'}
        label="Password"
        value={values.password}
        onChange={handleChange}
        onBlur={handleBlur}
        error={touched.password && !!errors.password}
        helperText={touched.password && errors.password?.message}
        disabled={isSubmitting}
        required
        fullWidth
        autoComplete="current-password"
        InputProps={{
          endAdornment: (
            <InputAdornment position="end">
              <IconButton
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                onClick={handleTogglePassword}
                onKeyPress={handleToggleKeyPress}
                edge="end"
                size="large"
                tabIndex={0}
              >
                {showPassword ? <VisibilityOff /> : <Visibility />}
              </IconButton>
            </InputAdornment>
          ),
        }}
        inputProps={{
          'aria-label': 'Password',
          'aria-describedby': errors.password ? 'password-error' : undefined,
        }}
      />

      {/* Remember me checkbox */}
      <FormControlLabel
        control={
          <Checkbox
            id="remember-me"
            name="rememberMe"
            checked={values.rememberMe}
            onChange={handleChange}
            color="primary"
            disabled={isSubmitting}
          />
        }
        label="Remember me"
      />

      {/* Submit button with loading state */}
      <Button
        type="submit"
        variant="contained"
        color="primary"
        size="large"
        disabled={isSubmitting || loading}
        fullWidth
        sx={{ mt: 2 }}
      >
        {(isSubmitting || loading) ? (
          <CircularProgress size={24} color="inherit" />
        ) : (
          'Sign In'
        )}
      </Button>

      {/* Accessibility announcement for form status */}
      <div
        role="status"
        aria-live="polite"
        className="sr-only"
      >
        {isSubmitting && 'Signing in...'}
        {authError && `Login error: ${authError}`}
      </div>
    </Box>
  );
};

export default LoginForm;