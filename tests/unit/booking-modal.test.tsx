import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { BookingModal } from "@/features/bookings/components/booking-modal";
import { BookingModalProvider, useBookingModal } from "@/features/bookings/context/booking-modal-context";
import { createBookingAction } from "@/server/actions/booking.actions";
import { findAvailableRoomsAction } from "@/server/actions/room.actions";
import { listRoomTypesAction } from "@/server/actions/room-type.actions";
import { getBookingSettingsAction } from "@/server/actions/settings.actions";
import type { AvailableRoomResult } from "@/server/services/room.service";
import type { BookingResponse } from "@/server/services/booking.service";

// Mock next/navigation
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    refresh: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
}));

// Mock sonner
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock server actions
vi.mock("@/server/actions/booking.actions", () => ({
  createBookingAction: vi.fn(),
}));

vi.mock("@/server/actions/room.actions", () => ({
  findAvailableRoomsAction: vi.fn(),
}));

vi.mock("@/server/actions/room-type.actions", () => ({
  listRoomTypesAction: vi.fn(),
}));

vi.mock("@/server/actions/settings.actions", () => ({
  getBookingSettingsAction: vi.fn(),
}));

const mockStay = {
  days: 1,
  hours: 24,
  minutes: 0,
  elapsedMs: 86400000,
  graceMinutes: 60,
  isGracePeriodApplied: false,
};

const mockRooms: AvailableRoomResult[] = [
  {
    id: "room-101",
    number: "101",
    typeId: "type-1",
    typeName: "Deluxe King",
    pricePerNight: 2000,
    isActive: true,
    isAvailable: true,
    unavailableReason: null,
    unavailableType: null,
    hasProblem: false,
    openProblemsCount: 0,
    conflictingBooking: null,
    conflictingMaintenance: null,
    calculatedStay: mockStay,
    estimatedTotal: 2000,
  },
  {
    id: "room-102",
    number: "102",
    typeId: "type-1",
    typeName: "Deluxe King",
    pricePerNight: 2000,
    isActive: true,
    isAvailable: true,
    unavailableReason: null,
    unavailableType: null,
    hasProblem: false,
    openProblemsCount: 0,
    conflictingBooking: null,
    conflictingMaintenance: null,
    calculatedStay: mockStay,
    estimatedTotal: 2000,
  },
];

