import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { BookingsTable, type BookingRow } from "@/features/bookings/components/bookings-table";
import { toast } from "sonner";

// Mock next/navigation
const mockPush = vi.fn();
const mockRefresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    refresh: mockRefresh,
  }),
}));

// Mock sonner
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock billing action for CheckoutDialog
vi.mock("@/server/actions/billing.actions", () => ({
  getBookingBillAction: vi.fn().mockResolvedValue({
    ok: true,
    data: {
      bill: { roomCharges: 1800, totalCharges: 1800, totalPaid: 500, balanceDue: 1300 },
      booking: { status: "CHECKED_IN", checkInAt: new Date(), checkOutAt: new Date(), guests: [] },
      stay: { days: 2, hours: 48, minutes: 0 },
      charges: [],
      payments: [],
      groupRooms: [],
    },
  }),
}));

const mockSingleCheckedOutBooking: BookingRow = {
  id: "booking-1",
  reference: "HP-261103-1001",
  roomId: "room-101",
  roomNumber: "101",
  roomTypeName: "Deluxe AC",
  status: "CHECKED_OUT",
  source: "WALK_IN",
  checkInAt: new Date("2026-11-01T10:00:00Z"),
  checkOutAt: new Date("2026-11-03T10:00:00Z"),
  actualCheckInAt: new Date("2026-11-01T10:00:00Z"),
  actualCheckOutAt: new Date("2026-11-03T10:00:00Z"),
  guestName: "Rajesh Kumar",
  guestMobile: "9876543210",
  rateApplied: 2500,
  advancePaid: 1000,
  invoiceId: "inv-1001",
  invoiceDisplayNo: "INV-2026-0001",
};

const mockSingleCheckedInBooking: BookingRow = {
  id: "booking-2",
  reference: "HP-261103-1002",
  roomId: "room-102",
  roomNumber: "102",
  roomTypeName: "Standard Non-AC",
  status: "CHECKED_IN",
  source: "PHONE",
  checkInAt: new Date("2026-11-02T10:00:00Z"),
  checkOutAt: new Date("2026-11-04T10:00:00Z"),
  actualCheckInAt: new Date("2026-11-02T10:00:00Z"),
  actualCheckOutAt: null,
  guestName: "Priya Sharma",
  guestMobile: "9123456780",
  rateApplied: 1800,
  advancePaid: 500,
  invoiceId: null,
  invoiceDisplayNo: null,
};

const mockGroupCheckedOutBooking: BookingRow = {
  id: "booking-3",
  reference: "HP-261103-1003",
  roomId: "room-103",
  roomNumber: "103, 104",
  roomTypeName: "Multiple Categories",
  status: "CHECKED_OUT",
  source: "DIRECT",
  checkInAt: new Date("2026-11-01T10:00:00Z"),
  checkOutAt: new Date("2026-11-03T10:00:00Z"),
  actualCheckInAt: new Date("2026-11-01T10:00:00Z"),
  actualCheckOutAt: new Date("2026-11-03T10:00:00Z"),
  guestName: "Amitabh Ghosh",
  guestMobile: "9988776655",
  rateApplied: 5000,
  advancePaid: 2000,
  groupBookingId: "grp-999",
  isGroupMaster: true,
  groupRoomNumbers: ["103", "104"],
  groupRoomCount: 2,
  invoiceId: "inv-grp-999",
  invoiceDisplayNo: "INV-2026-0002",
};

