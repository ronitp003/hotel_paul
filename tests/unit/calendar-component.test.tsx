import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CalendarTimeline } from "@/features/calendar/components/calendar-timeline";

// Mock fetch for calendar data
global.fetch = vi.fn().mockImplementation(() =>
  Promise.resolve({
    ok: true,
    json: () =>
      Promise.resolve({
        ok: true,
        data: {
          rooms: [
            {
              id: "room-101",
              number: "101",
              floor: 1,
              typeId: "standard",
              typeName: "Standard AC",
              baseRate: 2000,
              unresolvedProblemCount: 0,
            },
          ],
          bookings: [],
          maintenance: [],
        },
      }),
  })
);

describe("CalendarTimeline component", () => {
  it("mounts and renders cleanly without triggering maximum update depth or infinite re-renders", () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });

    const { container } = render(
      <QueryClientProvider client={queryClient}>
        <CalendarTimeline roomTypes={[{ id: "standard", name: "Standard AC" }]} />
      </QueryClientProvider>
    );

    // Verify key elements are rendered without exception
    expect(screen.getByText("All Room Types")).toBeDefined();
    expect(screen.getByText("Day")).toBeDefined();
    expect(screen.getByText("Week")).toBeDefined();
    expect(screen.getByPlaceholderText(/search room/i)).toBeDefined();
    expect(container).toBeDefined();
  });
});
