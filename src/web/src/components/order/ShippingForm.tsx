// @version 1.0.0
import React, { useCallback, useEffect } from 'react';
import classnames from 'classnames'; // v2.3.2
import Input from '../common/Input';
import { useForm } from '../../hooks/useForm';
import type { ShippingInfo } from '../../types/order.types';
import styles from './ShippingForm.module.css';

/**
 * Props interface for the ShippingForm component
 */
interface ShippingFormProps {
  initialValues: Partial<ShippingInfo>;
  onSubmit: (values: ShippingInfo) => void | Promise<void>;
  className?: string;
  onAddressValidated?: (isValid: boolean) => void;
}

/**
 * Validates shipping form input values with enhanced validation rules
 */
const validateShippingForm = async (values: Partial<ShippingInfo>) => {
  const errors: Record<string, string> = {};

  // Required field validation
  const requiredFields = [
    'recipientName',
    'streetAddress',
    'city',
    'state',
    'postalCode',
    'countryCode',
    'phoneNumber',
    'method'
  ];

  requiredFields.forEach(field => {
    if (!values[field as keyof ShippingInfo]) {
      errors[field] = 'This field is required';
    }
  });

  // Phone number validation (E.164 format)
  if (values.phoneNumber && !/^\+?[1-9]\d{1,14}$/.test(values.phoneNumber)) {
    errors.phoneNumber = 'Please enter a valid phone number';
  }

  // Postal code validation based on country
  if (values.postalCode && values.countryCode) {
    const postalCodePatterns: Record<string, RegExp> = {
      US: /^\d{5}(-\d{4})?$/,
      CA: /^[A-Z]\d[A-Z]\s?\d[A-Z]\d$/i,
      GB: /^[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}$/i,
      // Add more country-specific patterns as needed
    };

    const pattern = postalCodePatterns[values.countryCode];
    if (pattern && !pattern.test(values.postalCode)) {
      errors.postalCode = 'Invalid postal code format for selected country';
    }
  }

  return errors;
};

/**
 * ShippingForm component for collecting and validating shipping information
 * Implements Material Design principles and WCAG 2.1 Level AA accessibility
 */
export const ShippingForm: React.FC<ShippingFormProps> = ({
  initialValues,
  onSubmit,
  className,
  onAddressValidated
}) => {
  const {
    values,
    errors,
    touched,
    handleChange,
    handleBlur,
    handleSubmit,
    isValid
  } = useForm({
    initialValues,
    validationSchema: validateShippingForm,
    onSubmit,
    validateOnChange: true,
    validateOnBlur: true,
    sanitizeInputs: true
  });

  // Notify parent component of address validation status
  useEffect(() => {
    onAddressValidated?.(isValid);
  }, [isValid, onAddressValidated]);

  // Handle shipping method selection
  const handleMethodChange = useCallback((method: ShippingInfo['method']) => {
    handleChange({
      target: { name: 'method', value: method }
    } as React.ChangeEvent<HTMLInputElement>);
  }, [handleChange]);

  return (
    <form
      onSubmit={handleSubmit}
      className={classnames(styles['shipping-form'], className)}
      noValidate
      aria-label="Shipping Information Form"
    >
      <div className={styles['form-row']}>
        <div className={styles['form-group']}>
          <Input
            id="recipientName"
            name="recipientName"
            type="text"
            label="Recipient Name"
            value={values.recipientName || ''}
            onChange={handleChange}
            onBlur={handleBlur}
            error={touched.recipientName ? errors.recipientName : undefined}
            required
            autoComplete="shipping name"
          />
        </div>
      </div>

      <div className={styles['form-row']}>
        <div className={styles['form-group']}>
          <Input
            id="streetAddress"
            name="streetAddress"
            type="text"
            label="Street Address"
            value={values.streetAddress || ''}
            onChange={handleChange}
            onBlur={handleBlur}
            error={touched.streetAddress ? errors.streetAddress : undefined}
            required
            autoComplete="shipping street-address"
          />
        </div>
      </div>

      <div className={styles['form-row']}>
        <div className={styles['form-group']}>
          <Input
            id="unit"
            name="unit"
            type="text"
            label="Apartment/Unit (Optional)"
            value={values.unit || ''}
            onChange={handleChange}
            onBlur={handleBlur}
            autoComplete="shipping address-line2"
          />
        </div>
      </div>

      <div className={styles['form-row']}>
        <div className={styles['form-group']}>
          <Input
            id="city"
            name="city"
            type="text"
            label="City"
            value={values.city || ''}
            onChange={handleChange}
            onBlur={handleBlur}
            error={touched.city ? errors.city : undefined}
            required
            autoComplete="shipping locality"
          />
        </div>

        <div className={styles['form-group']}>
          <Input
            id="state"
            name="state"
            type="text"
            label="State/Province"
            value={values.state || ''}
            onChange={handleChange}
            onBlur={handleBlur}
            error={touched.state ? errors.state : undefined}
            required
            autoComplete="shipping region"
          />
        </div>
      </div>

      <div className={styles['form-row']}>
        <div className={styles['form-group']}>
          <Input
            id="postalCode"
            name="postalCode"
            type="text"
            label="Postal Code"
            value={values.postalCode || ''}
            onChange={handleChange}
            onBlur={handleBlur}
            error={touched.postalCode ? errors.postalCode : undefined}
            required
            autoComplete="shipping postal-code"
          />
        </div>

        <div className={styles['form-group']}>
          <Input
            id="countryCode"
            name="countryCode"
            type="text"
            label="Country Code"
            value={values.countryCode || ''}
            onChange={handleChange}
            onBlur={handleBlur}
            error={touched.countryCode ? errors.countryCode : undefined}
            required
            autoComplete="shipping country"
          />
        </div>
      </div>

      <div className={styles['form-row']}>
        <div className={styles['form-group']}>
          <Input
            id="phoneNumber"
            name="phoneNumber"
            type="tel"
            label="Phone Number"
            value={values.phoneNumber || ''}
            onChange={handleChange}
            onBlur={handleBlur}
            error={touched.phoneNumber ? errors.phoneNumber : undefined}
            required
            autoComplete="shipping tel"
          />
        </div>
      </div>

      <div className={styles['form-row']}>
        <div className={styles['form-group']}>
          <fieldset>
            <legend>Shipping Method</legend>
            <div className={styles['shipping-methods']}>
              {['standard', 'express', 'priority'].map((method) => (
                <label
                  key={method}
                  className={classnames(styles['shipping-method'], {
                    [styles['selected']]: values.method === method
                  })}
                >
                  <input
                    type="radio"
                    name="method"
                    value={method}
                    checked={values.method === method}
                    onChange={() => handleMethodChange(method as ShippingInfo['method'])}
                    aria-describedby={errors.method ? 'method-error' : undefined}
                  />
                  <span>{method.charAt(0).toUpperCase() + method.slice(1)}</span>
                </label>
              ))}
            </div>
            {touched.method && errors.method && (
              <div id="method-error" className={styles['error-message']} role="alert">
                {errors.method}
              </div>
            )}
          </fieldset>
        </div>
      </div>

      <div className={styles['form-row']}>
        <div className={styles['form-group']}>
          <Input
            id="instructions"
            name="instructions"
            type="text"
            label="Delivery Instructions (Optional)"
            value={values.instructions || ''}
            onChange={handleChange}
            onBlur={handleBlur}
          />
        </div>
      </div>
    </form>
  );
};

export default ShippingForm;