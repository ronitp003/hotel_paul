import { describe, it, expect } from "vitest";
import {
  formatIST,
  formatISTDate,
  formatISTTime,
  startOfISTDay,
  endOfISTDay,
  startOfISTMonth,
  endOfISTMonth,
  fromISTInput,
  IST_TIMEZONE,
} from "@/lib/datetime";

describe("lib/datetime (IST Timezone Handling)", () => {
  it("uses Asia/Kolkata timezone constant", () => {
    expect(IST_TIMEZONE).toBe("Asia/Kolkata");
  });

  it("formats dates in IST (+05:30) correctly", () => {
    // 2026-10-28T18:30:00Z is 2026-10-29 00:00:00 IST
    const utcMidnightIST = new Date("2026-10-28T18:30:00.000Z");
    expect(formatISTDate(utcMidnightIST)).toBe("29 Oct 2026");
    expect(formatISTTime(utcMidnightIST)).toBe("12:00 AM");
  });

  it("handles midday IST correctly", () => {
    // 2026-10-29T06:30:00Z is 2026-10-29 12:00:00 PM IST
    const midday = new Date("2026-10-29T06:30:00.000Z");
    expect(formatISTTime(midday)).toBe("12:00 PM");
  });

  it("parses IST input string to correct UTC timestamp", () => {
    const parsed = fromISTInput("2026-10-29T10:00");
    // 10:00 IST is 04:30 UTC
    expect(parsed.toISOString()).toBe("2026-10-29T04:30:00.000Z");
  });

  it("calculates startOfISTDay matching 00:00:00 IST in UTC", () => {
    const date = new Date("2026-10-29T10:00:00.000Z");
    const start = startOfISTDay(date);
    // Midnight 29 Oct in IST is 18:30 on 28 Oct UTC
    expect(start.toISOString()).toBe("2026-10-28T18:30:00.000Z");
    expect(formatIST(start, "HH:mm:ss")).toBe("00:00:00");
  });

  it("calculates endOfISTDay matching 23:59:59 IST in UTC", () => {
    const date = new Date("2026-10-29T10:00:00.000Z");
    const end = endOfISTDay(date);
    expect(formatIST(end, "HH:mm:ss")).toBe("23:59:59");
    expect(formatISTDate(end)).toBe("29 Oct 2026");
  });

  it("calculates startOfISTMonth correctly", () => {
    const date = new Date("2026-10-29T10:00:00.000Z");
    const monthStart = startOfISTMonth(date);
    expect(formatISTDate(monthStart)).toBe("01 Oct 2026");
    expect(formatIST(monthStart, "HH:mm:ss")).toBe("00:00:00");
  });

  it("calculates endOfISTMonth correctly", () => {
    const date = new Date("2026-10-29T10:00:00.000Z");
    const monthEnd = endOfISTMonth(date);
    expect(formatISTDate(monthEnd)).toBe("31 Oct 2026");
    expect(formatIST(monthEnd, "HH:mm:ss")).toBe("23:59:59");
  });
});
