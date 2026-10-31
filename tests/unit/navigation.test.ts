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

  it("handles routes with query parameters like /register?tab=analytics", () => {
    expect(isNavItemActive("/register", "/register?tab=analytics")).toBe(true);
    expect(isNavItemActive("/register/guest", "/register?tab=analytics")).toBe(true);
    expect(isNavItemActive("/rooms", "/register?tab=analytics")).toBe(false);
  });
});
