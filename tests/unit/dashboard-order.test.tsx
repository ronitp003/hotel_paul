import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen, within, fireEvent } from "@testing-library/react";
import { DashboardView } from "@/features/dashboard/components/dashboard-view";
import type { DashboardSummary } from "@/features/dashboard/schemas";
import type { RoomWithStatus } from "@/server/services/room.service";

const mockRooms: RoomWithStatus[] = [
  {
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
  },
  {
    id: "room-102",
    number: "102",
    typeId: "type-deluxe",
    typeName: "Deluxe AC",
    pricePerNight: 2400,
    isActive: true,
    status: "OCCUPIED",
    hasProblem: false,
    openProblemsCount: 0,
    openProblems: [],
    maintenanceReason: null,
    currentBooking: {
      id: "booking-1",
      reference: "HP-261104-001",
      guestName: "Vikram Malhotra",
      checkInAt: new Date(),
      checkOutAt: new Date(),
    },
  },
  {
    id: "room-103",
    number: "103",
    typeId: "type-deluxe",
    typeName: "Deluxe AC",
    pricePerNight: 2400,
    isActive: true,
    status: "MAINTENANCE",
    hasProblem: false,
    openProblemsCount: 0,
    openProblems: [],
    maintenanceReason: "AC compressor replacement",
    currentBooking: null,
  },
];

const mockDashboardData: DashboardSummary = {
  rooms: {
    total: 3,
    occupied: 1,
    available: 1,
    reserved: 0,
    maintenance: 1,
    problems: 0,
  },
  roomList: mockRooms,
  movements: {
    arrivals: {
      total: 4,
      checkedIn: 2,
      expected: 2,
    },
    departures: {
      total: 3,
      checkedOut: 1,
      pending: 2,
    },
  },
  paymentsDue: {
    count: 2,
    totalAmount: 3500,
  },
  lowStock: {
    count: 1,
    items: [],
  },
  billing: {
    totalBilled: 125000,
    totalGst: 15000,
    invoicesCount: 18,
    monthName: "November 2026",
  },
  forecast: [],
  departingToday: [
    {
      id: "dep-1",
      reference: "HP-DEP-001",
      guestName: "Arun Verma",
      guestMobile: "9876543210",
      roomNumber: "102",
      roomTypeName: "Deluxe AC",
      time: new Date().toISOString(),
      status: "CHECKED_IN",
      balanceDue: 1200,
    },
  ],
  arrivingToday: [
    {
      id: "arr-1",
      reference: "HP-ARR-001",
      guestName: "Pooja Hegde",
      guestMobile: "9876500000",
      roomNumber: "101",
      roomTypeName: "Standard Non-AC",
      time: new Date().toISOString(),
      status: "RESERVED",
      balanceDue: 0,
    },
  ],
};

