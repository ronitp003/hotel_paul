import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CalendarTimeline } from "@/features/calendar/components/calendar-timeline";
import { formatIST } from "@/lib/datetime";

const mockOpenBookingModal = vi.fn();

vi.mock("@/features/bookings/context/booking-modal-context", () => ({
  useBookingModal: () => ({
    isOpen: false,
    openBookingModal: mockOpenBookingModal,
    closeBookingModal: vi.fn(),
  }),
}));

const mockCalendarData = {
  rooms: [
    {
      id: "room-101",
      number: "101",
      floor: 1,
      typeId: "standard",
      typeName: "Standard AC",
      baseRate: 2000,
      pricePerNight: 2000,
      unresolvedProblemCount: 0,
      hasOpenProblem: false,
    },
    {
      id: "room-102",
      number: "102",
      floor: 1,
      typeId: "deluxe",
      typeName: "Deluxe Suite",
      baseRate: 4000,
      pricePerNight: 4000,
      unresolvedProblemCount: 0,
      hasOpenProblem: false,
    },
  ],
  bookings: [
    {
      id: "b-1",
      reference: "BK-1001",
      roomId: "room-101",
      primaryGuestName: "Rahul Sharma",
      status: "CHECKED_IN",
      checkInAt: new Date(Date.now() - 3600000).toISOString(),
      checkOutAt: new Date(Date.now() + 86400000).toISOString(),
      balanceDue: 0,
    },
  ],
  maintenance: [],
};

// Mock fetch for calendar data
global.fetch = vi.fn().mockImplementation(() =>
  Promise.resolve({
    ok: true,
    json: () =>
      Promise.resolve({
        ok: true,
        data: mockCalendarData,
      }),
  })
);

function renderCalendar() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <CalendarTimeline
        roomTypes={[
          { id: "standard", name: "Standard AC" },
          { id: "deluxe", name: "Deluxe Suite" },
        ]}
      />
    </QueryClientProvider>
  );
}

