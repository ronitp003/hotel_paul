import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { DashboardView } from "@/features/dashboard/components/dashboard-view";
import type { DashboardSummary } from "@/features/dashboard/schemas";

const mockDashboardData: DashboardSummary = {
  rooms: {
    total: 10,
    occupied: 6,
    available: 3,
    reserved: 0,
    maintenance: 1,
    problems: 1,
  },
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
  departingToday: [],
  arrivingToday: [],
};

describe("DashboardView Role-Based Section Ordering", () => {
  it("renders Operations, Finance & Inventory BEFORE Live Room Occupancy for OWNER role", () => {
    render(
      <DashboardView data={mockDashboardData} userRole="OWNER" />
    );

    const headings = screen.getAllByRole("heading", { level: 2 });
    const headingTexts = headings.map((h) => h.textContent?.trim());

    // Expect 'OPERATIONS, FINANCE & INVENTORY' to precede 'LIVE ROOM OCCUPANCY'
    const opsIndex = headingTexts.findIndex((t) =>
      t?.toLowerCase().includes("operations, finance & inventory")
    );
    const occIndex = headingTexts.findIndex((t) =>
      t?.toLowerCase().includes("live room occupancy")
    );

    expect(opsIndex).toBeGreaterThanOrEqual(0);
    expect(occIndex).toBeGreaterThanOrEqual(0);
    expect(opsIndex).toBeLessThan(occIndex);

    // Verify all cards exist in owner view
    expect(screen.getByText("Arrivals Today")).toBeDefined();
    expect(screen.getByText("Departures Today")).toBeDefined();
    expect(screen.getByText("Payments Due")).toBeDefined();
    expect(screen.getByText("Low Stock")).toBeDefined();
    expect(screen.getByText("Billed This Month")).toBeDefined();
    expect(screen.getByText("GST Payable")).toBeDefined();
    expect(screen.getByText("Occupied Rooms")).toBeDefined();
    expect(screen.getByText("Available Rooms")).toBeDefined();
    expect(screen.getByText("Under Maintenance")).toBeDefined();
    expect(screen.getByText("Rooms with Problems")).toBeDefined();
  });

  it("renders Live Room Occupancy BEFORE Operations, Finance & Inventory for RECEPTIONIST role", () => {
    render(
      <DashboardView data={mockDashboardData} userRole="RECEPTIONIST" />
    );

    const headings = screen.getAllByRole("heading", { level: 2 });
    const headingTexts = headings.map((h) => h.textContent?.trim());

    // Expect 'Live Room Occupancy' to precede 'Operations, Finance & Inventory'
    const occIndex = headingTexts.findIndex((t) =>
      t?.toLowerCase().includes("live room occupancy")
    );
    const opsIndex = headingTexts.findIndex((t) =>
      t?.toLowerCase().includes("operations, finance & inventory")
    );

    expect(occIndex).toBeGreaterThanOrEqual(0);
    expect(opsIndex).toBeGreaterThanOrEqual(0);
    expect(occIndex).toBeLessThan(opsIndex);

    // Verify receptionist view does NOT show financial cards
    expect(screen.queryByText("Billed This Month")).toBeNull();
    expect(screen.queryByText("GST Payable")).toBeNull();

    // Verify operational cards still exist
    expect(screen.getByText("Occupied Rooms")).toBeDefined();
    expect(screen.getByText("Available Rooms")).toBeDefined();
    expect(screen.getByText("Arrivals Today")).toBeDefined();
    expect(screen.getByText("Departures Today")).toBeDefined();
  });
});
