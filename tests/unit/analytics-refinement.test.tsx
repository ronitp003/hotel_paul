import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { AnalyticsTab } from "@/features/analytics/components/analytics-tab";
import type { AnalyticsData } from "@/features/register/schemas";

// Mock ResizeObserver for Recharts in jsdom
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

const mockInitialData: AnalyticsData = {
  range: "7d",
  startDate: "28 Oct 2026",
  endDate: "03 Nov 2026",
  summary: {
    totalCheckIns: 40,
    totalGuests: 19,
    avgDailyCheckIns: 5.7,
    avgStayDuration: 2.5,
    occupancyRate: 68,
    totalRevenue: 85000,
    topOrigin: "Kolkata",
    topPurpose: "Tourism",
  },
  dailyCheckIns: [
    { date: "2026-10-28", label: "28 Oct", dayOfWeek: "Wed", checkIns: 6, guests: 8 },
    { date: "2026-10-29", label: "29 Oct", dayOfWeek: "Thu", checkIns: 5, guests: 7 },
    { date: "2026-10-30", label: "30 Oct", dayOfWeek: "Fri", checkIns: 7, guests: 10 },
    { date: "2026-10-31", label: "31 Oct", dayOfWeek: "Sat", checkIns: 8, guests: 12 },
    { date: "2026-11-01", label: "01 Nov", dayOfWeek: "Sun", checkIns: 4, guests: 5 },
    { date: "2026-11-02", label: "02 Nov", dayOfWeek: "Mon", checkIns: 5, guests: 6 },
    { date: "2026-11-03", label: "03 Nov", dayOfWeek: "Tue", checkIns: 5, guests: 6 },
  ],
  occupancyTrend: [
    { date: "2026-10-28", label: "28 Oct", occupancyPercent: 60, occupiedRooms: 6, totalRooms: 10 },
    { date: "2026-10-29", label: "29 Oct", occupancyPercent: 70, occupiedRooms: 7, totalRooms: 10 },
    { date: "2026-10-30", label: "30 Oct", occupancyPercent: 80, occupiedRooms: 8, totalRooms: 10 },
    { date: "2026-10-31", label: "31 Oct", occupancyPercent: 90, occupiedRooms: 9, totalRooms: 10 },
    { date: "2026-11-01", label: "01 Nov", occupancyPercent: 60, occupiedRooms: 6, totalRooms: 10 },
    { date: "2026-11-02", label: "02 Nov", occupancyPercent: 60, occupiedRooms: 6, totalRooms: 10 },
    { date: "2026-11-03", label: "03 Nov", occupancyPercent: 55, occupiedRooms: 5, totalRooms: 10 },
  ],
  weekdayCheckIns: [
    { day: "Monday", shortDay: "Mon", count: 5 },
    { day: "Tuesday", shortDay: "Tue", count: 5 },
    { day: "Wednesday", shortDay: "Wed", count: 6 },
    { day: "Thursday", shortDay: "Thu", count: 5 },
    { day: "Friday", shortDay: "Fri", count: 7 },
    { day: "Saturday", shortDay: "Sat", count: 8 },
    { day: "Sunday", shortDay: "Sun", count: 4 },
  ],
  checkInTimeDistribution: [
    { slot: "MORNING", label: "Morning", timeRange: "6 AM – 12 PM", count: 12, percentage: 30 },
    { slot: "AFTERNOON", label: "Afternoon", timeRange: "12 PM – 5 PM", count: 16, percentage: 40 },
    { slot: "EVENING", label: "Evening", timeRange: "5 PM – 9 PM", count: 8, percentage: 20 },
    { slot: "NIGHT", label: "Night", timeRange: "9 PM – 6 AM", count: 4, percentage: 10 },
  ],
  paymentCollections: {
    daily: [
      { key: "2026-10-28", label: "28 Oct", grossPayments: 12000, refunds: 0, netCollections: 12000 },
      { key: "2026-10-29", label: "29 Oct", grossPayments: 10000, refunds: 0, netCollections: 10000 },
      { key: "2026-10-30", label: "30 Oct", grossPayments: 15000, refunds: 0, netCollections: 15000 },
      { key: "2026-10-31", label: "31 Oct", grossPayments: 20000, refunds: 1000, netCollections: 19000 },
      { key: "2026-11-01", label: "01 Nov", grossPayments: 9000, refunds: 0, netCollections: 9000 },
      { key: "2026-11-02", label: "02 Nov", grossPayments: 10000, refunds: 0, netCollections: 10000 },
      { key: "2026-11-03", label: "03 Nov", grossPayments: 10000, refunds: 0, netCollections: 10000 },
    ],
    weekly: [],
    totalGrossPayments: 86000,
    totalRefunds: 1000,
    totalNetCollections: 85000,
  },
  origins: [],
  purposes: [],
  sources: [],
};

