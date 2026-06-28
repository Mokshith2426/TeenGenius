import { Timestamp } from 'firebase/firestore';

/**
 * Safely converts a value to a Date object.
 * Handles Firestore Timestamps, JS Date objects, strings, numbers, and null/undefined.
 */
export function toDate(value: any): Date | null {
  if (!value) return null;

  // Handle Firestore Timestamp
  if (typeof value === 'object' && 'seconds' in value && 'nanoseconds' in value) {
    return new Timestamp(value.seconds, value.nanoseconds).toDate();
  }
  
  // Handle direct toDate function (native Timestamp)
  if (typeof value.toDate === 'function') {
    return value.toDate();
  }

  // Handle Date object
  if (value instanceof Date) {
    return value;
  }

  // Handle string or number
  const date = new Date(value);
  if (!isNaN(date.getTime())) {
    return date;
  }

  return null;
}

/**
 * Formats a timestamp value for display.
 */
export function formatTime(value: any, options: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit' }): string {
  const date = toDate(value);
  if (!date) return 'Syncing...';
  return date.toLocaleTimeString([], options);
}

/**
 * Formats a date value for display.
 */
export function formatDate(value: any, options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }): string {
  const date = toDate(value);
  if (!date) return '---';
  return date.toLocaleDateString(undefined, options);
}
