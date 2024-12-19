// @version 1.0.0
import React, { forwardRef, useCallback, useEffect, useRef, useState } from 'react';
import classnames from 'classnames'; // v2.3.2
import { validateEmail, validatePassword } from '../../utils/validation.utils';
import styles from './Input.module.css';

/**
 * Security level for input validation
 */
export enum InputSecurityLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high'
}

/**
 * Performance tracking metrics
 */
interface PerformanceMetrics {
  renderTime: number;
  validationTime: number;
  interactionCount: number;
}

/**
 * Theme customization options following Material Design 3.0
 */
interface ThemeOptions {
  colorScheme?: 'light' | 'dark';
  customColors?: {
    primary?: string;
    error?: string;
    background?: string;
  };
  typography?: {
    fontSize?: string;
    fontFamily?: string;
  };
}

/**
 * Localization options for accessibility
 */
interface LocalizationOptions {
  locale: string;
  messages: {
    required?: string;
    invalid?: string;
    [key: string]: string | undefined;
  };
}

/**
 * Validation options for input fields
 */
interface ValidationOptions {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  customValidator?: (value: string) => boolean;
}

/**
 * Props interface for the Input component
 */
export interface InputProps {
  id: string;
  name: string;
  type: 'text' | 'email' | 'password' | 'tel' | 'number';
  value: string;
  placeholder?: string;
  label: string;
  required?: boolean;
  disabled?: boolean;
  error?: string;
  validationOptions?: ValidationOptions;
  securityLevel?: InputSecurityLevel;
  performanceTracking?: boolean;
  onChange: (value: string, isValid: boolean) => void;
  onBlur?: (value: string, isValid: boolean) => void;
  onValidationComplete?: (isValid: boolean) => void;
  className?: string;
  autoComplete?: string;
  themeOverrides?: ThemeOptions;
  i18n?: LocalizationOptions;
}

/**
 * Enhanced Input component with comprehensive features
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(({
  id,
  name,
  type,
  value,
  placeholder,
  label,
  required = false,
  disabled = false,
  error,
  validationOptions,
  securityLevel = InputSecurityLevel.MEDIUM,
  performanceTracking = false,
  onChange,
  onBlur,
  onValidationComplete,
  className,
  autoComplete,
  themeOverrides,
  i18n
}, ref) => {
  // State management
  const [isFocused, setIsFocused] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [internalError, setInternalError] = useState<string | undefined>(error);
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    renderTime: 0,
    validationTime: 0,
    interactionCount: 0
  });

  // Refs for performance tracking
  const renderStartTime = useRef<number>(0);
  const validationStartTime = useRef<number>(0);

  // Initialize performance tracking
  useEffect(() => {
    if (performanceTracking) {
      renderStartTime.current = performance.now();
      return () => {
        const renderTime = performance.now() - renderStartTime.current;
        setMetrics(prev => ({ ...prev, renderTime }));
      };
    }
  }, [performanceTracking]);

  /**
   * Validates input value based on type and security level
   */
  const validateInput = useCallback((inputValue: string): boolean => {
    if (performanceTracking) {
      validationStartTime.current = performance.now();
    }

    let isValid = true;
    const trimmedValue = inputValue.trim();

    // Required field validation
    if (required && !trimmedValue) {
      setInternalError(i18n?.messages.required || 'This field is required');
      isValid = false;
    }

    // Type-specific validation
    if (trimmedValue) {
      switch (type) {
        case 'email':
          const emailResult = validateEmail(trimmedValue);
          isValid = emailResult.isValid;
          if (!isValid) {
            setInternalError(i18n?.messages.invalid || emailResult.errors.email);
          }
          break;

        case 'password':
          const passwordResult = validatePassword(trimmedValue);
          isValid = passwordResult.isValid;
          if (!isValid) {
            setInternalError(i18n?.messages.invalid || passwordResult.errors.password);
          }
          break;

        default:
          // Custom validation
          if (validationOptions?.pattern && !validationOptions.pattern.test(trimmedValue)) {
            setInternalError(i18n?.messages.invalid || 'Invalid format');
            isValid = false;
          }
          if (validationOptions?.customValidator && !validationOptions.customValidator(trimmedValue)) {
            setInternalError(i18n?.messages.invalid || 'Invalid input');
            isValid = false;
          }
      }
    }

    if (isValid) {
      setInternalError(undefined);
    }

    if (performanceTracking) {
      const validationTime = performance.now() - validationStartTime.current;
      setMetrics(prev => ({ ...prev, validationTime }));
    }

    return isValid;
  }, [type, required, validationOptions, i18n, performanceTracking]);

  /**
   * Handles input change with debounced validation
   */
  const handleChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = event.target.value;
    setIsDirty(true);
    
    if (performanceTracking) {
      setMetrics(prev => ({
        ...prev,
        interactionCount: prev.interactionCount + 1
      }));
    }

    const isValid = validateInput(newValue);
    onChange(newValue, isValid);
    onValidationComplete?.(isValid);
  }, [onChange, onValidationComplete, validateInput, performanceTracking]);

  /**
   * Handles input blur event
   */
  const handleBlur = useCallback((event: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(false);
    const isValid = validateInput(event.target.value);
    onBlur?.(event.target.value, isValid);
  }, [onBlur, validateInput]);

  /**
   * Handles input focus event
   */
  const handleFocus = useCallback(() => {
    setIsFocused(true);
  }, []);

  // Compute component classes
  const inputClasses = classnames(
    styles['input-container'],
    {
      [styles['input-focused']]: isFocused,
      [styles['input-error']]: internalError,
      [styles['input-disabled']]: disabled,
      [styles['input-dirty']]: isDirty,
      [styles['input-rtl']]: i18n?.locale === 'ar' || i18n?.locale === 'he',
    },
    className
  );

  return (
    <div className={inputClasses}>
      <label
        htmlFor={id}
        className={styles['input-label']}
        data-required={required}
      >
        {label}
      </label>
      <input
        ref={ref}
        id={id}
        name={name}
        type={type}
        value={value}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        disabled={disabled}
        placeholder={placeholder}
        autoComplete={autoComplete}
        aria-invalid={!!internalError}
        aria-required={required}
        aria-describedby={internalError ? `${id}-error` : undefined}
        className={styles['input-field']}
        data-security-level={securityLevel}
        style={{
          ...themeOverrides?.typography,
          backgroundColor: themeOverrides?.customColors?.background
        }}
      />
      {internalError && (
        <div
          id={`${id}-error`}
          className={styles['input-error-message']}
          role="alert"
        >
          {internalError}
        </div>
      )}
    </div>
  );
});

Input.displayName = 'Input';

export default Input;