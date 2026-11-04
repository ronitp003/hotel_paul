import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { RoomCard } from "@/features/rooms/components/room-card";
import type { RoomWithStatus } from "@/server/services/room.service";

describe("RoomCard Redesign – Full-Color Status Cards", () => {
  const baseRoom: RoomWithStatus = {
    id: "room-101",
    number: "101",
    typeId: "type-standard",
    typeName: "Standard Non-AC",
    pricePerNight: 1800,
    isActive: true,
    status: "AVAILABLE",
    hasProblem: false,
    openProblemsCount: 0,
    openProblems: [],
    maintenanceReason: null,
    currentBooking: null,
  };

  it("renders an AVAILABLE room with light green full-card styling and badge", () => {
    const { container } = render(<RoomCard room={baseRoom} />);

    // Check Room Number, Type, and Nightly Rate
    expect(screen.getByText("101")).toBeInTheDocument();
    expect(screen.getByText("Standard Non-AC")).toBeInTheDocument();
    expect(screen.getByText(/₹1,800/)).toBeInTheDocument();
    expect(screen.getByText("/ night")).toBeInTheDocument();

    // Check Available status badge and context
    expect(screen.getByText("Available")).toBeInTheDocument();
    expect(screen.getByText("Ready for check-in")).toBeInTheDocument();
    expect(screen.getByText("Clean & inspected")).toBeInTheDocument();

    // Check card has emerald full-color background classes
    const card = container.querySelector('[tabindex="0"]');
    expect(card).toBeInTheDocument();
    expect(card?.className).toContain("bg-emerald-50");
    expect(card?.className).toContain("border-emerald-200");
  });

  it("renders an OCCUPIED room with blue full-card styling, guest name, and checkout date", () => {
    const occupiedRoom: RoomWithStatus = {
      ...baseRoom,
      id: "room-102",
      number: "102",
      status: "OCCUPIED",
      currentBooking: {
        id: "bk-1",
        reference: "BK-20261103-001",
        guestName: "Rohit Sharma",
        checkInAt: new Date("2026-11-03T10:00:00Z"),
        checkOutAt: new Date("2026-11-05T10:00:00Z"),
      },
    };

    const { container } = render(<RoomCard room={occupiedRoom} />);

    // Check Occupied badge and contextual guest details
    expect(screen.getByText("Occupied")).toBeInTheDocument();
    expect(screen.getByText("Rohit Sharma")).toBeInTheDocument();
    expect(screen.getByText(/Checkout:/)).toBeInTheDocument();
    expect(screen.getByText("BK-20261103-001")).toBeInTheDocument();

    // Check card has blue full-color background classes
    const card = container.querySelector('[tabindex="0"]');
    expect(card?.className).toContain("bg-blue-50");
    expect(card?.className).toContain("border-blue-200");
  });

  it("renders a RESERVED room with amber full-card styling, guest name, and arrival date", () => {
    const reservedRoom: RoomWithStatus = {
      ...baseRoom,
      id: "room-103",
      number: "103",
      status: "RESERVED",
      currentBooking: {
        id: "bk-2",
        reference: "BK-20261103-002",
        guestName: "Virat Kohli",
        checkInAt: new Date("2026-11-04T12:00:00Z"),
        checkOutAt: new Date("2026-11-06T10:00:00Z"),
      },
    };

    const { container } = render(<RoomCard room={reservedRoom} />);

    expect(screen.getByText("Reserved")).toBeInTheDocument();
    expect(screen.getByText("Virat Kohli")).toBeInTheDocument();
    expect(screen.getByText(/Arrival:/)).toBeInTheDocument();
    expect(screen.getByText("BK-20261103-002")).toBeInTheDocument();

    // Check card has amber full-color background classes
    const card = container.querySelector('[tabindex="0"]');
    expect(card?.className).toContain("bg-amber-50");
    expect(card?.className).toContain("border-amber-200");
  });

  it("renders a MAINTENANCE room with striped pattern background and maintenance details", () => {
    const maintenanceRoom: RoomWithStatus = {
      ...baseRoom,
      id: "room-104",
      number: "104",
      status: "MAINTENANCE",
      maintenanceReason: "Plumbing leak under sink",
      activeMaintenance: {
        id: "maint-1",
        startsAt: new Date("2026-11-03T08:00:00Z"),
        endsAt: new Date("2026-11-04T18:00:00Z"),
        reason: "Plumbing leak under sink",
      },
    };

    const { container } = render(<RoomCard room={maintenanceRoom} />);

    expect(screen.getByText("Maintenance")).toBeInTheDocument();
    expect(screen.getByText("Plumbing leak under sink")).toBeInTheDocument();
    expect(screen.getByText(/Until:/)).toBeInTheDocument();

    // Check card has striped maintenance background class
    const card = container.querySelector('[tabindex="0"]');
    expect(card?.className).toContain("bg-maintenance-striped");
    expect(card?.className).toContain("border-purple-300");
  });

  it("renders a disabled/inactive room with muted stone styling", () => {
    const disabledRoom: RoomWithStatus = {
      ...baseRoom,
      isActive: false,
    };

    const { container } = render(<RoomCard room={disabledRoom} />);

    expect(screen.getByText("Disabled")).toBeInTheDocument();
    expect(screen.getByText("Inactive in system")).toBeInTheDocument();

    const card = container.querySelector('[tabindex="0"]');
    expect(card?.className).toContain("bg-stone-100");
  });

  it("clearly displays open problem badge and problem description without compromising status background", () => {
    const problemRoom: RoomWithStatus = {
      ...baseRoom,
      status: "AVAILABLE",
      hasProblem: true,
      openProblemsCount: 2,
      openProblems: [
        {
          id: "prob-1",
          description: "Geyser thermostat not working",
          severity: "HIGH",
        },
      ],
    };

    const { container } = render(<RoomCard room={problemRoom} />);

    // Both the status badge and problem badge are visible
    expect(screen.getByText("Available")).toBeInTheDocument();
    expect(screen.getByText("2 Issues")).toBeInTheDocument();

    // Problem description is clearly surfaced
    expect(screen.getByText("Inspection Needed")).toBeInTheDocument();
    expect(screen.getByText("Geyser thermostat not working")).toBeInTheDocument();

    // The base card background remains light green (AVAILABLE)
    const card = container.querySelector('[tabindex="0"]');
    expect(card?.className).toContain("bg-emerald-50");
  });

  it("renders Edit action for OWNER and triggers onEdit callback", () => {
    const onEdit = vi.fn();
    render(<RoomCard room={baseRoom} userRole="OWNER" onEdit={onEdit} />);

    const editBtn = screen.getByRole("button", { name: /Edit/i });
    expect(editBtn).toBeInTheDocument();

    fireEvent.click(editBtn);
    expect(onEdit).toHaveBeenCalledWith(baseRoom);
  });

  it("does not render Edit button for non-owner role", () => {
    render(<RoomCard room={baseRoom} userRole="RECEPTIONIST" />);

    expect(screen.queryByRole("button", { name: /Edit/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /View Details/i })).toBeInTheDocument();
  });

  it("opens Quick Summary dialog when clicking View Details or card", async () => {
    render(<RoomCard room={baseRoom} />);

    const viewDetailsBtn = screen.getByRole("button", { name: /View Details/i });
    fireEvent.click(viewDetailsBtn);

    // Dialog title should appear
    expect(await screen.findByRole("heading", { name: "Room 101" })).toBeInTheDocument();
    expect(await screen.findByRole("link", { name: /Room Details/i })).toBeInTheDocument();
  });
});
