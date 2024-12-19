// @version 1.0.0
import { useState, useCallback, useRef, ChangeEvent, FocusEvent, FormEvent } from 'react'; // v18.2.0
import { debounce } from 'lodash'; // v4.17.21

// Internal imports
import { validateEmail, validatePassword, sanitizeInput } from '../utils/validation.utils';
import type { ValidationError } from '../types/api.types';

/**
 * Form field state tracking interface
 */
interface FormFieldState {
  value: any;
  error?: ValidationError;
  touched: boolean;
  dirty: boolean;
  isValidating: boolean;
}

/**
 * Form state interface
 */
interface FormState {
  values: Record<string, any>;
  errors: Record<string, ValidationError>;
  touched: Record<string, boolean>;
  dirty: Record<string, boolean>;
  isValid: boolean;
  isSubmitting: boolean;
}

/**
 * Field props interface for form elements
 */
interface FieldProps {
  name: string;
  value: any;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  onBlur: (e: FocusEvent<HTMLInputElement>) => void;
  'aria-invalid'?: boolean;
  'aria-describedby'?: string;
}

/**
 * Props for useForm hook initialization
 */
interface UseFormProps {
  initialValues: Record<string, any>;
  validationSchema?: Record<string, (value: any) => Promise<ValidationError | undefined>>;
  onSubmit: (values: Record<string, any>) => Promise<void> | void;
  validateOnChange?: boolean;
  validateOnBlur?: boolean;
  sanitizeInputs?: boolean;
  debounceMs?: number;
}

/**
 * Enhanced form management hook
 * Provides comprehensive form state management with validation and accessibility
 */
export const useForm = ({
  initialValues,
  validationSchema,
  onSubmit,
  validateOnChange = true,
  validateOnBlur = true,
  sanitizeInputs = true,
  debounceMs = 300
}: UseFormProps) => {
  // Form state management
  const [values, setValues] = useState<Record<string, any>>(initialValues);
  const [errors, setErrors] = useState<Record<string, ValidationError>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [dirty, setDirty] = useState<Record<string, boolean>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Validation cache for performance optimization
  const validationCache = useRef<Map<string, FormFieldState>>(new Map());

  /**
   * Validates a single field
   */
  const validateField = async (field: string, value: any): Promise<ValidationError | undefined> => {
    if (!validationSchema?.[field]) return undefined;

    try {
      return await validationSchema[field](value);
    } catch (error) {
      return {
        field,
        message: 'Validation failed',
        code: 'VALIDATION_ERROR',
        path: [field],
        value,
        rule: 'custom',
        severity: 'error'
      };
    }
  };

  /**
   * Debounced validation function
   */
  const debouncedValidate = useCallback(
    debounce(async (field: string, value: any) => {
      const error = await validateField(field, value);
      if (error) {
        setErrors(prev => ({ ...prev, [field]: error }));
      } else {
        setErrors(prev => {
          const newErrors = { ...prev };
          delete newErrors[field];
          return newErrors;
        });
      }
    }, debounceMs),
    [validationSchema]
  );

  /**
   * Enhanced change handler with sanitization and validation
   */
  const handleChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const { name, value, type } = e.target;
      let processedValue = value;

      // Input sanitization
      if (sanitizeInputs && type === 'text') {
        processedValue = sanitizeInput(value);
      }

      // Update form state
      setValues(prev => ({ ...prev, [name]: processedValue }));
      setDirty(prev => ({ ...prev, [name]: true }));

      // Validate on change if enabled
      if (validateOnChange) {
        debouncedValidate(name, processedValue);
      }
    },
    [sanitizeInputs, validateOnChange, debouncedValidate]
  );

  /**
   * Enhanced blur handler with validation
   */
  const handleBlur = useCallback(
    async (e: FocusEvent<HTMLInputElement>) => {
      const { name, value } = e.target;

      setTouched(prev => ({ ...prev, [name]: true }));

      if (validateOnBlur) {
        const error = await validateField(name, value);
        if (error) {
          setErrors(prev => ({ ...prev, [name]: error }));
        }
      }
    },
    [validateOnBlur]
  );

  /**
   * Enhanced submit handler with validation
   */
  const handleSubmit = useCallback(
    async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setIsSubmitting(true);

      try {
        // Validate all fields
        const validationPromises = Object.entries(values).map(async ([field, value]) => {
          const error = await validateField(field, value);
          return { field, error };
        });

        const validationResults = await Promise.all(validationPromises);
        const newErrors: Record<string, ValidationError> = {};

        validationResults.forEach(({ field, error }) => {
          if (error) {
            newErrors[field] = error;
          }
        });

        setErrors(newErrors);

        // Submit if no errors
        if (Object.keys(newErrors).length === 0) {
          await onSubmit(values);
        }
      } catch (error) {
        console.error('Form submission error:', error);
      } finally {
        setIsSubmitting(false);
      }
    },
    [values, onSubmit]
  );

  /**
   * Reset form to initial state
   */
  const resetForm = useCallback(() => {
    setValues(initialValues);
    setErrors({});
    setTouched({});
    setDirty({});
    setIsSubmitting(false);
    validationCache.current.clear();
  }, [initialValues]);

  /**
   * Get props for a form field
   */
  const getFieldProps = useCallback(
    (field: string): FieldProps => ({
      name: field,
      value: values[field],
      onChange: handleChange,
      onBlur: handleBlur,
      'aria-invalid': !!errors[field],
      'aria-describedby': errors[field] ? `${field}-error` : undefined
    }),
    [values, errors, handleChange, handleBlur]
  );

  /**
   * Get current form state
   */
  const getFormState = useCallback(
    (): FormState => ({
      values,
      errors,
      touched,
      dirty,
      isValid: Object.keys(errors).length === 0,
      isSubmitting
    }),
    [values, errors, touched, dirty, isSubmitting]
  );

  return {
    values,
    errors,
    touched,
    dirty,
    isValid: Object.keys(errors).length === 0,
    isSubmitting,
    handleChange,
    handleBlur,
    handleSubmit,
    resetForm,
    getFieldProps,
    getFormState
  };
};

export type UseFormReturn = ReturnType<typeof useForm>;