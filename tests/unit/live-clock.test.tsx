import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { LiveClock } from "@/components/layout/live-clock";

describe("LiveClock Component", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Set to 14:35:09 IST (09:05:09 UTC)
    vi.setSystemTime(new Date("2026-11-04T09:05:09.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders live clock in 12-hour format with AM/PM, IST date, and timezone badge", () => {
    render(<LiveClock />);

    // 14:35:09 UTC+5:30 -> 02:35:09 PM
    expect(screen.getByText("02:35:09 PM")).toBeInTheDocument();
    expect(screen.getByText("04 Nov 2026")).toBeInTheDocument();
    expect(screen.getByText("IST")).toBeInTheDocument();
  });

  it("updates live clock in real-time each second in 12-hour format", () => {
    render(<LiveClock />);

    expect(screen.getByText("02:35:09 PM")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(screen.getByText("02:35:10 PM")).toBeInTheDocument();
  });
});

