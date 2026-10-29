import { formatInTimeZone, fromZonedTime, toZonedTime } from "date-fns-tz";
import {
  endOfDay,
  endOfMonth,
  startOfDay,
  startOfMonth,
  parseISO,
} from "date-fns";

export const IST_TIMEZONE = "Asia/Kolkata";

/**
 * Normalizes input into a JS Date object.
 */
function ensureDate(date: Date | string | number): Date {
  if (date instanceof Date) return date;
  if (typeof date === "string") return parseISO(date);
  return new Date(date);
}

/**
 * Returns a Date object shifted to IST zone representation.
 */
export function toIST(date: Date | string | number): Date {
  return toZonedTime(ensureDate(date), IST_TIMEZONE);
}

/**
 * Parses an IST input string (e.g. "2026-10-29T10:00") into a UTC Date.
 */
export function fromISTInput(dateStr: string): Date {
  return fromZonedTime(dateStr, IST_TIMEZONE);
}

/**
 * Formats a Date in IST timezone.
 */
export function formatIST(
  date: Date | string | number,
  formatStr: string = "dd MMM yyyy, hh:mm a"
): string {
  return formatInTimeZone(ensureDate(date), IST_TIMEZONE, formatStr);
}

/**
 * Standard date display in IST (e.g., "29 Oct 2026").
 */
export function formatISTDate(date: Date | string | number): string {
  return formatIST(date, "dd MMM yyyy");
}

/**
 * Standard time display in IST (e.g., "10:30 AM").
 */
export function formatISTTime(date: Date | string | number): string {
  return formatIST(date, "hh:mm a");
}

/**
 * Time with seconds display for the live clock (e.g., "10:30:45 AM").
 */
export function formatISTTimeWithSeconds(date: Date | string | number): string {
  return formatIST(date, "HH:mm:ss");
}

/**
 * Formats a Date into an HTML datetime-local input string in IST (e.g. "2026-10-29T10:00").
 */
export function toISTInputString(date: Date | string | number): string {
  return formatIST(date, "yyyy-MM-dd'T'HH:mm");
}

/**
 * Full date and time in IST (e.g., "29 Oct 2026, 10:30 AM").
 */
export function formatISTDateTime(date: Date | string | number): string {
  return formatIST(date, "dd MMM yyyy, hh:mm a");
}

/**
 * Returns a UTC Date representing the start of the given date in IST (00:00:00.000 IST).
 */
export function startOfISTDay(date: Date | string | number = new Date()): Date {
  const zoned = toZonedTime(ensureDate(date), IST_TIMEZONE);
  const start = startOfDay(zoned);
  return fromZonedTime(start, IST_TIMEZONE);
}

/**
 * Returns a UTC Date representing the end of the given date in IST (23:59:59.999 IST).
 */
export function endOfISTDay(date: Date | string | number = new Date()): Date {
  const zoned = toZonedTime(ensureDate(date), IST_TIMEZONE);
  const end = endOfDay(zoned);
  return fromZonedTime(end, IST_TIMEZONE);
}

/**
 * Returns a UTC Date representing the start of the month in IST.
 */
export function startOfISTMonth(date: Date | string | number = new Date()): Date {
  const zoned = toZonedTime(ensureDate(date), IST_TIMEZONE);
  const start = startOfMonth(zoned);
  return fromZonedTime(start, IST_TIMEZONE);
}

/**
 * Returns a UTC Date representing the end of the month in IST.
 */
export function endOfISTMonth(date: Date | string | number = new Date()): Date {
  const zoned = toZonedTime(ensureDate(date), IST_TIMEZONE);
  const end = endOfMonth(zoned);
  return fromZonedTime(end, IST_TIMEZONE);
}
