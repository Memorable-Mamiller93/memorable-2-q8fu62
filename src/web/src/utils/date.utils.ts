// date-fns v2.30.0 - Core date manipulation library
import { format, isValid, parseISO, differenceInDays } from 'date-fns';
import type { Locale } from 'date-fns';

// Default date format constants
export const DATE_FORMAT_DEFAULT = 'MMM dd, yyyy';
export const DATE_FORMAT_WITH_TIME = 'MMM dd, yyyy HH:mm';
export const DATE_FORMAT_ISO = 'yyyy-MM-dd';
export const PROCESSING_DAYS_DEFAULT = 5;

// Error messages
const ERROR_MESSAGES = {
  INVALID_DATE: 'Invalid date provided',
  INVALID_FORMAT: 'Invalid date format',
  INVALID_PROCESSING_DAYS: 'Processing days must be a positive number',
} as const;

// Type definitions
type DateInput = Date | string | number;
interface DeliveryDateOptions {
  processingDays?: number;
  holidayCalendar?: Date[];
}

/**
 * Formats a date into a human-readable string with timezone and locale support
 * @param date - Date to format (Date object, ISO string, or timestamp)
 * @param formatString - Format pattern to use (defaults to DATE_FORMAT_DEFAULT)
 * @param locale - Optional locale for internationalization
 * @returns Formatted date string or empty string if invalid
 */
export const formatDate = (
  date: DateInput,
  formatString: string = DATE_FORMAT_DEFAULT,
  locale?: Locale
): string => {
  try {
    const parsedDate = typeof date === 'string' ? parseISO(date) : new Date(date);
    
    if (!isValid(parsedDate)) {
      return '';
    }

    return format(parsedDate, formatString, { locale });
  } catch (error) {
    console.error('Error formatting date:', error);
    return '';
  }
};

/**
 * Parses an ISO date string from API response into a Date object
 * @param dateString - ISO format date string
 * @returns Parsed Date object with correct timezone
 * @throws Error if date string is invalid
 */
export const parseApiDate = (dateString: string): Date => {
  const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{3})?Z)?$/;
  
  if (!ISO_DATE_REGEX.test(dateString)) {
    throw new Error(ERROR_MESSAGES.INVALID_FORMAT);
  }

  const parsedDate = parseISO(dateString);
  
  if (!isValid(parsedDate)) {
    throw new Error(ERROR_MESSAGES.INVALID_DATE);
  }

  return parsedDate;
};

/**
 * Returns a locale-aware relative time string
 * @param date - Date to compare against current time
 * @param locale - Optional locale for internationalization
 * @returns Localized relative time string
 */
export const getRelativeTimeString = (
  date: DateInput,
  locale?: Locale
): string => {
  try {
    const parsedDate = typeof date === 'string' ? parseISO(date) : new Date(date);
    
    if (!isValid(parsedDate)) {
      throw new Error(ERROR_MESSAGES.INVALID_DATE);
    }

    const now = new Date();
    const diffInDays = differenceInDays(parsedDate, now);
    const diffInMinutes = Math.floor((parsedDate.getTime() - now.getTime()) / (1000 * 60));
    const diffInHours = Math.floor(diffInMinutes / 60);

    // Handle future dates
    if (diffInDays > 0) {
      if (diffInDays === 1) return 'tomorrow';
      if (diffInDays < 7) return `in ${diffInDays} days`;
      if (diffInDays < 30) return `in ${Math.floor(diffInDays / 7)} weeks`;
      return formatDate(parsedDate, DATE_FORMAT_DEFAULT, locale);
    }

    // Handle past dates
    if (diffInDays < 0) {
      if (diffInDays === -1) return 'yesterday';
      if (diffInDays > -7) return `${Math.abs(diffInDays)} days ago`;
      if (diffInDays > -30) return `${Math.floor(Math.abs(diffInDays) / 7)} weeks ago`;
      return formatDate(parsedDate, DATE_FORMAT_DEFAULT, locale);
    }

    // Handle same day
    if (diffInHours > 0) return `in ${diffInHours} hours`;
    if (diffInHours < 0) return `${Math.abs(diffInHours)} hours ago`;
    if (diffInMinutes > 0) return `in ${diffInMinutes} minutes`;
    if (diffInMinutes < 0) return `${Math.abs(diffInMinutes)} minutes ago`;
    
    return 'just now';
  } catch (error) {
    console.error('Error calculating relative time:', error);
    return formatDate(date, DATE_FORMAT_DEFAULT, locale);
  }
};

/**
 * Checks if a date is in the future with millisecond precision
 * @param date - Date to check
 * @returns Boolean indicating if date is in the future
 */
export const isDateInFuture = (date: DateInput): boolean => {
  try {
    const parsedDate = typeof date === 'string' ? parseISO(date) : new Date(date);
    
    if (!isValid(parsedDate)) {
      throw new Error(ERROR_MESSAGES.INVALID_DATE);
    }

    return parsedDate.getTime() > Date.now();
  } catch (error) {
    console.error('Error checking future date:', error);
    return false;
  }
};

/**
 * Calculates estimated delivery date considering business days and holidays
 * @param orderDate - Starting date for calculation
 * @param options - Optional configuration for calculation
 * @returns Estimated delivery date
 */
export const calculateDeliveryDate = (
  orderDate: Date,
  { processingDays = PROCESSING_DAYS_DEFAULT, holidayCalendar = [] }: DeliveryDateOptions = {}
): Date => {
  if (!isValid(orderDate)) {
    throw new Error(ERROR_MESSAGES.INVALID_DATE);
  }

  if (processingDays < 0) {
    throw new Error(ERROR_MESSAGES.INVALID_PROCESSING_DAYS);
  }

  const deliveryDate = new Date(orderDate);
  let remainingDays = processingDays;
  
  while (remainingDays > 0) {
    deliveryDate.setDate(deliveryDate.getDate() + 1);
    
    // Skip weekends
    if (deliveryDate.getDay() === 0 || deliveryDate.getDay() === 6) {
      continue;
    }
    
    // Skip holidays
    const isHoliday = holidayCalendar.some(holiday => 
      holiday.getDate() === deliveryDate.getDate() &&
      holiday.getMonth() === deliveryDate.getMonth() &&
      holiday.getFullYear() === deliveryDate.getFullYear()
    );
    
    if (isHoliday) {
      continue;
    }
    
    remainingDays--;
  }

  return deliveryDate;
};