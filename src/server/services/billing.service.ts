import "server-only";
import { Decimal } from "decimal.js";
import { AppError } from "@/lib/errors";

export interface GstSlabLike {
  id?: string;
  minRate: Decimal | number | string;
  maxRate: Decimal | number | string | null;
  percent: Decimal | number | string;
  isActive?: boolean;
}

/**
 * Validates a collection of active GST slabs.
 * Boundary convention:
 * - A slab covers minRate < rate <= maxRate.
 * - The first slab starts at 0 inclusive (0 <= rate <= maxRate).
 * - Slabs must be continuous with no overlaps and no gaps:
 *   slab[i].minRate must strictly equal slab[i-1].maxRate.
 * - At most one open-ended slab (maxRate === null), and it must be the highest slab.
 */
export function validateGstSlabsContinuity(slabs: GstSlabLike[]): void {
  const activeSlabs = slabs.filter((s) => s.isActive !== false);
  if (activeSlabs.length === 0) {
    throw new AppError("VALIDATION_ERROR", "At least one active GST slab is required.");
  }

  // Sort by minRate ascending
  const sorted = [...activeSlabs].sort((a, b) =>
    new Decimal(a.minRate).comparedTo(new Decimal(b.minRate))
  );

  // Check first slab begins at 0
  if (!new Decimal(sorted[0].minRate).equals(0)) {
    throw new AppError(
      "VALIDATION_ERROR",
      `The first GST slab must start at ₹0 (currently starts at ₹${sorted[0].minRate}).`
    );
  }

  for (let i = 0; i < sorted.length; i++) {
    const current = sorted[i];
    const min = new Decimal(current.minRate);
    const pct = new Decimal(current.percent);

    if (min.isNegative()) {
      throw new AppError("VALIDATION_ERROR", "Min rate cannot be negative.");
    }
    if (pct.isNegative() || pct.greaterThan(100)) {
      throw new AppError("VALIDATION_ERROR", "GST percent must be between 0 and 100.");
    }

    if (current.maxRate !== null && current.maxRate !== undefined) {
      const max = new Decimal(current.maxRate);
      if (max.lessThanOrEqualTo(min)) {
        throw new AppError(
          "VALIDATION_ERROR",
          `Max rate (${max.toString()}) must be strictly greater than min rate (${min.toString()}).`
        );
      }
    } else {
      // Open-ended slab: must be the last one in sorted list
      if (i !== sorted.length - 1) {
        throw new AppError(
          "VALIDATION_ERROR",
          "Only the highest GST slab can be open-ended (no upper limit)."
        );
      }
    }

    // Check continuity with previous slab
    if (i > 0) {
      const prev = sorted[i - 1];
      if (prev.maxRate === null || prev.maxRate === undefined) {
        throw new AppError(
          "VALIDATION_ERROR",
          "An open-ended slab cannot be followed by another slab."
        );
      }
      const prevMax = new Decimal(prev.maxRate);
      if (min.lessThan(prevMax)) {
        throw new AppError(
          "VALIDATION_ERROR",
          `Overlapping GST slabs detected between ₹${prev.minRate}–₹${prevMax.toString()} and ₹${min.toString()}–₹${current.maxRate ?? "∞"}.`
        );
      }
      if (min.greaterThan(prevMax)) {
        throw new AppError(
          "VALIDATION_ERROR",
          `Gap detected in GST slabs between ₹${prevMax.toString()} and ₹${min.toString()}. Slabs must be continuous.`
        );
      }
    }
  }
}

/**
 * Pure function to find the matching GST slab for a given per-night room rate.
 *
 * Boundary convention:
 * - A slab covers minRate < rate <= maxRate.
 * - The first slab starts at 0 inclusive (0 <= rate <= maxRate).
 * - Example:
 *   Slab 1: 0 to 7500 (5%) -> matches 0, 1, 7499.99, 7500.00
 *   Slab 2: 7500 to null (18%) -> matches 7500.01, 7500.50, 10000.00
 */
export function findGstSlab<T extends GstSlabLike>(
  slabs: T[],
  rateInput: Decimal | number | string
): T | null {
  const rate = new Decimal(rateInput);
  if (rate.isNegative()) {
    return null;
  }

  const activeSlabs = slabs.filter((s) => s.isActive !== false);
  const sorted = [...activeSlabs].sort((a, b) =>
    new Decimal(a.minRate).comparedTo(new Decimal(b.minRate))
  );

  for (let i = 0; i < sorted.length; i++) {
    const slab = sorted[i];
    const min = new Decimal(slab.minRate);
    const hasMax = slab.maxRate !== null && slab.maxRate !== undefined;
    const max = hasMax ? new Decimal(slab.maxRate!) : null;

    // First slab (minRate == 0): inclusive lower bound [0, max]
    if (i === 0 || min.equals(0)) {
      if (rate.greaterThanOrEqualTo(0)) {
        if (!max || rate.lessThanOrEqualTo(max)) {
          return slab;
        }
      }
    } else {
      // Subsequent slabs: minRate < rate <= maxRate
      if (rate.greaterThan(min)) {
        if (!max || rate.lessThanOrEqualTo(max)) {
          return slab;
        }
      }
    }
  }

  return null;
}
