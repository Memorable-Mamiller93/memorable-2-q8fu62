/**
 * @fileoverview Comprehensive test suite for PaymentForm component
 * Tests payment processing, validation, error handling, and accessibility
 * @version 1.0.0
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import { vi } from 'vitest';
import { PaymentForm } from '../../../../src/components/order/PaymentForm';
import type { PaymentInfo } from '../../../../src/types/order.types';

// Add jest-axe matchers
expect.extend(toHaveNoViolations);

// Mock Stripe
const mockStripe = {
  createPaymentMethod: vi.fn(),
  elements: vi.fn()
};

vi.mock('@stripe/stripe-js', () => ({
  loadStripe: () => Promise.resolve(mockStripe)
}));

// Mock payment processing API
vi.mock('../../../../src/api/order.api', () => ({
  processPayment: vi.fn()
}));

describe('PaymentForm Component', () => {
  // Test props
  const defaultProps = {
    orderId: 'test-order-123',
    amount: 2999,
    currency: 'USD',
    onSuccess: vi.fn(),
    onError: vi.fn(),
    onValidationError: vi.fn()
  };

  // Setup and teardown
  beforeEach(() => {
    vi.clearAllMocks();
    mockStripe.createPaymentMethod.mockReset();
  });

  describe('Component Rendering', () => {
    it('renders all form elements with proper attributes', () => {
      render(<PaymentForm {...defaultProps} />);

      // Check form elements
      expect(screen.getByLabelText(/cardholder name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/card number/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/month/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/year/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/cvv/i)).toBeInTheDocument();
      
      // Check submit button
      expect(screen.getByRole('button')).toHaveTextContent(`Pay ${defaultProps.amount} ${defaultProps.currency}`);
    });

    it('displays proper ARIA attributes for accessibility', () => {
      render(<PaymentForm {...defaultProps} />);

      // Check form accessibility
      const form = screen.getByRole('form');
      expect(form).toHaveAttribute('aria-label', 'Payment form');

      // Check input fields accessibility
      const cardholderInput = screen.getByLabelText(/cardholder name/i);
      expect(cardholderInput).toHaveAttribute('aria-required', 'true');
      expect(cardholderInput).toHaveAttribute('autocomplete', 'cc-name');
    });

    it('shows card type icon based on number input', async () => {
      render(<PaymentForm {...defaultProps} />);
      
      const cardInput = screen.getByLabelText(/card number/i);
      
      // Test Visa detection
      await userEvent.type(cardInput, '4');
      expect(cardInput).toHaveClass('card-type-visa');

      // Test Mastercard detection
      await userEvent.clear(cardInput);
      await userEvent.type(cardInput, '51');
      expect(cardInput).toHaveClass('card-type-mastercard');
    });
  });

  describe('Form Validation', () => {
    it('validates card number using Luhn algorithm', async () => {
      render(<PaymentForm {...defaultProps} />);
      
      const cardInput = screen.getByLabelText(/card number/i);
      
      // Invalid card number
      await userEvent.type(cardInput, '4111111111111112');
      await userEvent.tab();
      
      expect(await screen.findByText(/invalid card number/i)).toBeInTheDocument();
      
      // Valid card number
      await userEvent.clear(cardInput);
      await userEvent.type(cardInput, '4111111111111111');
      await userEvent.tab();
      
      expect(screen.queryByText(/invalid card number/i)).not.toBeInTheDocument();
    });

    it('validates expiry date for future validity', async () => {
      render(<PaymentForm {...defaultProps} />);
      
      const monthInput = screen.getByLabelText(/month/i);
      const yearInput = screen.getByLabelText(/year/i);
      
      // Past date
      await userEvent.type(monthInput, '01');
      await userEvent.type(yearInput, '20');
      
      expect(await screen.findByText(/invalid expiry date/i)).toBeInTheDocument();
      
      // Future date
      const futureYear = String((new Date().getFullYear() + 1) % 100);
      await userEvent.clear(yearInput);
      await userEvent.type(yearInput, futureYear);
      
      expect(screen.queryByText(/invalid expiry date/i)).not.toBeInTheDocument();
    });

    it('handles incomplete form submission', async () => {
      render(<PaymentForm {...defaultProps} />);
      
      const submitButton = screen.getByRole('button');
      await userEvent.click(submitButton);
      
      expect(defaultProps.onValidationError).toHaveBeenCalled();
      expect(submitButton).toBeDisabled();
    });
  });

  describe('Payment Processing', () => {
    it('processes valid payment successfully', async () => {
      const mockPaymentMethod = {
        id: 'pm_test123',
        type: 'card'
      };

      mockStripe.createPaymentMethod.mockResolvedValueOnce({
        paymentMethod: mockPaymentMethod,
        error: null
      });

      render(<PaymentForm {...defaultProps} />);
      
      // Fill form with valid data
      await userEvent.type(screen.getByLabelText(/cardholder name/i), 'John Doe');
      await userEvent.type(screen.getByLabelText(/card number/i), '4111111111111111');
      await userEvent.type(screen.getByLabelText(/month/i), '12');
      await userEvent.type(screen.getByLabelText(/year/i), '25');
      await userEvent.type(screen.getByLabelText(/cvv/i), '123');
      
      // Submit form
      await userEvent.click(screen.getByRole('button'));
      
      await waitFor(() => {
        expect(defaultProps.onSuccess).toHaveBeenCalled();
      });
    });

    it('handles declined payments appropriately', async () => {
      mockStripe.createPaymentMethod.mockResolvedValueOnce({
        paymentMethod: null,
        error: { code: 'card_declined', message: 'Card declined' }
      });

      render(<PaymentForm {...defaultProps} />);
      
      // Fill and submit form
      await userEvent.type(screen.getByLabelText(/cardholder name/i), 'John Doe');
      await userEvent.type(screen.getByLabelText(/card number/i), '4000000000000002');
      await userEvent.type(screen.getByLabelText(/month/i), '12');
      await userEvent.type(screen.getByLabelText(/year/i), '25');
      await userEvent.type(screen.getByLabelText(/cvv/i), '123');
      
      await userEvent.click(screen.getByRole('button'));
      
      await waitFor(() => {
        expect(defaultProps.onError).toHaveBeenCalledWith({
          code: 'card_declined',
          message: 'Card declined'
        });
      });
    });
  });

  describe('Accessibility', () => {
    it('meets WCAG 2.1 Level AA requirements', async () => {
      const { container } = render(<PaymentForm {...defaultProps} />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('supports keyboard navigation', async () => {
      render(<PaymentForm {...defaultProps} />);
      
      const firstInput = screen.getByLabelText(/cardholder name/i);
      firstInput.focus();
      
      // Tab through all inputs
      await userEvent.tab();
      expect(screen.getByLabelText(/card number/i)).toHaveFocus();
      
      await userEvent.tab();
      expect(screen.getByLabelText(/month/i)).toHaveFocus();
      
      await userEvent.tab();
      expect(screen.getByLabelText(/year/i)).toHaveFocus();
      
      await userEvent.tab();
      expect(screen.getByLabelText(/cvv/i)).toHaveFocus();
      
      await userEvent.tab();
      expect(screen.getByRole('button')).toHaveFocus();
    });

    it('announces validation errors to screen readers', async () => {
      render(<PaymentForm {...defaultProps} />);
      
      const cardInput = screen.getByLabelText(/card number/i);
      await userEvent.type(cardInput, '4111111111111112');
      await userEvent.tab();
      
      const errorMessage = await screen.findByRole('alert');
      expect(errorMessage).toHaveTextContent(/invalid card number/i);
    });
  });
});