describe("BookingsTable UX Improvements", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      blob: () => Promise.resolve(new Blob(["mock-pdf"], { type: "application/pdf" })),
    });
    // Mock URL.createObjectURL and URL.revokeObjectURL
    window.URL.createObjectURL = vi.fn().mockReturnValue("blob:http://localhost/test");
    window.URL.revokeObjectURL = vi.fn();
  });

  it("1. Removes Booking Reference column from table header", () => {
    render(
      <BookingsTable
        initialBookings={[mockSingleCheckedOutBooking, mockSingleCheckedInBooking]}
        total={2}
      />
    );

    // There should be no column header with "Reference"
    const referenceHeader = screen.queryByRole("columnheader", { name: /reference/i });
    expect(referenceHeader).toBeNull();

    // Verify remaining column headers are present
    expect(screen.getByRole("columnheader", { name: /room/i })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /primary guest/i })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /check-in \/ check-out/i })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /status/i })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /tariff/i })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /advance paid/i })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /actions/i })).toBeInTheDocument();
  });

  it("2. Makes the entire booking row clickable to navigate to booking details", () => {
    render(
      <BookingsTable
        initialBookings={[mockSingleCheckedOutBooking]}
        total={1}
      />
    );

    const row = screen.getByRole("link", {
      name: /view booking for rajesh kumar, room 101/i,
    });
    expect(row).toBeInTheDocument();
    expect(row).toHaveClass("cursor-pointer");

    // Click anywhere on the row
    fireEvent.click(row);
    expect(mockPush).toHaveBeenCalledWith("/bookings/booking-1");
  });

  it("3. Supports keyboard navigation on the clickable row (Enter / Space)", () => {
    render(
      <BookingsTable
        initialBookings={[mockSingleCheckedOutBooking]}
        total={1}
      />
    );

    const row = screen.getByRole("link", {
      name: /view booking for rajesh kumar, room 101/i,
    });

    fireEvent.keyDown(row, { key: "Enter" });
    expect(mockPush).toHaveBeenCalledWith("/bookings/booking-1");

    mockPush.mockClear();
    fireEvent.keyDown(row, { key: " " });
    expect(mockPush).toHaveBeenCalledWith("/bookings/booking-1");
  });

  it("4. Shows ONLY Download Invoice button for checked-out booking and hides Check Out button", async () => {
    render(
      <BookingsTable
        initialBookings={[mockSingleCheckedOutBooking]}
        total={1}
      />
    );

    // Verify "Details" link is gone
    expect(screen.queryByRole("link", { name: /^details$/i })).toBeNull();

    // Verify "Check Out" button is NOT present
    expect(screen.queryByRole("button", { name: /check out/i })).toBeNull();

    // Find the Download Invoice button
    const downloadBtn = screen.getByRole("button", { name: /invoice/i });
    expect(downloadBtn).toBeInTheDocument();
    expect(downloadBtn).not.toBeDisabled();

    // Clicking the Download Invoice button
    fireEvent.click(downloadBtn);

    // Ensure row navigation was NOT triggered
    expect(mockPush).not.toHaveBeenCalled();

    // Verify invoice PDF was fetched directly
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith("/api/invoices/inv-1001/pdf");
      expect(window.URL.createObjectURL).toHaveBeenCalled();
      expect(toast.success).toHaveBeenCalledWith("Invoice INV-2026-0001 downloaded successfully.");
    });
  });

  it("5. Shows ONLY Check Out button for checked-in booking and hides Invoice button", async () => {
    render(
      <BookingsTable
        initialBookings={[mockSingleCheckedInBooking]}
        total={1}
      />
    );

    // For CHECKED_IN stay, Download Invoice button must NOT be present
    expect(screen.queryByRole("button", { name: /invoice/i })).toBeNull();

    // Check Out button should be present and enabled for CHECKED_IN
    const checkOutBtn = screen.getByRole("button", { name: /check out/i });
    expect(checkOutBtn).toBeInTheDocument();
    expect(checkOutBtn).not.toBeDisabled();

    // Clicking Check Out button does NOT trigger row navigation
    await waitFor(() => {
      fireEvent.click(checkOutBtn);
    });
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("6. Supports group bookings: renders room badges and downloads consolidated group invoice", async () => {
    render(
      <BookingsTable
        initialBookings={[mockGroupCheckedOutBooking]}
        total={1}
      />
    );

    // Room numbers 103 and 104 badges should be rendered
    expect(screen.getByText("103")).toBeInTheDocument();
    expect(screen.getByText("104")).toBeInTheDocument();
    expect(screen.getByText(/group \(2\)/i)).toBeInTheDocument();

    // For CHECKED_OUT group booking, only Invoice button is present
    expect(screen.queryByRole("button", { name: /check out/i })).toBeNull();

    const downloadBtn = screen.getByRole("button", { name: /invoice/i });
    expect(downloadBtn).not.toBeDisabled();

    fireEvent.click(downloadBtn);
    expect(mockPush).not.toHaveBeenCalled();

    await waitFor(() => {
      // Group booking invoice ID should be used
      expect(global.fetch).toHaveBeenCalledWith("/api/invoices/inv-grp-999/pdf");
      expect(toast.success).toHaveBeenCalledWith("Invoice INV-2026-0002 downloaded successfully.");
    });
  });

  it("7. Immediately transitions button from Check Out to Invoice upon successful checkout", async () => {
    render(
      <BookingsTable
        initialBookings={[mockSingleCheckedInBooking]}
        total={1}
      />
    );

    // Before checkout: Only Check Out button is present
    const checkOutBtn = screen.getByRole("button", { name: /check out/i });
    expect(checkOutBtn).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /invoice/i })).toBeNull();

    // Click Check Out button to open dialog
    await waitFor(() => {
      fireEvent.click(checkOutBtn);
    });

    // The dialog should be open
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
