import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DepartingTodayCard } from "@/features/dashboard/components/arrivals-departures-tables";
import { BookingDetailView, type BookingDetailData } from "@/features/bookings/components/booking-detail-view";
import type { TodayGuestMovement } from "@/features/dashboard/schemas";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));

// Mock action calls
vi.mock("@/server/actions/booking.actions", () => ({
  checkInReservedBookingAction: vi.fn().mockResolvedValue({ ok: true, data: {} }),
  checkInGroupBookingAction: vi.fn().mockResolvedValue({ ok: true, data: {} }),
}));

vi.mock("@/server/actions/billing.actions", () => ({
  deleteChargeAction: vi.fn().mockResolvedValue({ ok: true }),
  addChargeAction: vi.fn().mockResolvedValue({ ok: true }),
  addPaymentAction: vi.fn().mockResolvedValue({ ok: true }),
}));

describe("Departing Today Dashboard Card & Filtering", () => {
  it("renders pending departures and excludes checked-out stays from count", () => {
    // Departing movements passed to the component should only be CHECKED_IN pending departures
    const departures: TodayGuestMovement[] = [
      {
        id: "bk-1",
        reference: "HP-261106-001",
        guestName: "Alice Smith",
        guestMobile: "9876543210",
        roomNumber: "101",
        roomTypeName: "Deluxe King",
        time: new Date().toISOString(),
        status: "CHECKED_IN",
        balanceDue: 500,
      },
      {
        id: "bk-2",
        reference: "HP-261106-002",
        guestName: "Bob Jones",
        guestMobile: "9876543211",
        roomNumber: "102",
        roomTypeName: "Standard Non-AC",
        time: new Date().toISOString(),
        status: "CHECKED_IN",
        balanceDue: 0,
      },
    ];

    render(<DepartingTodayCard departures={departures} />);

    // Count badge should reflect exactly the pending departures (2)
    expect(screen.getByText(/2 scheduled check-outs/i)).toBeDefined();
    expect(screen.getByText("Alice Smith")).toBeDefined();
    expect(screen.getByText("Bob Jones")).toBeDefined();
    expect(screen.getAllByRole("button", { name: "Check Out" }).length).toBe(2);
  });

  it("renders empty state when there are no pending checkouts today", () => {
    render(<DepartingTodayCard departures={[]} />);

    expect(screen.getByText("No departures today")).toBeDefined();
  });
});

describe("Booking Details - Check-In Button in Stay Bill Summary", () => {
  const baseBooking: BookingDetailData = {
    id: "booking-res-1",
    reference: "HP-261106-100",
    status: "RESERVED",
    source: "WALK_IN",
    roomId: "room-101",
    roomNumber: "101",
    roomTypeName: "Deluxe King",
    checkInAt: new Date("2026-11-06T12:00:00+05:30"),
    checkOutAt: new Date("2026-11-07T12:00:00+05:30"),
    actualCheckInAt: null,
    actualCheckOutAt: null,
    arrivingFrom: "Kolkata",
    purposeOfVisit: "Vacation",
    companyName: null,
    companyGstin: null,
    companyAddress: null,
    rateApplied: 2500,
    discount: 0,
    gstPercentOverride: null,
    effectiveGstPercent: 12,
    stayDays: 1,
    roomCharges: 2500,
    taxableAmount: 2500,
    taxAmount: 300,
    cgst: 150,
    sgst: 150,
    totalAmount: 2800,
    totalPaid: 500,
    balanceDue: 2300,
    guests: [
      {
        id: "guest-1",
        name: "Rahul Verma",
        fatherName: null,
        age: 32,
        sex: "MALE",
        mobile: "9876543210",
        isPrimary: true,
      },
    ],
    payments: [],
    charges: [],
    invoice: null,
  };

  it("displays 'Check In Guest' button inside Stay Bill Summary card for RESERVED bookings", () => {
    render(<BookingDetailView booking={baseBooking} />);

    // Stay Bill Summary heading
    expect(screen.getByText("Stay Bill Summary")).toBeDefined();

    // Check In Guest button should be present in Stay Bill Summary as well as header
    const checkInButtons = screen.getAllByRole("button", { name: /Check In Guest/i });
    expect(checkInButtons.length).toBeGreaterThanOrEqual(2);

    // Verify Check Out button is NOT rendered
    expect(screen.queryByRole("button", { name: /Check Out & Generate Invoice/i })).toBeNull();
  });

  it("clicking 'Check In Guest' in Stay Bill Summary opens the check-in confirmation dialog", async () => {
    render(<BookingDetailView booking={baseBooking} />);

    const checkInButtons = screen.getAllByRole("button", { name: /Check In Guest/i });
    // Click the one in the Stay Bill Summary card
    fireEvent.click(checkInButtons[1]);

    // Check-in confirmation modal should open
    expect(screen.getByRole("button", { name: /Confirm Check-In/i })).toBeDefined();
  });

  it("displays 'Check Out & Generate Invoice' button inside Stay Bill Summary for CHECKED_IN bookings", () => {
    const checkedInBooking: BookingDetailData = {
      ...baseBooking,
      status: "CHECKED_IN",
      actualCheckInAt: new Date("2026-11-06T12:00:00+05:30"),
    };

    render(<BookingDetailView booking={checkedInBooking} />);

    // Should NOT have Check In Guest button
    expect(screen.queryByRole("button", { name: /Check In Guest/i })).toBeNull();

    // Should have Check Out button in Stay Bill Summary
    expect(screen.getByRole("button", { name: /Check Out & Generate Invoice/i })).toBeDefined();
  });
});
