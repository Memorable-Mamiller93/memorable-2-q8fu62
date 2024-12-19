/**
 * @fileoverview Secure password reset component with comprehensive validation,
 * rate limiting, and accessibility features following WCAG guidelines
 * @version 1.0.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react'; // v18.2.0
import { useNavigate, useParams, useLocation } from 'react-router-dom'; // v6.0.0
import zxcvbn from 'zxcvbn'; // v4.4.2

import { useAuth } from '../../hooks/useAuth';
import { useAppDispatch } from '../../redux/hooks';
import { showNotification } from '../../redux/slices/uiSlice';

// Constants for security and validation
const MIN_PASSWORD_LENGTH = 12;
const MAX_ATTEMPTS = 3;
const ATTEMPT_TIMEOUT = 15 * 60 * 1000; // 15 minutes
const PASSWORD_REQUIREMENTS = {
  minLength: MIN_PASSWORD_LENGTH,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSymbols: true,
  minStrength: 3 // zxcvbn score (0-4)
};

interface PasswordValidationResult {
  isValid: boolean;
  errors: string[];
  strength: number;
  feedback: string[];
}

interface ErrorState {
  code: string | null;
  message: string | null;
}

const ResetPassword: React.FC = () => {
  // Hooks
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { token } = useParams<{ token: string }>();
  const { resetPassword, validateResetToken } = useAuth();
  const location = useLocation();

  // State management
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ErrorState>({ code: null, message: null });
  const [attempts, setAttempts] = useState(0);
  const [passwordStrength, setPasswordStrength] = useState({ score: 0, feedback: [] });
  const [isTokenValid, setIsTokenValid] = useState(false);

  // Refs for security
  const lastAttemptRef = useRef<number>(0);
  const formRef = useRef<HTMLFormElement>(null);

  // Validate token on mount
  useEffect(() => {
    const verifyToken = async () => {
      try {
        if (!token) {
          throw new Error('Reset token is missing');
        }
        const isValid = await validateResetToken(token);
        setIsTokenValid(isValid);
        
        if (!isValid) {
          dispatch(showNotification({
            type: 'error',
            message: 'Invalid or expired reset token',
            duration: 5000
          }));
          navigate('/auth/forgot-password');
        }
      } catch (error) {
        console.error('Token validation error:', error);
        setIsTokenValid(false);
        navigate('/auth/forgot-password');
      }
    };

    verifyToken();
  }, [token, validateResetToken, navigate, dispatch]);

  // Password validation
  const validatePassword = useCallback((password: string): PasswordValidationResult => {
    const errors: string[] = [];
    const feedback: string[] = [];

    // Length check
    if (password.length < PASSWORD_REQUIREMENTS.minLength) {
      errors.push(`Password must be at least ${PASSWORD_REQUIREMENTS.minLength} characters long`);
    }

    // Character type checks
    if (PASSWORD_REQUIREMENTS.requireUppercase && !/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }
    if (PASSWORD_REQUIREMENTS.requireLowercase && !/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }
    if (PASSWORD_REQUIREMENTS.requireNumbers && !/\d/.test(password)) {
      errors.push('Password must contain at least one number');
    }
    if (PASSWORD_REQUIREMENTS.requireSymbols && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }

    // zxcvbn strength check
    const result = zxcvbn(password);
    if (result.score < PASSWORD_REQUIREMENTS.minStrength) {
      errors.push('Password is too weak');
      feedback.push(...(result.feedback.suggestions || []));
    }

    return {
      isValid: errors.length === 0,
      errors,
      strength: result.score,
      feedback
    };
  }, []);

  // Handle password change
  const handlePasswordChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newPassword = event.target.value;
    setPassword(newPassword);
    
    const validation = validatePassword(newPassword);
    setPasswordStrength({
      score: validation.strength,
      feedback: validation.feedback
    });
  };

  // Handle form submission
  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    // Rate limiting check
    const now = Date.now();
    if (attempts >= MAX_ATTEMPTS && now - lastAttemptRef.current < ATTEMPT_TIMEOUT) {
      setError({
        code: 'TOO_MANY_ATTEMPTS',
        message: 'Too many attempts. Please try again later.'
      });
      return;
    }

    // Validation checks
    if (!isTokenValid || !token) {
      setError({ code: 'INVALID_TOKEN', message: 'Invalid reset token' });
      return;
    }

    const validation = validatePassword(password);
    if (!validation.isValid) {
      setError({
        code: 'INVALID_PASSWORD',
        message: validation.errors[0]
      });
      return;
    }

    if (password !== confirmPassword) {
      setError({
        code: 'PASSWORD_MISMATCH',
        message: 'Passwords do not match'
      });
      return;
    }

    try {
      setLoading(true);
      setError({ code: null, message: null });
      
      await resetPassword({ token, newPassword: password });
      
      dispatch(showNotification({
        type: 'success',
        message: 'Password has been reset successfully',
        duration: 5000
      }));

      // Clear sensitive form data
      setPassword('');
      setConfirmPassword('');
      if (formRef.current) {
        formRef.current.reset();
      }

      // Redirect to login
      navigate('/auth/login', {
        state: { message: 'Password reset successful. Please log in with your new password.' }
      });
    } catch (error: any) {
      setAttempts(prev => prev + 1);
      lastAttemptRef.current = Date.now();
      
      setError({
        code: error.code || 'RESET_ERROR',
        message: error.message || 'Failed to reset password'
      });
    } finally {
      setLoading(false);
    }
  };

  // Render password strength indicator
  const renderStrengthIndicator = () => {
    const strengthLabels = ['Very Weak', 'Weak', 'Fair', 'Strong', 'Very Strong'];
    const strengthColors = ['#ff4444', '#ffbb33', '#ffeb3b', '#00C851', '#007E33'];

    return (
      <div className="password-strength" role="status" aria-live="polite">
        <div className="strength-bar">
          {[...Array(5)].map((_, index) => (
            <div
              key={index}
              className="strength-segment"
              style={{
                backgroundColor: index <= passwordStrength.score ? strengthColors[index] : '#e0e0e0'
              }}
            />
          ))}
        </div>
        <span className="strength-label">
          {passwordStrength.score > 0 ? strengthLabels[passwordStrength.score] : 'No Password'}
        </span>
      </div>
    );
  };

  return (
    <div className="reset-password-container" role="main">
      <h1>Reset Password</h1>
      
      <form ref={formRef} onSubmit={handleSubmit} className="reset-password-form">
        <div className="form-group">
          <label htmlFor="password">
            New Password
            <span className="required" aria-hidden="true">*</span>
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={handlePasswordChange}
            aria-required="true"
            aria-invalid={error?.code === 'INVALID_PASSWORD'}
            aria-describedby="password-requirements password-strength"
            disabled={loading || !isTokenValid}
            autoComplete="new-password"
          />
          {renderStrengthIndicator()}
        </div>

        <div className="form-group">
          <label htmlFor="confirmPassword">
            Confirm Password
            <span className="required" aria-hidden="true">*</span>
          </label>
          <input
            id="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            aria-required="true"
            aria-invalid={error?.code === 'PASSWORD_MISMATCH'}
            disabled={loading || !isTokenValid}
            autoComplete="new-password"
          />
        </div>

        {error?.message && (
          <div className="error-message" role="alert">
            {error.message}
          </div>
        )}

        <div id="password-requirements" className="requirements">
          <h2>Password Requirements:</h2>
          <ul>
            <li>At least {MIN_PASSWORD_LENGTH} characters long</li>
            <li>Contains uppercase and lowercase letters</li>
            <li>Contains numbers and special characters</li>
            <li>Must be strong enough to protect your account</li>
          </ul>
        </div>

        <button
          type="submit"
          disabled={loading || !isTokenValid || !password || !confirmPassword}
          aria-busy={loading}
        >
          {loading ? 'Resetting Password...' : 'Reset Password'}
        </button>
      </form>
    </div>
  );
};

export default ResetPassword;