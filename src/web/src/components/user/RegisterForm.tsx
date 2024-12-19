import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useFormik } from 'formik';
import * as Yup from 'yup'; // v1.2.0
import debounce from 'lodash/debounce'; // v4.17.21
import {
  TextField,
  Button,
  Box,
  Typography,
  CircularProgress,
  Alert,
  Link,
  InputAdornment,
  IconButton,
  FormHelperText,
  useTheme,
  useMediaQuery
} from '@mui/material'; // v5.14.0
import {
  Visibility,
  VisibilityOff,
  Info as InfoIcon
} from '@mui/icons-material'; // v5.14.0

import { RegisterData } from '../../types/user.types';
import { useAuth } from '../../hooks/useAuth';
import { generateDeviceFingerprint } from '../../utils/auth.utils';

// Constants for validation and security
const PASSWORD_MIN_LENGTH = 12;
const PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/;
const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const NAME_MAX_LENGTH = 50;
const DEBOUNCE_DELAY = 300;

// Interface for component props
interface RegisterFormProps {
  onSuccess?: (response: any) => void;
  redirectPath?: string;
  theme?: any;
  analyticsEnabled?: boolean;
}

// Validation schema using Yup
const validationSchema = Yup.object().shape({
  email: Yup.string()
    .required('Email is required')
    .matches(EMAIL_PATTERN, 'Invalid email format')
    .max(255, 'Email is too long'),
  password: Yup.string()
    .required('Password is required')
    .min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters`)
    .matches(PASSWORD_PATTERN, 'Password must include uppercase, lowercase, number and special character'),
  firstName: Yup.string()
    .required('First name is required')
    .max(NAME_MAX_LENGTH, 'First name is too long')
    .matches(/^[a-zA-Z\s-']+$/, 'Invalid characters in first name'),
  lastName: Yup.string()
    .required('Last name is required')
    .max(NAME_MAX_LENGTH, 'Last name is too long')
    .matches(/^[a-zA-Z\s-']+$/, 'Invalid characters in last name')
});

const RegisterForm: React.FC<RegisterFormProps> = ({
  onSuccess,
  redirectPath = '/dashboard',
  analyticsEnabled = false
}) => {
  const { register, loading, error } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  // State management
  const [showPassword, setShowPassword] = useState(false);
  const [deviceFingerprint, setDeviceFingerprint] = useState<string>('');
  const formRef = useRef<HTMLFormElement>(null);

  // Initialize device fingerprint on mount
  useEffect(() => {
    const initDeviceFingerprint = async () => {
      const fingerprint = await generateDeviceFingerprint();
      setDeviceFingerprint(fingerprint);
    };
    initDeviceFingerprint();
  }, []);

  // Formik initialization with validation
  const formik = useFormik({
    initialValues: {
      email: '',
      password: '',
      firstName: '',
      lastName: ''
    },
    validationSchema,
    validateOnChange: true,
    validateOnBlur: true,
    onSubmit: async (values) => {
      try {
        const registerData: RegisterData = {
          ...values,
          deviceFingerprint
        };

        const response = await register(registerData);

        // Track successful registration if analytics enabled
        if (analyticsEnabled) {
          window.dispatchEvent(new CustomEvent('registration', {
            detail: { success: true }
          }));
        }

        if (onSuccess) {
          onSuccess(response);
        }

        navigate(redirectPath, { replace: true });
      } catch (err) {
        // Error handling is managed by useAuth hook
        if (analyticsEnabled) {
          window.dispatchEvent(new CustomEvent('registration', {
            detail: { success: false, error: err.message }
          }));
        }
      }
    }
  });

  // Debounced email validation
  const validateEmailDebounced = useCallback(
    debounce(async (email: string) => {
      try {
        const response = await fetch(`/api/v1/auth/validate-email?email=${encodeURIComponent(email)}`);
        const data = await response.json();
        if (!data.available) {
          formik.setFieldError('email', 'Email is already registered');
        }
      } catch (err) {
        console.error('Email validation failed:', err);
      }
    }, DEBOUNCE_DELAY),
    []
  );

  // Validate email on change
  useEffect(() => {
    if (formik.values.email && !formik.errors.email) {
      validateEmailDebounced(formik.values.email);
    }
    return () => {
      validateEmailDebounced.cancel();
    };
  }, [formik.values.email, validateEmailDebounced]);

  return (
    <Box
      component="form"
      ref={formRef}
      onSubmit={formik.handleSubmit}
      noValidate
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 3,
        width: '100%',
        maxWidth: 400,
        margin: '0 auto',
        p: isMobile ? 2 : 4
      }}
      aria-label="Registration form"
    >
      <Typography
        component="h1"
        variant="h4"
        align="center"
        gutterBottom
        sx={{ mb: 4 }}
      >
        Create Account
      </Typography>

      {error && (
        <Alert 
          severity="error" 
          sx={{ mb: 2 }}
          aria-live="polite"
        >
          {error}
        </Alert>
      )}

      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        <TextField
          id="firstName"
          name="firstName"
          label="First Name"
          value={formik.values.firstName}
          onChange={formik.handleChange}
          onBlur={formik.handleBlur}
          error={formik.touched.firstName && Boolean(formik.errors.firstName)}
          helperText={formik.touched.firstName && formik.errors.firstName}
          fullWidth={isMobile}
          required
          inputProps={{
            'aria-label': 'First name',
            maxLength: NAME_MAX_LENGTH
          }}
        />

        <TextField
          id="lastName"
          name="lastName"
          label="Last Name"
          value={formik.values.lastName}
          onChange={formik.handleChange}
          onBlur={formik.handleBlur}
          error={formik.touched.lastName && Boolean(formik.errors.lastName)}
          helperText={formik.touched.lastName && formik.errors.lastName}
          fullWidth={isMobile}
          required
          inputProps={{
            'aria-label': 'Last name',
            maxLength: NAME_MAX_LENGTH
          }}
        />
      </Box>

      <TextField
        id="email"
        name="email"
        label="Email"
        type="email"
        value={formik.values.email}
        onChange={formik.handleChange}
        onBlur={formik.handleBlur}
        error={formik.touched.email && Boolean(formik.errors.email)}
        helperText={formik.touched.email && formik.errors.email}
        fullWidth
        required
        InputProps={{
          'aria-label': 'Email address'
        }}
      />

      <TextField
        id="password"
        name="password"
        label="Password"
        type={showPassword ? 'text' : 'password'}
        value={formik.values.password}
        onChange={formik.handleChange}
        onBlur={formik.handleBlur}
        error={formik.touched.password && Boolean(formik.errors.password)}
        helperText={formik.touched.password && formik.errors.password}
        fullWidth
        required
        InputProps={{
          'aria-label': 'Password',
          endAdornment: (
            <InputAdornment position="end">
              <IconButton
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                onClick={() => setShowPassword(!showPassword)}
                edge="end"
              >
                {showPassword ? <VisibilityOff /> : <Visibility />}
              </IconButton>
            </InputAdornment>
          )
        }}
      />

      <FormHelperText>
        <InfoIcon sx={{ fontSize: 16, mr: 0.5, verticalAlign: 'middle' }} />
        Password must be at least {PASSWORD_MIN_LENGTH} characters and include uppercase, 
        lowercase, number and special character
      </FormHelperText>

      <Button
        type="submit"
        variant="contained"
        color="primary"
        size="large"
        fullWidth
        disabled={loading || !formik.isValid}
        sx={{ mt: 2 }}
      >
        {loading ? (
          <CircularProgress size={24} color="inherit" />
        ) : (
          'Create Account'
        )}
      </Button>

      <Typography variant="body2" align="center" sx={{ mt: 2 }}>
        Already have an account?{' '}
        <Link href="/login" underline="hover">
          Sign in
        </Link>
      </Typography>
    </Box>
  );
};

export default RegisterForm;