import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { RoomDetailsView } from "@/features/rooms/components/room-details-view";
import type { RoomDetailsData } from "@/server/services/room-maintenance.service";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));

// Mock sonner
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

function createMockBooking(idx: number) {
  const pad = String(idx).padStart(3, "0");
  return {
    id: `booking-${pad}`,
    reference: `HP-261104-${pad}`,
    status: "CHECKED_OUT" as const,
    primaryGuestName: `Guest ${idx}`,
    primaryGuestMobile: `9876543${pad}`,
    checkInAt: new Date(2026, 10, 1, 10, 0),
    checkOutAt: new Date(2026, 10, 2, 10, 0),
    actualCheckInAt: new Date(2026, 10, 1, 10, 0),
    actualCheckOutAt: new Date(2026, 10, 2, 10, 0),
    rateApplied: 2500,
    totalPaid: 2500,
  };
}

function createMockRoomDetails(
  roomId: string,
  roomNumber: string,
  bookingsCount: number
): RoomDetailsData {
  return {
    room: {
      id: roomId,
      number: roomNumber,
      typeId: "type-deluxe",
      typeName: "Deluxe King",
      pricePerNight: 2500,
      isActive: true,
      createdAt: new Date(),
    },
    derivedStatus: {
      status: "AVAILABLE",
      hasProblem: false,
      openProblemsCount: 0,
      maintenanceReason: null,
    },
    currentBooking: null,
    openProblems: [],
    resolvedProblems: [],
    activeMaintenance: [],
    pastMaintenance: [],
    recentBookings: Array.from({ length: bookingsCount }, (_, i) =>
      createMockBooking(i + 1)
    ),
  };
}

