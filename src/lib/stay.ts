import { AppError } from "@/lib/errors";

const MS_PER_MINUTE = 60 * 1000;
const MS_PER_HOUR = 60 * MS_PER_MINUTE;
const MS_PER_DAY = 24 * MS_PER_HOUR; // 86,400,000 ms

export interface StayCalculationResult {
  days: number;
  hours: number;
  minutes: number;
  elapsedMs: number;
  graceMinutes: number;
  isGracePeriodApplied: boolean;
}

/**
 * Calculates billable days of stay using the 24-hour stay rule with grace period.
 * Pure isomorphic function safe for use in both server services and client components.
 *
 * Invariant (PROJECT_OVERVIEW.md §7):
 *   elapsedMs = checkOut - checkIn
 *   days      = max(1, ceil((elapsedMs - graceMs) / 24h))
 *
 * Requirements:
 * - checkIn and checkOut must be valid dates.
 * - checkOut must be strictly after checkIn.
 * - Minimum billable stay is 1 day.
 * - A 24-hour day runs on exact elapsed duration from checkIn.
 * - Extra time exceeding a full 24-hour block is absorbed if it falls within graceMinutes;
 *   otherwise, it rolls over to a full additional billable day.
 */
export function calculateStay(
  checkInInput: Date | string | number,
  checkOutInput: Date | string | number,
  graceMinutesInput: number = 0
): StayCalculationResult {
  const checkIn =
    checkInInput instanceof Date ? checkInInput : new Date(checkInInput);
  const checkOut =
    checkOutInput instanceof Date ? checkOutInput : new Date(checkOutInput);

  if (isNaN(checkIn.getTime()) || isNaN(checkOut.getTime())) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Invalid check-in or check-out date."
    );
  }

  const elapsedMs = checkOut.getTime() - checkIn.getTime();
  if (elapsedMs <= 0) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Check-out time must be strictly after check-in time."
    );
  }

  const graceMinutes = Math.max(0, Math.floor(Number(graceMinutesInput) || 0));
  const graceMs = graceMinutes * MS_PER_MINUTE;

  // Raw days without grace: max(1, ceil(elapsedMs / 24h))
  const daysWithoutGrace = Math.max(1, Math.ceil(elapsedMs / MS_PER_DAY));

  // Billable days with grace: max(1, ceil((elapsedMs - graceMs) / 24h))
  const days = Math.max(1, Math.ceil((elapsedMs - graceMs) / MS_PER_DAY));

  // Grace period was applied if it prevented a rollover into an additional billable day
  const isGracePeriodApplied = days < daysWithoutGrace;

  const totalMinutes = Math.round(elapsedMs / MS_PER_MINUTE);
  const totalHours = Number((elapsedMs / MS_PER_HOUR).toFixed(2));

  return {
    days,
    hours: totalHours,
    minutes: totalMinutes,
    elapsedMs,
    graceMinutes,
    isGracePeriodApplied,
  };
}

/**
 * Determines whether two half-open intervals [startA, endA) and [startB, endB) overlap.
 * Invariant: Back-to-back stays (checkout at T and next check-in at T) do NOT overlap.
 */
export function doIntervalsOverlap(
  startA: Date | string | number,
  endA: Date | string | number,
  startB: Date | string | number,
  endB: Date | string | number
): boolean {
  const sA = new Date(startA).getTime();
  const eA = new Date(endA).getTime();
  const sB = new Date(startB).getTime();
  const eB = new Date(endB).getTime();

  return sA < eB && eA > sB;
}
