import { describe, it, expect } from "vitest";
import { calculateStay, doIntervalsOverlap } from "@/server/services/billing.service";
import { evaluateRoomAvailability } from "@/server/services/room.service";
import { AppError } from "@/lib/errors";
import { BookingStatus, ProblemStatus } from "@prisma/client";

describe("Phase 1.4: Stay Calculation & Availability Logic (Unit)", () => {
  describe("calculateStay - 24-hour day billing logic", () => {
    const baseCheckIn = new Date("2026-11-01T10:00:00.000Z");

    it("calculates minimum 1 day for stays under 24 hours (1 hour stay)", () => {
      const checkOut = new Date("2026-11-01T11:00:00.000Z");
      const result = calculateStay(baseCheckIn, checkOut, 0);

      expect(result.days).toBe(1);
      expect(result.hours).toBe(1);
      expect(result.minutes).toBe(60);
      expect(result.isGracePeriodApplied).toBe(false);
    });

    it("calculates minimum 1 day for a 12-hour stay", () => {
      const checkOut = new Date("2026-11-01T22:00:00.000Z");
      const result = calculateStay(baseCheckIn, checkOut, 0);

      expect(result.days).toBe(1);
      expect(result.hours).toBe(12);
      expect(result.minutes).toBe(720);
      expect(result.isGracePeriodApplied).toBe(false);
    });

    it("calculates exactly 1 day for an exact 24-hour stay", () => {
      const checkOut = new Date("2026-11-02T10:00:00.000Z");
      const result = calculateStay(baseCheckIn, checkOut, 0);

      expect(result.days).toBe(1);
      expect(result.hours).toBe(24);
      expect(result.minutes).toBe(1440);
      expect(result.isGracePeriodApplied).toBe(false);
    });

    it("rolls over to 2 days for 24 hours + 1 minute when grace is 0", () => {
      const checkOut = new Date("2026-11-02T10:01:00.000Z");
      const result = calculateStay(baseCheckIn, checkOut, 0);

      expect(result.days).toBe(2);
      expect(result.isGracePeriodApplied).toBe(false);
    });

    it("calculates exactly 2 days for a 48-hour stay", () => {
      const checkOut = new Date("2026-11-03T10:00:00.000Z");
      const result = calculateStay(baseCheckIn, checkOut, 0);

      expect(result.days).toBe(2);
      expect(result.hours).toBe(48);
      expect(result.isGracePeriodApplied).toBe(false);
    });

    it("rolls over to 3 days for 48 hours + 1 minute when grace is 0", () => {
      const checkOut = new Date("2026-11-03T10:01:00.000Z");
      const result = calculateStay(baseCheckIn, checkOut, 0);

      expect(result.days).toBe(3);
      expect(result.isGracePeriodApplied).toBe(false);
    });
  });

  describe("calculateStay - Grace period absorption", () => {
    const baseCheckIn = new Date("2026-11-01T10:00:00.000Z");
    const graceMinutes = 30; // 30 minutes grace period

    it("absorbs 15 minutes over 24h: days remain 1 and isGracePeriodApplied is true", () => {
      const checkOut = new Date("2026-11-02T10:15:00.000Z"); // 24h 15m
      const result = calculateStay(baseCheckIn, checkOut, graceMinutes);

      expect(result.days).toBe(1);
      expect(result.graceMinutes).toBe(30);
      expect(result.isGracePeriodApplied).toBe(true);
    });

    it("absorbs exactly 30 minutes over 24h (boundary): days remain 1", () => {
      const checkOut = new Date("2026-11-02T10:30:00.000Z"); // 24h 30m
      const result = calculateStay(baseCheckIn, checkOut, graceMinutes);

      expect(result.days).toBe(1);
      expect(result.isGracePeriodApplied).toBe(true);
    });

    it("rolls over to 2 days when extra time exceeds grace period (24h 31m)", () => {
      const checkOut = new Date("2026-11-02T10:31:00.000Z"); // 24h 31m
      const result = calculateStay(baseCheckIn, checkOut, graceMinutes);

      expect(result.days).toBe(2);
      expect(result.isGracePeriodApplied).toBe(false);
    });

    it("absorbs 20 minutes over 48h: days remain 2 and isGracePeriodApplied is true", () => {
      const checkOut = new Date("2026-11-03T10:20:00.000Z"); // 48h 20m
      const result = calculateStay(baseCheckIn, checkOut, graceMinutes);

      expect(result.days).toBe(2);
      expect(result.isGracePeriodApplied).toBe(true);
    });

    it("rolls over to 3 days when 48h exceeds grace period (48h 45m)", () => {
      const checkOut = new Date("2026-11-03T10:45:00.000Z"); // 48h 45m
      const result = calculateStay(baseCheckIn, checkOut, graceMinutes);

      expect(result.days).toBe(3);
      expect(result.isGracePeriodApplied).toBe(false);
    });

    it("never reduces days below 1 even if short stay with grace period", () => {
      const checkOut = new Date("2026-11-01T10:20:00.000Z"); // 20m stay
      const result = calculateStay(baseCheckIn, checkOut, graceMinutes);

      expect(result.days).toBe(1);
      expect(result.isGracePeriodApplied).toBe(false);
    });

    it("handles string and timestamp inputs identically", () => {
      const resStr = calculateStay("2026-11-01T10:00:00Z", "2026-11-02T10:00:00Z", 0);
      const resNum = calculateStay(
        new Date("2026-11-01T10:00:00Z").getTime(),
        new Date("2026-11-02T10:00:00Z").getTime(),
        0
      );

      expect(resStr.days).toBe(1);
      expect(resNum.days).toBe(1);
      expect(resStr.elapsedMs).toBe(resNum.elapsedMs);
    });
  });

  describe("calculateStay - Validation & Error handling", () => {
    it("throws VALIDATION_ERROR when checkOut equals checkIn", () => {
      const date = new Date("2026-11-01T10:00:00.000Z");
      expect(() => calculateStay(date, date, 0)).toThrowError(AppError);
      expect(() => calculateStay(date, date, 0)).toThrowError(
        /Check-out time must be strictly after check-in time/
      );
    });

    it("throws VALIDATION_ERROR when checkOut is before checkIn", () => {
      const checkIn = new Date("2026-11-02T10:00:00.000Z");
      const checkOut = new Date("2026-11-01T10:00:00.000Z");
      expect(() => calculateStay(checkIn, checkOut, 0)).toThrowError(AppError);
      expect(() => calculateStay(checkIn, checkOut, 0)).toThrowError(
        /Check-out time must be strictly after check-in time/
      );
    });

    it("throws VALIDATION_ERROR on invalid dates", () => {
      expect(() => calculateStay("not-a-date", "2026-11-01T10:00:00Z")).toThrowError(
        /Invalid check-in or check-out date/
      );
      expect(() => calculateStay("2026-11-01T10:00:00Z", "invalid")).toThrowError(
        /Invalid check-in or check-out date/
      );
    });
  });

  describe("doIntervalsOverlap - Half-open [start, end) interval semantics", () => {
    const t1 = new Date("2026-11-01T10:00:00.000Z");
    const t2 = new Date("2026-11-01T12:00:00.000Z");
    const t3 = new Date("2026-11-01T14:00:00.000Z");

    it("allows back-to-back stays where checkout matches next check-in exactly", () => {
      // Stay A: [10:00, 12:00), Stay B: [12:00, 14:00)
      const overlaps = doIntervalsOverlap(t1, t2, t2, t3);
      expect(overlaps).toBe(false);

      // In reverse order: Stay B: [12:00, 14:00), Stay A: [10:00, 12:00)
      const overlapsReverse = doIntervalsOverlap(t2, t3, t1, t2);
      expect(overlapsReverse).toBe(false);
    });

    it("detects overlap when intervals overlap by even 1 millisecond", () => {
      const t2Plus1ms = new Date(t2.getTime() + 1);
      const overlaps = doIntervalsOverlap(t1, t2Plus1ms, t2, t3);
      expect(overlaps).toBe(true);
    });

    it("detects overlap when one interval is entirely enclosed inside another", () => {
      const outerStart = new Date("2026-11-01T08:00:00.000Z");
      const outerEnd = new Date("2026-11-01T18:00:00.000Z");
      const innerStart = new Date("2026-11-01T10:00:00.000Z");
      const innerEnd = new Date("2026-11-01T12:00:00.000Z");

      expect(doIntervalsOverlap(outerStart, outerEnd, innerStart, innerEnd)).toBe(true);
      expect(doIntervalsOverlap(innerStart, innerEnd, outerStart, outerEnd)).toBe(true);
    });

    it("returns false for completely disjoint intervals", () => {
      const earlyStart = new Date("2026-11-01T06:00:00.000Z");
      const earlyEnd = new Date("2026-11-01T08:00:00.000Z");
      const lateStart = new Date("2026-11-01T15:00:00.000Z");
      const lateEnd = new Date("2026-11-01T18:00:00.000Z");

      expect(doIntervalsOverlap(earlyStart, earlyEnd, lateStart, lateEnd)).toBe(false);
    });
  });

  describe("evaluateRoomAvailability - Room Availability Pure Derivation", () => {
    const checkIn = new Date("2026-11-01T10:00:00.000Z");
    const checkOut = new Date("2026-11-03T10:00:00.000Z"); // 2 days stay
    const stay = calculateStay(checkIn, checkOut, 0);

    const baseRoom = {
      id: "room-101",
      number: "101",
      typeId: "type-deluxe",
      type: { name: "Deluxe AC" },
      pricePerNight: 2000,
      isActive: true,
      maintenance: [],
      bookings: [],
      problems: [],
    };

    it("marks an active room with no conflicts as available with correct stay calculation", () => {
      const result = evaluateRoomAvailability(baseRoom, checkIn, checkOut, stay);

      expect(result.isAvailable).toBe(true);
      expect(result.unavailableType).toBeNull();
      expect(result.unavailableReason).toBeNull();
      expect(result.pricePerNight).toBe(2000);
      expect(result.estimatedTotal).toBe(4000); // 2000 * 2 days
      expect(result.hasProblem).toBe(false);
      expect(result.openProblemsCount).toBe(0);
    });

    it("marks a disabled room as unavailable with DISABLED type", () => {
      const disabledRoom = { ...baseRoom, isActive: false };
      const result = evaluateRoomAvailability(disabledRoom, checkIn, checkOut, stay);

      expect(result.isAvailable).toBe(false);
      expect(result.unavailableType).toBe("DISABLED");
      expect(result.unavailableReason).toBe("Room is currently disabled");
    });

    it("marks a room under maintenance as unavailable with MAINTENANCE type and reason", () => {
      const roomWithMaint = {
        ...baseRoom,
        maintenance: [
          {
            id: "maint-1",
            startsAt: new Date("2026-11-01T08:00:00.000Z"),
            endsAt: new Date("2026-11-02T14:00:00.000Z"),
            reason: "AC compressor replacement",
          },
        ],
      };

      const result = evaluateRoomAvailability(roomWithMaint, checkIn, checkOut, stay);

      expect(result.isAvailable).toBe(false);
      expect(result.unavailableType).toBe("MAINTENANCE");
      expect(result.unavailableReason).toContain("Under maintenance");
      expect(result.unavailableReason).toContain("AC compressor replacement");
      expect(result.conflictingMaintenance?.id).toBe("maint-1");
    });

    it("marks a room with an overlapping RESERVED booking as unavailable with BOOKED type", () => {
      const roomWithBooking = {
        ...baseRoom,
        bookings: [
          {
            id: "bkg-1",
            reference: "HP-2026-001",
            status: BookingStatus.RESERVED,
            checkInAt: new Date("2026-11-01T12:00:00.000Z"),
            checkOutAt: new Date("2026-11-02T12:00:00.000Z"),
            guests: [{ name: "Rajesh Sharma", isPrimary: true }],
          },
        ],
      };

      const result = evaluateRoomAvailability(roomWithBooking, checkIn, checkOut, stay);

      expect(result.isAvailable).toBe(false);
      expect(result.unavailableType).toBe("RESERVED");
      expect(result.unavailableReason).toContain("Reserved");
      expect(result.conflictingBooking?.guestName).toBe("Rajesh Sharma");
      expect(result.conflictingBooking?.reference).toBe("HP-2026-001");
    });

    it("detects booking conflict when booking is CHECKED_IN and marks BOOKED", () => {
      const roomWithCheckedIn = {
        ...baseRoom,
        bookings: [
          {
            id: "bkg-ci",
            reference: "HP-2026-CI",
            status: BookingStatus.CHECKED_IN,
            checkInAt: new Date("2026-11-01T12:00:00.000Z"),
            checkOutAt: new Date("2026-11-02T12:00:00.000Z"),
            guests: [{ name: "Pooja Banerjee", isPrimary: true }],
          },
        ],
      };

      const result = evaluateRoomAvailability(roomWithCheckedIn, checkIn, checkOut, stay);

      expect(result.isAvailable).toBe(false);
      expect(result.unavailableType).toBe("BOOKED");
      expect(result.unavailableReason).toContain("Booked");
      expect(result.conflictingBooking?.guestName).toBe("Pooja Banerjee");
    });

    it("allows back-to-back stays without collision", () => {
      // Existing booking ends exactly at requested check-in (10:00 AM)
      const roomWithPastBooking = {
        ...baseRoom,
        bookings: [
          {
            id: "bkg-past",
            reference: "HP-2026-PAST",
            status: BookingStatus.CHECKED_IN,
            checkInAt: new Date("2026-10-30T10:00:00.000Z"),
            checkOutAt: new Date("2026-11-01T10:00:00.000Z"), // Matches checkIn exactly
            guests: [{ name: "Prior Guest", isPrimary: true }],
          },
        ],
      };

      const result = evaluateRoomAvailability(roomWithPastBooking, checkIn, checkOut, stay);
      expect(result.isAvailable).toBe(true);
      expect(result.conflictingBooking).toBeNull();
    });

    it("does not block availability for CANCELLED bookings in the same window", () => {
      const roomWithCancelled = {
        ...baseRoom,
        bookings: [
          {
            id: "bkg-cancelled",
            reference: "HP-2026-CANCELLED",
            status: BookingStatus.CANCELLED,
            checkInAt: checkIn,
            checkOutAt: checkOut,
            guests: [{ name: "Cancelled Guest", isPrimary: true }],
          },
        ],
      };

      const result = evaluateRoomAvailability(roomWithCancelled, checkIn, checkOut, stay);
      expect(result.isAvailable).toBe(true);
      expect(result.conflictingBooking).toBeNull();
    });

    it("flags open problems with warning but keeps room available for booking", () => {
      const roomWithProblem = {
        ...baseRoom,
        problems: [
          {
            id: "prob-1",
            status: ProblemStatus.OPEN,
          },
        ],
      };

      const result = evaluateRoomAvailability(roomWithProblem, checkIn, checkOut, stay);

      expect(result.isAvailable).toBe(true);
      expect(result.hasProblem).toBe(true);
      expect(result.openProblemsCount).toBe(1);
    });
  });
});
