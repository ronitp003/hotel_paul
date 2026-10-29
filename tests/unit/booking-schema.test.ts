import { describe, it, expect } from "vitest";
import { newBookingSchema } from "@/features/bookings/schemas";

describe("Phase 1.5: Booking Schema Validation (Unit)", () => {
  const baseValid = {
    roomId: "room-cuid-101",
    checkInAt: new Date("2026-11-01T10:00:00.000Z"),
    checkOutAt: new Date("2026-11-02T10:00:00.000Z"),
    action: "RESERVE" as const,
    source: "WALK_IN" as const,
    rateApplied: 2500,
    discount: 0,
    advanceAmount: 0,
    guests: [
      {
        name: "Abhirup Sen",
        fatherName: "B. Sen",
        age: 32,
        sex: "MALE" as const,
        mobile: "+91 98300 12345",
        isPrimary: true,
      },
    ],
  };

  it("passes validation with valid minimum required fields", () => {
    const parsed = newBookingSchema.safeParse(baseValid);
    expect(parsed.success).toBe(true);
  });

  it("fails when checkOutAt is equal to checkInAt", () => {
    const invalid = {
      ...baseValid,
      checkOutAt: baseValid.checkInAt,
    };
    const parsed = newBookingSchema.safeParse(invalid);
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0]?.message).toMatch(
        /Check-out time must be strictly after check-in time/i
      );
    }
  });

  it("fails when checkOutAt is before checkInAt", () => {
    const invalid = {
      ...baseValid,
      checkOutAt: new Date("2026-10-31T10:00:00.000Z"),
    };
    const parsed = newBookingSchema.safeParse(invalid);
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0]?.message).toMatch(
        /Check-out time must be strictly after check-in time/i
      );
    }
  });

  it("fails when no guests are provided", () => {
    const invalid = {
      ...baseValid,
      guests: [],
    };
    const parsed = newBookingSchema.safeParse(invalid);
    expect(parsed.success).toBe(false);
  });

  it("fails when multiple guests are provided but none is marked as primary", () => {
    const invalid = {
      ...baseValid,
      guests: [
        { name: "Guest One", isPrimary: false },
        { name: "Guest Two", isPrimary: false },
      ],
    };
    const parsed = newBookingSchema.safeParse(invalid);
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0]?.message).toMatch(
        /At least one primary guest is required/i
      );
    }
  });

  it("fails when advance payment is greater than 0 but no payment mode is selected", () => {
    const invalid = {
      ...baseValid,
      advanceAmount: 1000,
      advanceMode: null,
    };
    const parsed = newBookingSchema.safeParse(invalid);
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0]?.message).toMatch(
        /Please select payment mode for advance payment/i
      );
    }
  });

  it("succeeds when advance payment is provided along with valid payment mode", () => {
    const valid = {
      ...baseValid,
      advanceAmount: 1000,
      advanceMode: "UPI" as const,
    };
    const parsed = newBookingSchema.safeParse(valid);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.advanceAmount).toBe(1000);
      expect(parsed.data.advanceMode).toBe("UPI");
    }
  });

  it("accepts multiple guests with at least one primary guest", () => {
    const valid = {
      ...baseValid,
      guests: [
        { name: "Primary Guest", isPrimary: true, mobile: "9876543210" },
        { name: "Second Guest", isPrimary: false, age: 28 },
      ],
    };
    const parsed = newBookingSchema.safeParse(valid);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.guests.length).toBe(2);
    }
  });

  it("accepts valid corporate details", () => {
    const valid = {
      ...baseValid,
      companyName: "Acme Corp Ltd",
      companyGstin: "19AAAAA0000A1Z5",
      companyAddress: "Sector V, Salt Lake, Kolkata",
    };
    const parsed = newBookingSchema.safeParse(valid);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.companyName).toBe("Acme Corp Ltd");
      expect(parsed.data.companyGstin).toBe("19AAAAA0000A1Z5");
    }
  });
});
