/**
 * @fileoverview PCI-compliant payment form component for processing book orders
 * Implements secure payment processing with real-time validation and accessibility
 * @version 1.0.0
 */

import React, { useCallback, useEffect, useState } from 'react';
import { loadStripe } from '@stripe/stripe-js'; // v1.54.0
import Input from '../common/Input';
import { useForm } from '../../hooks/useForm';
import { processPayment } from '../../api/order.api';
import styles from './PaymentForm.module.css';

// Initialize Stripe with public key
const stripePromise = loadStripe(process.env.VITE_STRIPE_PUBLIC_KEY || '');

/**
 * Card type enumeration for validation
 */
enum CardType {
  VISA = 'visa',
  MASTERCARD = 'mastercard',
  AMEX = 'amex',
  UNKNOWN = 'unknown'
}

/**
 * Payment validation error interface
 */
interface PaymentError {
  code: string;
  message: string;
  field?: string;
}

/**
 * Props interface for PaymentForm component
 */
interface PaymentFormProps {
  orderId: string;
  amount: number;
  currency: string;
  onSuccess: (paymentInfo: PaymentInfo) => void;
  onError: (error: PaymentError) => void;
  onValidationError: (errors: Record<string, string>) => void;
}

/**
 * Enhanced credit card validation using Luhn algorithm
 */
const validateCardNumber = (cardNumber: string): { isValid: boolean; type: CardType } => {
  const sanitizedNumber = cardNumber.replace(/\D/g, '');
  
  // Detect card type
  let type = CardType.UNKNOWN;
  if (/^4/.test(sanitizedNumber)) type = CardType.VISA;
  else if (/^5[1-5]/.test(sanitizedNumber)) type = CardType.MASTERCARD;
  else if (/^3[47]/.test(sanitizedNumber)) type = CardType.AMEX;

  // Luhn algorithm implementation
  let sum = 0;
  let isEven = false;
  
  for (let i = sanitizedNumber.length - 1; i >= 0; i--) {
    let digit = parseInt(sanitizedNumber[i]);
    
    if (isEven) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    
    sum += digit;
    isEven = !isEven;
  }

  return {
    isValid: sum % 10 === 0 && sanitizedNumber.length >= 13,
    type
  };
};

/**
 * Validates expiry date with future date check
 */
const validateExpiryDate = (month: string, year: string): boolean => {
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear() % 100;
  const currentMonth = currentDate.getMonth() + 1;
  
  const expMonth = parseInt(month);
  const expYear = parseInt(year);
  
  if (isNaN(expMonth) || isNaN(expYear)) return false;
  if (expMonth < 1 || expMonth > 12) return false;
  
  return (expYear > currentYear) || 
         (expYear === currentYear && expMonth >= currentMonth);
};

/**
 * PCI-compliant payment form component
 */
export const PaymentForm: React.FC<PaymentFormProps> = ({
  orderId,
  amount,
  currency,
  onSuccess,
  onError,
  onValidationError
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [cardType, setCardType] = useState<CardType>(CardType.UNKNOWN);

  // Initialize form with validation
  const {
    values,
    errors,
    handleChange,
    handleBlur,
    handleSubmit,
    isSubmitting
  } = useForm({
    initialValues: {
      cardNumber: '',
      expiryMonth: '',
      expiryYear: '',
      cvv: '',
      cardholderName: ''
    },
    validationSchema: {
      cardNumber: async (value) => {
        const { isValid, type } = validateCardNumber(value);
        setCardType(type);
        if (!isValid) {
          return {
            field: 'cardNumber',
            message: 'Invalid card number',
            code: 'INVALID_CARD',
            path: ['cardNumber'],
            value,
            rule: 'cardNumber',
            severity: 'error'
          };
        }
      },
      expiryMonth: async (value) => {
        if (!validateExpiryDate(value, values.expiryYear)) {
          return {
            field: 'expiryMonth',
            message: 'Invalid expiry date',
            code: 'INVALID_EXPIRY',
            path: ['expiryMonth'],
            value,
            rule: 'expiry',
            severity: 'error'
          };
        }
      }
    }
  });

  // Handle payment submission
  const handlePaymentSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);

    try {
      const stripe = await stripePromise;
      if (!stripe) throw new Error('Stripe failed to initialize');

      // Create payment method
      const { paymentMethod, error } = await stripe.createPaymentMethod({
        type: 'card',
        card: {
          number: values.cardNumber,
          exp_month: parseInt(values.expiryMonth),
          exp_year: parseInt(values.expiryYear),
          cvc: values.cvv
        },
        billing_details: {
          name: values.cardholderName
        }
      });

      if (error) throw error;

      // Process payment through API
      const response = await processPayment(orderId, {
        paymentMethodId: paymentMethod.id,
        provider: 'stripe',
        amount,
        currency
      });

      onSuccess(response.data);
    } catch (error: any) {
      onError({
        code: error.code || 'PAYMENT_ERROR',
        message: error.message || 'Payment processing failed'
      });
    } finally {
      setIsProcessing(false);
    }
  }, [values, orderId, amount, currency, onSuccess, onError]);

  // Update validation errors
  useEffect(() => {
    if (Object.keys(errors).length > 0) {
      onValidationError(errors);
    }
  }, [errors, onValidationError]);

  return (
    <form 
      onSubmit={handlePaymentSubmit}
      className={styles['payment-form']}
      aria-label="Payment form"
    >
      <div className={styles['form-row']}>
        <Input
          id="cardholderName"
          name="cardholderName"
          type="text"
          label="Cardholder Name"
          value={values.cardholderName}
          onChange={handleChange}
          onBlur={handleBlur}
          error={errors.cardholderName}
          required
          autoComplete="cc-name"
        />
      </div>

      <div className={styles['form-row']}>
        <Input
          id="cardNumber"
          name="cardNumber"
          type="text"
          label="Card Number"
          value={values.cardNumber}
          onChange={handleChange}
          onBlur={handleBlur}
          error={errors.cardNumber}
          required
          autoComplete="cc-number"
          className={styles[`card-type-${cardType}`]}
        />
      </div>

      <div className={styles['form-row']}>
        <div className={styles['expiry-group']}>
          <Input
            id="expiryMonth"
            name="expiryMonth"
            type="text"
            label="Month"
            value={values.expiryMonth}
            onChange={handleChange}
            onBlur={handleBlur}
            error={errors.expiryMonth}
            required
            autoComplete="cc-exp-month"
          />
          <Input
            id="expiryYear"
            name="expiryYear"
            type="text"
            label="Year"
            value={values.expiryYear}
            onChange={handleChange}
            onBlur={handleBlur}
            error={errors.expiryYear}
            required
            autoComplete="cc-exp-year"
          />
        </div>
        <Input
          id="cvv"
          name="cvv"
          type="text"
          label="CVV"
          value={values.cvv}
          onChange={handleChange}
          onBlur={handleBlur}
          error={errors.cvv}
          required
          autoComplete="cc-csc"
          className={styles['cvv-input']}
        />
      </div>

      <button
        type="submit"
        className={styles['submit-button']}
        disabled={isProcessing || isSubmitting || Object.keys(errors).length > 0}
        aria-busy={isProcessing}
      >
        {isProcessing ? 'Processing...' : `Pay ${amount} ${currency}`}
      </button>

      <div className={styles['security-badge']} aria-label="Security information">
        <span>🔒 Secure, encrypted payment</span>
        <span>Powered by Stripe</span>
      </div>
    </form>
  );
};

export default PaymentForm;