describe("Analytics Tab UI & Layout Refinement", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("renders all 4 summary cards correctly with required metrics and labels", () => {
    render(<AnalyticsTab initialData={mockInitialData} />);

    // 1. Total Check-ins card with main count and guests subtext
    expect(screen.getByText("Total Check-ins")).toBeInTheDocument();
    expect(screen.getByText("40")).toBeInTheDocument();
    expect(screen.getByText("19 guests")).toBeInTheDocument();

    // 2. Daily Average Stay card (renamed from Daily Average) displaying nights
    expect(screen.getByText("Daily Average Stay")).toBeInTheDocument();
    expect(screen.getByText("2.5")).toBeInTheDocument();
    expect(screen.getByText("nights")).toBeInTheDocument();
    expect(screen.getByText("Average stay duration")).toBeInTheDocument();

    // 3. Average Occupancy card
    expect(screen.getByText("Average Occupancy")).toBeInTheDocument();
    expect(screen.getByText("68%")).toBeInTheDocument();
    expect(screen.getByText("Average room occupancy")).toBeInTheDocument();

    // 4. Revenue card displaying total revenue
    expect(screen.getByText("Revenue")).toBeInTheDocument();
    expect(screen.getAllByText(/₹\s*85,000/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Net collections in period")).toBeInTheDocument();
  });

  it("renders all 5 chart sections in correct hierarchy and positioning", () => {
    render(<AnalyticsTab initialData={mockInitialData} />);

    // Row 1 charts
    expect(screen.getByText("Daily Check-in Volume")).toBeInTheDocument();
    expect(screen.getByText("Room Occupancy Rate (%)")).toBeInTheDocument();

    // Row 2 charts
    expect(screen.getByText("Payment Collection Trends")).toBeInTheDocument();
    expect(screen.getByText("Check-ins by Weekday")).toBeInTheDocument();
    expect(screen.getByText("Check-in Time Distribution")).toBeInTheDocument();

    // Verify ordering: Check-ins by Weekday is positioned between Payment Collection Trends and Check-in Time Distribution
    const headings = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent?.trim());
    const paymentIdx = headings.indexOf("Payment Collection Trends");
    const weekdayIdx = headings.indexOf("Check-ins by Weekday");
    const timeIdx = headings.indexOf("Check-in Time Distribution");

    expect(paymentIdx).toBeGreaterThanOrEqual(0);
    expect(weekdayIdx).toBeGreaterThan(paymentIdx);
    expect(timeIdx).toBeGreaterThan(weekdayIdx);
  });

  it("updates data and summary cards when date filter is changed", async () => {
    const updatedData: AnalyticsData = {
      ...mockInitialData,
      range: "14d",
      startDate: "21 Oct 2026",
      endDate: "03 Nov 2026",
      summary: {
        ...mockInitialData.summary,
        totalCheckIns: 75,
        totalGuests: 110,
        avgStayDuration: 3.1,
        occupancyRate: 82,
        totalRevenue: 165000,
      },
      paymentCollections: {
        ...mockInitialData.paymentCollections,
        totalNetCollections: 165000,
      },
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, data: updatedData }),
    } as Response);

    render(<AnalyticsTab initialData={mockInitialData} />);

    const filter14d = screen.getByRole("button", { name: "Last 14 Days" });
    fireEvent.click(filter14d);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith("/api/analytics?range=14d");
      expect(screen.getByText("75")).toBeInTheDocument();
      expect(screen.getByText("110 guests")).toBeInTheDocument();
      expect(screen.getByText("3.1")).toBeInTheDocument();
      expect(screen.getByText("82%")).toBeInTheDocument();
      expect(screen.getAllByText(/₹\s*1,65,000/).length).toBeGreaterThanOrEqual(1);
    });
  });
});
