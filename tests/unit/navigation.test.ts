import { describe, it, expect } from "vitest";
import { isNavItemActive } from "@/components/layout/sidebar";

describe("Sidebar Navigation Route Matching (isNavItemActive)", () => {
  it("matches /settings on /settings route", () => {
    expect(isNavItemActive("/settings", "/settings")).toBe(true);
  });

  it("matches /settings on subroutes (/settings/room-types, /settings/users)", () => {
    expect(isNavItemActive("/settings/room-types", "/settings")).toBe(true);
    expect(isNavItemActive("/settings/users", "/settings")).toBe(true);
  });

  it("does not match /settings on unrelated routes", () => {
    expect(isNavItemActive("/dashboard", "/settings")).toBe(false);
    expect(isNavItemActive("/rooms", "/settings")).toBe(false);
    expect(isNavItemActive("/bookings", "/settings")).toBe(false);
  });

  it("matches /dashboard on /dashboard and root /", () => {
    expect(isNavItemActive("/dashboard", "/dashboard")).toBe(true);
    expect(isNavItemActive("/", "/dashboard")).toBe(true);
    expect(isNavItemActive("/settings", "/dashboard")).toBe(false);
  });

  it("differentiates /bookings and /bookings/new cleanly", () => {
    // When on /bookings/new, New Booking is active, Bookings list is NOT
    expect(isNavItemActive("/bookings/new", "/bookings/new")).toBe(true);
    expect(isNavItemActive("/bookings/new", "/bookings")).toBe(false);

    // When on /bookings, Bookings list is active, New Booking is NOT
    expect(isNavItemActive("/bookings", "/bookings")).toBe(true);
    expect(isNavItemActive("/bookings", "/bookings/new")).toBe(false);
  });

  it("matches nested routes for generic resources like /rooms", () => {
    expect(isNavItemActive("/rooms", "/rooms")).toBe(true);
    expect(isNavItemActive("/rooms/101", "/rooms")).toBe(true);
    expect(isNavItemActive("/rooms-archive", "/rooms")).toBe(false);
  });

  it("strictly differentiates /register (Check-in Register) and /register?tab=analytics (Analytics)", () => {
    // 1. On /register without query: only Check-in Register is active
    expect(isNavItemActive("/register", "/register")).toBe(true);
    expect(isNavItemActive("/register", "/register?tab=analytics")).toBe(false);

    // 2. On /register?tab=analytics: only Analytics is active
    expect(isNavItemActive("/register?tab=analytics", "/register")).toBe(false);
    expect(isNavItemActive("/register?tab=analytics", "/register?tab=analytics")).toBe(true);

    // 3. With explicit searchParams object (as passed from useSearchParams)
    const analyticsParams = new URLSearchParams("tab=analytics");
    expect(isNavItemActive("/register", "/register", analyticsParams)).toBe(false);
    expect(isNavItemActive("/register", "/register?tab=analytics", analyticsParams)).toBe(true);

    // 4. On /register with date filter query (e.g. ?date=2026-11-01)
    const dateParams = new URLSearchParams("date=2026-11-01");
    expect(isNavItemActive("/register", "/register", dateParams)).toBe(true);
    expect(isNavItemActive("/register", "/register?tab=analytics", dateParams)).toBe(false);

    // 5. Unrelated routes
    expect(isNavItemActive("/rooms", "/register")).toBe(false);
    expect(isNavItemActive("/rooms", "/register?tab=analytics")).toBe(false);
  });
});