describe("Dashboard Major Layout Redesign", () => {
  it("completely removes the Live Room Occupancy section", () => {
    render(<DashboardView data={mockDashboardData} userRole="OWNER" />);

    // Live Room Occupancy heading and old stat cards must NOT exist
    expect(screen.queryByText(/Live Room Occupancy/i)).toBeNull();
    expect(screen.queryByText("Occupied Rooms")).toBeNull();
    expect(screen.queryByText("Available Rooms")).toBeNull();
    expect(screen.queryByText("Under Maintenance")).toBeNull();
    expect(screen.queryByText("Rooms with Problems")).toBeNull();
  });

  it("renders all summary cards in ONE row for OWNER view with 'Revenue' renamed", () => {
    const { container } = render(
      <DashboardView data={mockDashboardData} userRole="OWNER" />
    );

    // Heading for Owner
    expect(screen.getByText("Operations, Finance & Inventory")).toBeInTheDocument();

    // Verify 6-column single row grid on desktop
    const grid = container.querySelector(".xl\\:grid-cols-6");
    expect(grid).toBeInTheDocument();

    // 6 cards present: Arrivals Today, Departing Today, Low Stock, Payments Due, Revenue, GST Payable
    expect(screen.getAllByText("Arrivals Today").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Departing Today").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Low Stock")).toBeInTheDocument();
    expect(screen.getByText("Payments Due")).toBeInTheDocument();
    expect(screen.getByText("Revenue")).toBeInTheDocument();
    expect(screen.getByText("GST Payable")).toBeInTheDocument();

    // Old name "Billed This Month" must NOT exist
    expect(screen.queryByText("Billed This Month")).toBeNull();
  });

  it("renders only Row 1 for RECEPTIONIST view and hides all financial cards", () => {
    render(<DashboardView data={mockDashboardData} userRole="RECEPTIONIST" />);

    // Heading for Receptionist
    expect(screen.getByText("Operations & Inventory")).toBeInTheDocument();

    // Row 1 cards are present
    expect(screen.getAllByText("Arrivals Today").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Departing Today").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Low Stock")).toBeInTheDocument();

    // Financial cards must remain hidden from Receptionist
    expect(screen.queryByText("Payments Due")).toBeNull();
    expect(screen.queryByText("Revenue")).toBeNull();
    expect(screen.queryByText("GST Payable")).toBeNull();
  });

  it("renders the 2:1 layout with Room Board on the left and Departing Today on the right, and Arriving Today full-width below", () => {
    const { container } = render(
      <DashboardView data={mockDashboardData} userRole="OWNER" />
    );

    // Section headings
    expect(screen.getByText("Room Board")).toBeInTheDocument();
    expect(screen.getAllByText("Departing Today").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("Arriving Today")).toBeInTheDocument();

    // Verify 2:1 column ratio structure in DOM
    const mainGrid = container.querySelector(".lg\\:grid-cols-3");
    expect(mainGrid).toBeInTheDocument();

    const leftCol = container.querySelector(".lg\\:col-span-2");
    expect(leftCol).toBeInTheDocument();

    const rightCol = container.querySelector(".lg\\:col-span-1");
    expect(rightCol).toBeInTheDocument();

    // Room Board is inside the left 2/3 column
    expect(within(leftCol as HTMLElement).getByText("Room Board")).toBeInTheDocument();

    // Departing Today is inside the right 1/3 column
    expect(within(rightCol as HTMLElement).getByText("Departing Today")).toBeInTheDocument();

    // Arriving Today is placed outside the 2:1 grid in a full-width container below
    expect(within(leftCol as HTMLElement).queryByText("Arriving Today")).toBeNull();
    const fullWidthSection = container.querySelector(".w-full");
    expect(fullWidthSection).toBeInTheDocument();
    expect(within(fullWidthSection as HTMLElement).getByText("Arriving Today")).toBeInTheDocument();
  });

  it("renders hotel rooms in the Room Board using full-card status styling", () => {
    const { container } = render(
      <DashboardView data={mockDashboardData} userRole="OWNER" />
    );

    const leftCol = container.querySelector(".lg\\:col-span-2") as HTMLElement;
    expect(leftCol).toBeInTheDocument();

    // Room numbers inside left column
    expect(within(leftCol).getByText("101")).toBeInTheDocument();
    expect(within(leftCol).getByText("102")).toBeInTheDocument();
    expect(within(leftCol).getByText("103")).toBeInTheDocument();

    // Room statuses inside left column (matching card status badges or summary pills)
    expect(within(leftCol).getAllByText("Available").length).toBeGreaterThanOrEqual(1);
    expect(within(leftCol).getAllByText("Occupied").length).toBeGreaterThanOrEqual(1);
    expect(within(leftCol).getAllByText("Maintenance").length).toBeGreaterThanOrEqual(1);

    // Occupied room displays current guest
    expect(within(leftCol).getByText(/Vikram Malhotra/i)).toBeInTheDocument();

    // Maintenance room displays maintenance reason
    expect(within(leftCol).getByText(/AC compressor replacement/i)).toBeInTheDocument();

    // Arriving Today guest item in full-width section
    expect(screen.getByText("Pooja Hegde")).toBeInTheDocument();

    // Departing Today guest item in right column
    const rightCol = container.querySelector(".lg\\:col-span-1") as HTMLElement;
    expect(within(rightCol).getByText("Arun Verma")).toBeInTheDocument();
  });

  it("renders Room Board header with status summary counts in order and All Rooms navigation", () => {
    const { container } = render(
      <DashboardView data={mockDashboardData} userRole="OWNER" />
    );

    const leftCol = container.querySelector(".lg\\:col-span-2") as HTMLElement;
    expect(leftCol).toBeInTheDocument();

    // Summary pills in Room Board: All Rooms, Available, Occupied, Reserved, Maintenance
    expect(within(leftCol).getAllByText("All Rooms").length).toBeGreaterThanOrEqual(2);
    expect(within(leftCol).getAllByText("Available").length).toBeGreaterThanOrEqual(1);
    expect(within(leftCol).getAllByText("Occupied").length).toBeGreaterThanOrEqual(1);
    expect(within(leftCol).getByText("Reserved")).toBeInTheDocument();
    expect(within(leftCol).getAllByText("Maintenance").length).toBeGreaterThanOrEqual(1);

    // Check count values (3 total, 1 occupied, 1 available, 1 maintenance)
    expect(within(leftCol).getByText("3")).toBeInTheDocument();

    // Navigation button to All Rooms
    const allRoomsBtn = within(leftCol).getByRole("link", { name: /all rooms/i });
    expect(allRoomsBtn).toHaveAttribute("href", "/rooms");
  });

  it("renders Issue badge at the top of the card and does not render Due amount badge", () => {
    const roomsWithProblemAndBalance: RoomWithStatus[] = [
      {
        ...mockRooms[0],
        id: "room-201",
        number: "201",
        hasProblem: true,
        openProblemsCount: 1,
        balanceDue: 2500,
        status: "OCCUPIED",
        currentBooking: {
          id: "bk-due",
          reference: "HP-DUE-001",
          guestName: "Rahul Dravid",
          checkInAt: new Date(),
          checkOutAt: new Date(),
        },
      },
    ];

    render(
      <DashboardView
        data={{ ...mockDashboardData, roomList: roomsWithProblemAndBalance }}
        userRole="OWNER"
      />
    );

    // Top Issue badge must be rendered
    expect(screen.getByText("Issue")).toBeInTheDocument();

    // Due amount badge must NOT be rendered on Room Board card
    expect(screen.queryByText(/Due: ₹/i)).toBeNull();
  });

  it("opens quick details modal on clicking a room card from Room Board and verifies Inventory State is removed", async () => {
    render(<DashboardView data={mockDashboardData} userRole="OWNER" />);

    const roomCard = screen.getByText("101").closest('[role="button"]') as HTMLElement;
    expect(roomCard).toBeInTheDocument();

    fireEvent.click(roomCard);

    // Modal opens with room title
    expect(await screen.findByRole("heading", { name: "Room 101" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /room details/i })).toBeInTheDocument();

    // Inventory State must NOT exist in the modal
    expect(screen.queryByText(/Inventory State/i)).toBeNull();
    expect(screen.queryByText(/Active \(Bookable\)/i)).toBeNull();
  });
});