describe("Recent Room History – Pagination", () => {
  it("displays a maximum of 5 records per page and renders pagination controls", () => {
    const mockData = createMockRoomDetails("room-101", "101", 12);
    render(<RoomDetailsView initialData={mockData} />);

    // Header displays total count
    expect(screen.getByText("Recent Room History (12)")).toBeInTheDocument();

    // Page 1 should display records 1 through 5
    expect(screen.getByText("HP-261104-001")).toBeInTheDocument();
    expect(screen.getByText("Guest 1")).toBeInTheDocument();
    expect(screen.getByText("HP-261104-005")).toBeInTheDocument();
    expect(screen.getByText("Guest 5")).toBeInTheDocument();

    // Records 6 through 12 should NOT be on Page 1
    expect(screen.queryByText("HP-261104-006")).not.toBeInTheDocument();
    expect(screen.queryByText("Guest 6")).not.toBeInTheDocument();

    // Shows current page and total records
    expect(
      screen.getByText(
        (_, el) =>
          el?.tagName === "SPAN" &&
          el?.textContent?.replace(/\s+/g, " ").trim() ===
            "Showing 1 – 5 of 12 records"
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        (_, el) =>
          el?.tagName === "SPAN" &&
          el?.textContent?.replace(/\s+/g, " ").trim() === "Page 1 of 3"
      )
    ).toBeInTheDocument();

    // Previous should be disabled on the first page, Next should be enabled
    const prevButton = screen.getByRole("button", { name: /Previous Page/i });
    const nextButton = screen.getByRole("button", { name: /Next Page/i });
    expect(prevButton).toBeDisabled();
    expect(nextButton).toBeEnabled();

    // Page number buttons (1, 2, 3) should be present
    expect(screen.getByRole("button", { name: "Page 1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Page 2" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Page 3" })).toBeInTheDocument();
  });

  it("navigates forward and backward with Next, Previous, and direct page numbers", () => {
    const mockData = createMockRoomDetails("room-101", "101", 12);
    render(<RoomDetailsView initialData={mockData} />);

    const prevButton = screen.getByRole("button", { name: /Previous Page/i });
    const nextButton = screen.getByRole("button", { name: /Next Page/i });

    // Navigate to Page 2 using Next
    fireEvent.click(nextButton);

    expect(
      screen.getByText(
        (_, el) =>
          el?.tagName === "SPAN" &&
          el?.textContent?.replace(/\s+/g, " ").trim() ===
            "Showing 6 – 10 of 12 records"
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        (_, el) =>
          el?.tagName === "SPAN" &&
          el?.textContent?.replace(/\s+/g, " ").trim() === "Page 2 of 3"
      )
    ).toBeInTheDocument();

    // Records 6 to 10 are visible, records 1 to 5 and 11 to 12 are not
    expect(screen.getByText("HP-261104-006")).toBeInTheDocument();
    expect(screen.getByText("Guest 6")).toBeInTheDocument();
    expect(screen.getByText("HP-261104-010")).toBeInTheDocument();
    expect(screen.getByText("Guest 10")).toBeInTheDocument();
    expect(screen.queryByText("HP-261104-005")).not.toBeInTheDocument();
    expect(screen.queryByText("HP-261104-011")).not.toBeInTheDocument();

    // Both Prev and Next should be enabled on Page 2
    expect(prevButton).toBeEnabled();
    expect(nextButton).toBeEnabled();

    // Navigate to Page 3 using direct page button
    const page3Button = screen.getByRole("button", { name: "Page 3" });
    fireEvent.click(page3Button);

    expect(
      screen.getByText(
        (_, el) =>
          el?.tagName === "SPAN" &&
          el?.textContent?.replace(/\s+/g, " ").trim() ===
            "Showing 11 – 12 of 12 records"
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        (_, el) =>
          el?.tagName === "SPAN" &&
          el?.textContent?.replace(/\s+/g, " ").trim() === "Page 3 of 3"
      )
    ).toBeInTheDocument();

    // Records 11 and 12 are visible
    expect(screen.getByText("HP-261104-011")).toBeInTheDocument();
    expect(screen.getByText("Guest 11")).toBeInTheDocument();
    expect(screen.getByText("HP-261104-012")).toBeInTheDocument();
    expect(screen.getByText("Guest 12")).toBeInTheDocument();

    // On the last page: Next must be disabled, Previous enabled
    expect(prevButton).toBeEnabled();
    expect(nextButton).toBeDisabled();

    // Navigate back to Page 2 using Previous button
    fireEvent.click(prevButton);
    expect(
      screen.getByText(
        (_, el) =>
          el?.tagName === "SPAN" &&
          el?.textContent?.replace(/\s+/g, " ").trim() ===
            "Showing 6 – 10 of 12 records"
      )
    ).toBeInTheDocument();
    expect(screen.getByText("HP-261104-006")).toBeInTheDocument();
  });

  it("resets pagination to page 1 when switching rooms", () => {
    const roomA = createMockRoomDetails("room-101", "101", 12);
    const { rerender } = render(<RoomDetailsView initialData={roomA} />);

    // Move to page 2 on Room 101
    const nextButton = screen.getByRole("button", { name: /Next Page/i });
    fireEvent.click(nextButton);
    expect(
      screen.getByText(
        (_, el) =>
          el?.tagName === "SPAN" &&
          el?.textContent?.replace(/\s+/g, " ").trim() === "Page 2 of 3"
      )
    ).toBeInTheDocument();
    expect(screen.getByText("HP-261104-006")).toBeInTheDocument();

    // Switch to Room 102
    const roomB = createMockRoomDetails("room-102", "102", 8);
    rerender(<RoomDetailsView initialData={roomB} />);

    // Should immediately reset to Page 1
    expect(
      screen.getByText(
        (_, el) =>
          el?.tagName === "SPAN" &&
          el?.textContent?.replace(/\s+/g, " ").trim() ===
            "Showing 1 – 5 of 8 records"
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        (_, el) =>
          el?.tagName === "SPAN" &&
          el?.textContent?.replace(/\s+/g, " ").trim() === "Page 1 of 2"
      )
    ).toBeInTheDocument();
    expect(screen.getByText("HP-261104-001")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Previous Page/i })).toBeDisabled();
  });

  it("handles 0 records with empty state message", () => {
    const emptyRoom = createMockRoomDetails("room-103", "103", 0);
    render(<RoomDetailsView initialData={emptyRoom} />);

    expect(screen.getByText("Recent Room History (0)")).toBeInTheDocument();
    expect(
      screen.getByText("No past stays recorded for Room 103.")
    ).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("preserves table columns and view action links", () => {
    const mockData = createMockRoomDetails("room-101", "101", 2);
    render(<RoomDetailsView initialData={mockData} />);

    // Verify all table headers are present
    const table = screen.getByRole("table");
    expect(within(table).getByText("Reference")).toBeInTheDocument();
    expect(within(table).getByText("Primary Guest")).toBeInTheDocument();
    expect(within(table).getByText("Status")).toBeInTheDocument();
    expect(within(table).getByText("Check-In")).toBeInTheDocument();
    expect(within(table).getByText("Check-Out")).toBeInTheDocument();
    expect(within(table).getByText("Rate")).toBeInTheDocument();
    expect(within(table).getByText("Action")).toBeInTheDocument();

    // Verify View action link points to booking details
    const viewLinks = screen.getAllByRole("link", { name: "View" });
    expect(viewLinks.length).toBe(2);
    expect(viewLinks[0]).toHaveAttribute("href", "/bookings/booking-001");
  });
});
