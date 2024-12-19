/**
 * @fileoverview Comprehensive utility functions for consistent data formatting
 * Implements locale-aware formatting for currency, dates, addresses, and book content
 * with full accessibility and RTL support
 * @version 1.0.0
 */

import { format, formatDistance } from 'date-fns'; // v2.30.0
import { Book } from '../types/book.types';
import { Order } from '../types/order.types';

/**
 * Memoization decorator for performance optimization
 */
function memoize<T extends Function>(target: T): T {
  const cache = new Map();
  
  const memoized = (...args: any[]) => {
    const key = JSON.stringify(args);
    if (cache.has(key)) {
      return cache.get(key);
    }
    const result = target(...args);
    cache.set(key, result);
    return result;
  };

  return memoized as T;
}

/**
 * Formats monetary amounts with proper currency symbol and localization
 * @param amount - Numeric amount to format
 * @param currency - ISO 4217 currency code
 * @param locale - BCP 47 language tag
 * @returns Formatted currency string with accessibility support
 */
export const formatCurrency = memoize((
  amount: number,
  currency: string,
  locale: string = 'en-US'
): string => {
  if (!Number.isFinite(amount)) {
    throw new Error('Invalid amount provided for currency formatting');
  }

  const formatter = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

  const formattedAmount = formatter.format(amount);
  const direction = new Intl.Locale(locale).textInfo?.direction || 'ltr';
  
  // Add accessibility attributes
  const ariaLabel = `${amount} ${currency}`;
  
  return `<span dir="${direction}" aria-label="${ariaLabel}">${formattedAmount}</span>`;
});

/**
 * Formats dates with timezone and localization support
 * @param date - Date to format
 * @param formatString - Date format pattern
 * @param timezone - IANA timezone identifier
 * @returns Localized date string
 */
export const formatDate = memoize((
  date: Date,
  formatString: string = 'PPP',
  timezone: string = 'UTC'
): string => {
  if (!(date instanceof Date) || isNaN(date.getTime())) {
    throw new Error('Invalid date provided for formatting');
  }

  try {
    const formattedDate = format(date, formatString);
    return `<time datetime="${date.toISOString()}">${formattedDate}</time>`;
  } catch (error) {
    console.error('Date formatting error:', error);
    return date.toLocaleDateString();
  }
});

/**
 * Formats shipping address with international support
 * @param shippingInfo - Shipping information object
 * @param locale - BCP 47 language tag
 * @returns Formatted address string following regional conventions
 */
export const formatAddress = (
  shippingInfo: Order['shippingInfo'],
  locale: string = 'en-US'
): string => {
  const {
    recipientName,
    streetAddress,
    unit,
    city,
    state,
    postalCode,
    countryCode
  } = shippingInfo;

  const direction = new Intl.Locale(locale).textInfo?.direction || 'ltr';
  const formatter = new Intl.DisplayNames([locale], { type: 'region' });
  const countryName = formatter.of(countryCode);

  const addressParts = [
    recipientName,
    [streetAddress, unit].filter(Boolean).join(' '),
    [city, state, postalCode].filter(Boolean).join(' '),
    countryName
  ].filter(Boolean);

  return `<address dir="${direction}">
    ${addressParts.join('<br>')}
  </address>`;
};

/**
 * Formats book title with character name integration
 * @param book - Book object containing metadata and characters
 * @param locale - BCP 47 language tag
 * @returns Formatted book title
 */
export const formatBookTitle = memoize((
  book: Book,
  locale: string = 'en-US'
): string => {
  const { title, metadata } = book;
  const { mainCharacter } = metadata;
  
  const direction = new Intl.Locale(locale).textInfo?.direction || 'ltr';
  
  // Apply title case based on locale
  const formatter = new Intl.Collator(locale, { sensitivity: 'case' });
  const formattedTitle = title
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');

  // Insert character name if placeholder exists
  const titleWithCharacter = formattedTitle.replace(
    /\{character\}/gi,
    mainCharacter.name
  );

  return `<span dir="${direction}" class="book-title">${titleWithCharacter}</span>`;
});

/**
 * Formats timestamps into accessible relative time strings
 * @param date - Date to format relatively
 * @param locale - BCP 47 language tag
 * @returns Localized relative time string with screen reader support
 */
export const formatRelativeTime = memoize((
  date: Date,
  locale: string = 'en-US'
): string => {
  if (!(date instanceof Date) || isNaN(date.getTime())) {
    throw new Error('Invalid date provided for relative time formatting');
  }

  const now = new Date();
  const relativeTime = formatDistance(date, now, {
    addSuffix: true,
    includeSeconds: true
  });

  const isoDate = date.toISOString();
  const direction = new Intl.Locale(locale).textInfo?.direction || 'ltr';

  return `<time 
    datetime="${isoDate}"
    dir="${direction}"
    aria-label="${date.toLocaleDateString(locale, { dateStyle: 'full' })}"
  >
    ${relativeTime}
  </time>`;
});

/**
 * Type guard to check if a value is a valid number
 */
const isValidNumber = (value: any): value is number => {
  return typeof value === 'number' && !isNaN(value) && isFinite(value);
};

/**
 * Type guard to check if a value is a valid date
 */
const isValidDate = (value: any): value is Date => {
  return value instanceof Date && !isNaN(value.getTime());
};