describe("CalendarTimeline interaction & layout improvements", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("mounts and renders cleanly without triggering maximum update depth or infinite re-renders", () => {
    const { container } = renderCalendar();

    expect(screen.getByText("All Room Types")).toBeDefined();
    expect(screen.getByText("Day")).toBeDefined();
    expect(screen.getByText("Week")).toBeDefined();
    expect(screen.getByPlaceholderText(/search room/i)).toBeDefined();
    expect(container).toBeDefined();
  });

  it("opens New Booking modal when clicking an empty date cell in Week View for a specific room", async () => {
    renderCalendar();

    // In Week View (default view), find a clickable cell for room 102
    await waitFor(() => {
      expect(screen.getByText("102")).toBeInTheDocument();
    });

    const bookableCells = screen.getAllByTitle(/Click to book Room 102/i);
    expect(bookableCells.length).toBeGreaterThan(0);

    // Click first cell
    fireEvent.click(bookableCells[0]!);

    expect(mockOpenBookingModal).toHaveBeenCalledTimes(1);
    const callArgs = mockOpenBookingModal.mock.calls[0]![0];
    expect(callArgs.preselectedRoomId).toBe("room-102");
    expect(callArgs.checkIn).toBeInstanceOf(Date);
    expect(callArgs.checkOut).toBeInstanceOf(Date);
    // Verify 24-hour stay calculation logic
    const durationHours =
      (callArgs.checkOut.getTime() - callArgs.checkIn.getTime()) / (1000 * 60 * 60);
    expect(durationHours).toBeCloseTo(24, 1);
  });

  it("opens New Booking modal when clicking a date column header in Week View", async () => {
    renderCalendar();

    await waitFor(() => {
      expect(screen.getByText("101")).toBeInTheDocument();
    });

    const headerDateCols = screen.getAllByTitle(/Click to book for/i);
    expect(headerDateCols.length).toBe(7);

    fireEvent.click(headerDateCols[0]!);

    expect(mockOpenBookingModal).toHaveBeenCalledTimes(1);
    const callArgs = mockOpenBookingModal.mock.calls[0]![0];
    expect(callArgs.preselectedRoomId).toBeUndefined();
    expect(callArgs.checkIn).toBeInstanceOf(Date);
    expect(callArgs.checkOut).toBeInstanceOf(Date);
  });

  it("opens New Booking modal when clicking a date block in Month View", async () => {
    renderCalendar();

    // Switch to Month view
    fireEvent.click(screen.getByRole("button", { name: "Month" }));

    // Find date blocks
    const monthCells = await screen.findAllByTitle(/Click to book on/i);
    expect(monthCells.length).toBeGreaterThanOrEqual(28);

    // Click on a date block (not the View Day button)
    fireEvent.click(monthCells[10]!);

    expect(mockOpenBookingModal).toHaveBeenCalledTimes(1);
    const callArgs = mockOpenBookingModal.mock.calls[0]![0];
    expect(callArgs.checkIn).toBeInstanceOf(Date);
    expect(callArgs.checkOut).toBeInstanceOf(Date);
    // Default 24h stay logic
    const diffHours =
      (callArgs.checkOut.getTime() - callArgs.checkIn.getTime()) / (1000 * 60 * 60);
    expect(diffHours).toBeCloseTo(24, 1);
  });

  it("switches to Day View when clicking 'View Day' without opening booking modal", async () => {
    renderCalendar();

    // Switch to Month view
    fireEvent.click(screen.getByRole("button", { name: "Month" }));

    const viewDayButtons = await screen.findAllByRole("button", {
      name: /View Day/i,
    });
    expect(viewDayButtons.length).toBeGreaterThanOrEqual(28);

    // Click "View Day" on a date cell
    fireEvent.click(viewDayButtons[0]!);

    // Booking modal must NOT have been opened
    expect(mockOpenBookingModal).not.toHaveBeenCalled();

    // Should now be in Day View (shows Day button as active)
    expect(screen.getByRole("button", { name: "Day" })).toHaveClass("font-bold");
  });

  it("passes selected hour time, room, and date to New Booking modal when clicking an empty hour slot in Day View", async () => {
    renderCalendar();

    // Switch to Day View
    fireEvent.click(screen.getByRole("button", { name: "Day" }));

    await waitFor(() => {
      expect(screen.getByText("102")).toBeInTheDocument();
    });

    // Find the 2:00 PM (14:00) cell for Room 102
    const cell14 = screen.getByTitle("Book Room 102 at 14:00");
    expect(cell14).toBeInTheDocument();

    fireEvent.click(cell14);

    expect(mockOpenBookingModal).toHaveBeenCalledTimes(1);
    const callArgs = mockOpenBookingModal.mock.calls[0]![0];
    expect(callArgs.preselectedRoomId).toBe("room-102");
    expect(callArgs.checkIn).toBeInstanceOf(Date);
    expect(callArgs.checkOut).toBeInstanceOf(Date);

    // Verify time is explicitly 14:00 (2:00 PM) in IST
    expect(formatIST(callArgs.checkIn, "HH:mm")).toBe("14:00");
    expect(formatIST(callArgs.checkOut, "HH:mm")).toBe("14:00");

    // Checkout must default to 24 hours later (1-day default)
    const diffHours =
      (callArgs.checkOut.getTime() - callArgs.checkIn.getTime()) / (1000 * 60 * 60);
    expect(diffHours).toBeCloseTo(24, 1);
  });

  it("passes selected hour time to New Booking modal when clicking an hour header in Day View", async () => {
    renderCalendar();

    // Switch to Day View
    fireEvent.click(screen.getByRole("button", { name: "Day" }));

    await waitFor(() => {
      expect(screen.getByText("101")).toBeInTheDocument();
    });

    // Find the 2:00 PM (14:00) column header in Day View
    const headerCol14 = screen.getByTitle("Click to book at 14:00");
    expect(headerCol14).toBeInTheDocument();

    fireEvent.click(headerCol14);

    expect(mockOpenBookingModal).toHaveBeenCalledTimes(1);
    const callArgs = mockOpenBookingModal.mock.calls[0]![0];
    expect(callArgs.preselectedRoomId).toBeUndefined();
    expect(callArgs.checkIn).toBeInstanceOf(Date);
    expect(callArgs.checkOut).toBeInstanceOf(Date);

    // Verify time is explicitly 14:00 in IST
    expect(formatIST(callArgs.checkIn, "HH:mm")).toBe("14:00");
    expect(formatIST(callArgs.checkOut, "HH:mm")).toBe("14:00");
  });
});