describe("BookingModal Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(listRoomTypesAction).mockResolvedValue({
      ok: true,
      data: [{ id: "type-1", name: "Deluxe King" }],
    });

    vi.mocked(getBookingSettingsAction).mockResolvedValue({
      ok: true,
      data: { graceMinutes: 60 },
    });

    vi.mocked(findAvailableRoomsAction).mockResolvedValue({
      ok: true,
      data: {
        stay: mockStay,
        rooms: mockRooms,
        availableCount: 2,
        totalCount: 2,
      },
    });

    vi.mocked(createBookingAction).mockResolvedValue({
      ok: true,
      data: {
        id: "booking-101",
        reference: "HP-261104-1001",
        roomId: "room-101",
        roomNumber: "101",
        roomTypeName: "Deluxe King",
        status: "CHECKED_IN",
        source: "WALK_IN",
        checkInAt: new Date(),
        checkOutAt: new Date(),
        actualCheckInAt: new Date(),
        actualCheckOutAt: null,
        primaryGuestName: "John Doe",
        guestsCount: 1,
        rateApplied: 2000,
        discount: 0,
        gstPercentOverride: null,
        advancePaid: 500,
        stayDays: 1,
        estimatedTotal: 2000,
        balanceDue: 1500,
      } as BookingResponse,
    });
  });

  it("renders Step 1 with DD/MM/YYYY date inputs, no quick presets, and primary guest fields", async () => {
    render(<BookingModal open={true} onOpenChange={vi.fn()} />);

    // Step indicators
    expect(screen.getByText(/New Booking \/ Front Desk Check-in/i)).toBeDefined();
    expect(screen.getByText("Stay Dates & 24-Hour Duration")).toBeDefined();
    expect(screen.getByText("Choose Room(s)")).toBeDefined();
    expect(screen.getByText(/Guest & Visit Information/i)).toBeDefined();

    // Verify DD/MM/YYYY date inputs are present
    const dateInputs = screen.getAllByPlaceholderText("DD/MM/YYYY");
    expect(dateInputs.length).toBe(2);

    // Verify Quick presets are REMOVED
    expect(screen.queryByRole("button", { name: /24h/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /48h/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /72h/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /Day Use/i })).toBeNull();

    // Wait for rooms to load
    await waitFor(() => {
      expect(findAvailableRoomsAction).toHaveBeenCalled();
    });
  });

  it("supports two-step room selection: Room Type dropdown and Room Number dropdown", async () => {
    render(<BookingModal open={true} onOpenChange={vi.fn()} />);

    await waitFor(() => {
      expect(findAvailableRoomsAction).toHaveBeenCalled();
    });

    // Dropdown B (Room Number) should initially be disabled until Room Type is chosen
    const roomNumberTrigger = screen.getByRole("button", {
      name: /Select room type first/i,
    });
    expect(roomNumberTrigger).toBeDefined();
    expect((roomNumberTrigger as HTMLButtonElement).disabled).toBe(true);

    // Open Dropdown A (Room Type)
    const roomTypeTrigger = screen.getByRole("button", {
      name: /Select Room Type\.\.\./i,
    });
    fireEvent.click(roomTypeTrigger);

    // Select "Deluxe King"
    const deluxeOption = await screen.findByRole("option", {
      name: /Deluxe King/i,
    });
    fireEvent.click(deluxeOption);

    // Now Dropdown B should be enabled with "Select room to add..."
    const enabledRoomNumberTrigger = screen.getByRole("button", {
      name: /Select room to add\.\.\./i,
    });
    expect(enabledRoomNumberTrigger).toBeDefined();
    expect((enabledRoomNumberTrigger as HTMLButtonElement).disabled).toBe(false);

    // Open Dropdown B
    fireEvent.click(enabledRoomNumberTrigger);

    // Select Room 101
    const room101Option = await screen.findByRole("option", {
      name: /Room 101/i,
    });
    fireEvent.click(room101Option);

    // Room 101 should immediately be added to selected rooms cards below
    expect(screen.getByText("Selected Rooms (1)")).toBeDefined();
    expect(screen.getByText("Room 101")).toBeDefined();
    expect(screen.getByText("Combined Nightly Tariff (1 room):")).toBeDefined();

    // Dropdown B should be cleared back to "Select room to add..." while retaining Room Type
    expect(screen.getAllByText("Deluxe King").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByRole("button", { name: /Select room to add\.\.\./i })).toBeDefined();

    // Remove room 101
    const removeBtn = screen.getByTitle("Remove Room 101");
    fireEvent.click(removeBtn);

    // Selected rooms should be empty
    expect(screen.getByText("Selected Rooms (0)")).toBeDefined();
    expect(
      screen.getByText(/No rooms selected yet\. Select a room type and room number above/i)
    ).toBeDefined();
  });

  it("enforces mandatory fields: Primary Guest (Name, Mobile, Age) and Visit Info (Arriving From, Purpose)", async () => {
    const { toast } = await import("sonner");
    render(<BookingModal open={true} onOpenChange={vi.fn()} />);

    await waitFor(() => {
      expect(findAvailableRoomsAction).toHaveBeenCalled();
    });

    // Click Proceed without filling anything
    const proceedBtn = screen.getByRole("button", {
      name: /Proceed to Review & Payment/i,
    });
    fireEvent.click(proceedBtn);

    // First error: rooms
    expect(toast.error).toHaveBeenCalledWith("Please select at least one room.");

    // Select a room
    fireEvent.click(
      screen.getByRole("button", { name: /Select Room Type\.\.\./i })
    );
    fireEvent.click(await screen.findByRole("option", { name: /Deluxe King/i }));
    fireEvent.click(
      screen.getByRole("button", { name: /Select room to add\.\.\./i })
    );
    fireEvent.click(await screen.findByRole("option", { name: /Room 101/i }));

    // Click Proceed again
    fireEvent.click(proceedBtn);

    // Shows validation error for mandatory fields
    expect(toast.error).toHaveBeenCalledWith(
      "Please fill in all mandatory fields before proceeding."
    );
    expect(screen.getByText("Full name is required.")).toBeDefined();
    expect(screen.getByText("Mobile number is required.")).toBeDefined();
    expect(screen.getByText("Age is required.")).toBeDefined();
    expect(screen.getByText("Arriving from location is required.")).toBeDefined();
    expect(screen.getByText("Purpose of visit is required.")).toBeDefined();
  });

  it("validates mandatory fields on accompanying guests (Name, Mobile, Age, Sex)", async () => {
    const { toast } = await import("sonner");
    render(<BookingModal open={true} onOpenChange={vi.fn()} />);

    await waitFor(() => {
      expect(findAvailableRoomsAction).toHaveBeenCalled();
    });

    // Select a room
    fireEvent.click(screen.getByRole("button", { name: /Select Room Type\.\.\./i }));
    fireEvent.click(await screen.findByRole("option", { name: /Deluxe King/i }));
    fireEvent.click(screen.getByRole("button", { name: /Select room to add\.\.\./i }));
    fireEvent.click(await screen.findByRole("option", { name: /Room 101/i }));

    // Fill primary guest & visit info
    fireEvent.change(screen.getByPlaceholderText("e.g. Rahul Sharma"), {
      target: { value: "John Doe" },
    });
    fireEvent.change(screen.getByPlaceholderText("10-digit mobile number"), {
      target: { value: "9876543210" },
    });
    fireEvent.change(screen.getByPlaceholderText("e.g. 32"), {
      target: { value: "35" },
    });
    fireEvent.change(screen.getByPlaceholderText("e.g. Kolkata, Delhi, Mumbai"), {
      target: { value: "Mumbai" },
    });
    fireEvent.change(screen.getByPlaceholderText("e.g. Business, Tour, Medical"), {
      target: { value: "Tourism" },
    });

    // Add an accompanying guest
    fireEvent.click(screen.getByRole("button", { name: /Add Accompanying Guest/i }));

    // Verify Mobile Number field is present for accompanying guest
    const accMobileInputs = screen.getAllByPlaceholderText("10-digit mobile number");
    expect(accMobileInputs.length).toBe(2);

    // Try to proceed without filling accompanying guest
    fireEvent.click(screen.getByRole("button", { name: /Proceed to Review & Payment/i }));

    expect(toast.error).toHaveBeenCalledWith(
      "Please fill in all mandatory fields before proceeding."
    );

    // Fill accompanying guest
    fireEvent.change(screen.getByPlaceholderText("Guest Full Name"), {
      target: { value: "Jane Doe" },
    });
    fireEvent.change(accMobileInputs[1], {
      target: { value: "9123456789" },
    });
    fireEvent.change(screen.getByPlaceholderText("e.g. 28"), {
      target: { value: "30" },
    });

    // Now proceed should succeed
    fireEvent.click(screen.getByRole("button", { name: /Proceed to Review & Payment/i }));

    // Should transition to Step 2
    await waitFor(() => {
      expect(screen.getByText("Stay Duration & Room(s)")).toBeDefined();
      expect(screen.getByText("Guest Information")).toBeDefined();
    });
  });

  it("renders accompanying guest names in Confirmation Modal (Step 3)", async () => {
    render(<BookingModal open={true} onOpenChange={vi.fn()} />);

    await waitFor(() => {
      expect(findAvailableRoomsAction).toHaveBeenCalled();
    });

    // Select room
    fireEvent.click(screen.getByRole("button", { name: /Select Room Type\.\.\./i }));
    fireEvent.click(await screen.findByRole("option", { name: /Deluxe King/i }));
    fireEvent.click(screen.getByRole("button", { name: /Select room to add\.\.\./i }));
    fireEvent.click(await screen.findByRole("option", { name: /Room 101/i }));

    // Fill primary guest
    fireEvent.change(screen.getByPlaceholderText("e.g. Rahul Sharma"), {
      target: { value: "John Doe" },
    });
    fireEvent.change(screen.getByPlaceholderText("10-digit mobile number"), {
      target: { value: "9876543210" },
    });
    fireEvent.change(screen.getByPlaceholderText("e.g. 32"), {
      target: { value: "35" },
    });

    // Add accompanying guest
    fireEvent.click(screen.getByRole("button", { name: /Add Accompanying Guest/i }));
    fireEvent.change(screen.getByPlaceholderText("Guest Full Name"), {
      target: { value: "Jane Doe" },
    });
    const mobileInputs = screen.getAllByPlaceholderText("10-digit mobile number");
    fireEvent.change(mobileInputs[1], { target: { value: "9123456780" } });
    fireEvent.change(screen.getByPlaceholderText("e.g. 28"), {
      target: { value: "30" },
    });

    // Fill visit info
    fireEvent.change(screen.getByPlaceholderText("e.g. Kolkata, Delhi, Mumbai"), {
      target: { value: "Kolkata" },
    });
    fireEvent.change(screen.getByPlaceholderText("e.g. Business, Tour, Medical"), {
      target: { value: "Holiday" },
    });

    // Proceed to Step 2
    fireEvent.click(screen.getByRole("button", { name: /Proceed to Review & Payment/i }));

    // Check In Now
    const checkInBtn = await screen.findByRole("button", { name: /Check In Now/i });
    fireEvent.click(checkInBtn);

    // Confirmation screen should display accompanying guests
    await waitFor(() => {
      expect(screen.getByText("Guest Checked In Successfully!")).toBeDefined();
      expect(screen.getByText("HP-261104-1001")).toBeDefined();
      expect(screen.getByText("Primary Guest")).toBeDefined();
      expect(screen.getByText("John Doe")).toBeDefined();
      expect(screen.getByText("Accompanying Guests")).toBeDefined();
      expect(screen.getByText("Jane Doe")).toBeDefined();
    });
  });

  it("resets state completely when New Booking button is clicked from confirmation screen (Bug Fix)", async () => {
    render(<BookingModal open={true} onOpenChange={vi.fn()} />);

    await waitFor(() => {
      expect(findAvailableRoomsAction).toHaveBeenCalled();
    });

    // Select room
    fireEvent.click(screen.getByRole("button", { name: /Select Room Type\.\.\./i }));
    fireEvent.click(await screen.findByRole("option", { name: /Deluxe King/i }));
    fireEvent.click(screen.getByRole("button", { name: /Select room to add\.\.\./i }));
    fireEvent.click(await screen.findByRole("option", { name: /Room 101/i }));

    // Fill primary guest & visit info
    fireEvent.change(screen.getByPlaceholderText("e.g. Rahul Sharma"), {
      target: { value: "John Doe" },
    });
    fireEvent.change(screen.getByPlaceholderText("10-digit mobile number"), {
      target: { value: "9876543210" },
    });
    fireEvent.change(screen.getByPlaceholderText("e.g. 32"), {
      target: { value: "35" },
    });
    fireEvent.change(screen.getByPlaceholderText("e.g. Kolkata, Delhi, Mumbai"), {
      target: { value: "Delhi" },
    });
    fireEvent.change(screen.getByPlaceholderText("e.g. Business, Tour, Medical"), {
      target: { value: "Business" },
    });

    // Proceed and check in
    fireEvent.click(screen.getByRole("button", { name: /Proceed to Review & Payment/i }));
    const checkInBtn = await screen.findByRole("button", { name: /Check In Now/i });
    fireEvent.click(checkInBtn);

    await waitFor(() => {
      expect(screen.getByText("Guest Checked In Successfully!")).toBeDefined();
    });

    // Click "New Booking" inside confirmation dialog
    const newBookingActionBtn = screen.getByRole("button", {
      name: /New Booking/i,
    });
    fireEvent.click(newBookingActionBtn);

    // Modal should now be reset back to Step 1 with clean fields
    expect(screen.getByText("Stay Dates & 24-Hour Duration")).toBeDefined();
    expect(screen.getByText("Choose Room(s)")).toBeDefined();
    expect((screen.getByPlaceholderText("e.g. Rahul Sharma") as HTMLInputElement).value).toBe("");
    expect((screen.getByPlaceholderText("10-digit mobile number") as HTMLInputElement).value).toBe("");
    expect((screen.getByPlaceholderText("e.g. 32") as HTMLInputElement).value).toBe("");
    expect(screen.getByText("Selected Rooms (0)")).toBeDefined();
  });

  it("ensures BookingModalProvider remounts fresh instance on every openBookingModal call", () => {
    function TestConsumer() {
      const { openBookingModal } = useBookingModal();
      return (
        <button type="button" onClick={() => openBookingModal()}>
          Trigger Booking
        </button>
      );
    }

    render(
      <BookingModalProvider>
        <TestConsumer />
      </BookingModalProvider>
    );

    // Open first time
    fireEvent.click(screen.getByText("Trigger Booking"));
    expect(screen.getByText(/New Booking \/ Front Desk Check-in/i)).toBeDefined();

    // Close modal
    fireEvent.click(screen.getByRole("button", { name: /Cancel/i }));

    // Re-open: should open fresh Step 1 immediately
    fireEvent.click(screen.getByText("Trigger Booking"));
    expect(screen.getByText(/New Booking \/ Front Desk Check-in/i)).toBeDefined();
    expect(screen.getByText("Stay Dates & 24-Hour Duration")).toBeDefined();
  });

  it("provides 'All Types' option in Room Type dropdown and displays rooms across all types", async () => {
    vi.mocked(listRoomTypesAction).mockResolvedValueOnce({
      ok: true,
      data: [
        { id: "type-1", name: "Deluxe King" },
        { id: "type-2", name: "Standard Non-AC" },
      ],
    });

    vi.mocked(findAvailableRoomsAction).mockResolvedValueOnce({
      ok: true,
      data: {
        stay: mockStay,
        rooms: [
          ...mockRooms,
          {
            id: "room-201",
            number: "201",
            typeId: "type-2",
            typeName: "Standard Non-AC",
            pricePerNight: 1200,
            isActive: true,
            isAvailable: true,
            unavailableReason: null,
            unavailableType: null,
            hasProblem: false,
            openProblemsCount: 0,
            conflictingBooking: null,
            conflictingMaintenance: null,
            calculatedStay: mockStay,
            estimatedTotal: 1200,
          },
        ],
        availableCount: 3,
        totalCount: 3,
      },
    });

    render(<BookingModal open={true} onOpenChange={vi.fn()} />);

    await waitFor(() => {
      expect(findAvailableRoomsAction).toHaveBeenCalled();
    });

    // Open Room Type dropdown
    const roomTypeTrigger = screen.getByRole("button", {
      name: /Select Room Type\.\.\./i,
    });
    fireEvent.click(roomTypeTrigger);

    // Verify "All Types" is an option and displays total available count (3)
    const allTypesOption = await screen.findByRole("option", {
      name: /All Types/i,
    });
    expect(allTypesOption).toBeDefined();
    expect(within(allTypesOption).getByText("3 Available")).toBeDefined();

    // Select "All Types"
    fireEvent.click(allTypesOption);

    // Open Room Number dropdown
    const roomNumberTrigger = screen.getByRole("button", {
      name: /Select room to add\.\.\./i,
    });
    fireEvent.click(roomNumberTrigger);

    // Should display rooms across all types (101, 102 from Deluxe King, and 201 from Standard Non-AC)
    expect(await screen.findByRole("option", { name: /Room 101/i })).toBeDefined();
    expect(await screen.findByRole("option", { name: /Room 102/i })).toBeDefined();
    expect(await screen.findByRole("option", { name: /Room 201/i })).toBeDefined();

    // Verify sublabel contains typeName and price
    expect(screen.getByText(/Standard Non-AC • ₹1,200\.00 \/ night/i)).toBeDefined();

    // Select Room 201
    fireEvent.click(await screen.findByRole("option", { name: /Room 201/i }));

    // Selected rooms now has Room 201
    expect(screen.getByText("Selected Rooms (1)")).toBeDefined();
    expect(screen.getByText("Room 201")).toBeDefined();
    expect(screen.getByText("Standard Non-AC")).toBeDefined();

    // Verify unified price component contains ₹, input with 1200, and /night
    const priceInput = screen.getByTitle("Custom Nightly Tariff (₹)") as HTMLInputElement;
    expect(priceInput).toBeDefined();
    expect(priceInput.value).toBe("1200");
    expect(screen.getByText("₹")).toBeDefined();
    expect(screen.getByText("/night")).toBeDefined();

    // Test editing tariff updates calculations
    fireEvent.change(priceInput, { target: { value: "1500" } });
    expect(priceInput.value).toBe("1500");
    expect(screen.getByText("Combined Nightly Tariff (1 room):")).toBeDefined();
    expect(screen.getByText(/₹1,500\.00 \/ night/i)).toBeDefined();

    // Verify "All Types" availability count updated from 3 to 2
    fireEvent.click(screen.getByRole("button", { name: /All Types/i }));
    const updatedAllTypesOption = await screen.findByRole("option", {
      name: /All Types/i,
    });
    expect(within(updatedAllTypesOption).getByText("2 Available")).toBeDefined();

    // Select "Deluxe King" specifically
    const deluxeKingOption = await screen.findByRole("option", {
      name: /Deluxe King/i,
    });
    fireEvent.click(deluxeKingOption);

    // Open Room Number dropdown again: should only show Deluxe King rooms (101 and 102)
    fireEvent.click(screen.getByRole("button", { name: /Select room to add\.\.\./i }));
    expect(await screen.findByRole("option", { name: /Room 101/i })).toBeDefined();
    expect(await screen.findByRole("option", { name: /Room 102/i })).toBeDefined();
    expect(screen.queryByRole("option", { name: /Room 201/i })).toBeNull();
  });
});
