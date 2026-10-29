import { describe, it, expect } from "vitest";
import { calculateRoomStatus } from "@/server/services/room.service";
import { BookingStatus, ProblemStatus, Severity } from "@prisma/client";

describe("Room Status Calculation (calculateRoomStatus)", () => {
  const baseTime = new Date("2026-10-29T10:00:00.000Z");

  it("derives AVAILABLE when room has no bookings, maintenance, or problems", () => {
    const res = calculateRoomStatus({}, baseTime);
    expect(res.status).toBe("AVAILABLE");
    expect(res.hasProblem).toBe(false);
    expect(res.openProblemsCount).toBe(0);
    expect(res.currentBooking).toBeNull();
  });

  it("derives MAINTENANCE when a maintenance period covers current time", () => {
    const res = calculateRoomStatus(
      {
        maintenance: [
          {
            startsAt: new Date("2026-10-29T08:00:00.000Z"),
            endsAt: new Date("2026-10-29T12:00:00.000Z"),
            reason: "Air conditioner service",
          },
        ],
      },
      baseTime
    );

    expect(res.status).toBe("MAINTENANCE");
    expect(res.maintenanceReason).toBe("Air conditioner service");
    expect(res.currentBooking).toBeNull();
  });

  it("ignores past or future maintenance periods", () => {
    const res = calculateRoomStatus(
      {
        maintenance: [
          {
            startsAt: new Date("2026-10-28T08:00:00.000Z"),
            endsAt: new Date("2026-10-28T12:00:00.000Z"),
            reason: "Past repair",
          },
          {
            startsAt: new Date("2026-10-30T08:00:00.000Z"),
            endsAt: new Date("2026-10-30T12:00:00.000Z"),
            reason: "Future repair",
          },
        ],
      },
      baseTime
    );

    expect(res.status).toBe("AVAILABLE");
    expect(res.maintenanceReason).toBeNull();
  });

  it("derives OCCUPIED when a CHECKED_IN booking covers current time", () => {
    const res = calculateRoomStatus(
      {
        bookings: [
          {
            id: "b-1",
            reference: "BK-20261029-001",
            status: BookingStatus.CHECKED_IN,
            checkInAt: new Date("2026-10-28T14:00:00.000Z"),
            checkOutAt: new Date("2026-10-30T10:00:00.000Z"),
            guests: [
              { name: "John Doe", isPrimary: true },
              { name: "Jane Doe", isPrimary: false },
            ],
          },
        ],
      },
      baseTime
    );

    expect(res.status).toBe("OCCUPIED");
    expect(res.currentBooking?.id).toBe("b-1");
    expect(res.currentBooking?.guestName).toBe("John Doe");
    expect(res.currentBooking?.reference).toBe("BK-20261029-001");
  });

  it("derives RESERVED when a RESERVED booking covers or is upcoming for current time", () => {
    const res = calculateRoomStatus(
      {
        bookings: [
          {
            id: "b-reserved",
            reference: "BK-RES",
            status: BookingStatus.RESERVED,
            checkInAt: new Date("2026-10-28T14:00:00.000Z"),
            checkOutAt: new Date("2026-10-30T10:00:00.000Z"),
            guests: [{ name: "Ananya Roy", isPrimary: true }],
          },
        ],
      },
      baseTime
    );

    expect(res.status).toBe("RESERVED");
    expect(res.currentBooking?.id).toBe("b-reserved");
    expect(res.currentBooking?.guestName).toBe("Ananya Roy");
    expect(res.currentBooking?.reference).toBe("BK-RES");
  });

  it("derives AVAILABLE if bookings are only CANCELLED or CHECKED_OUT", () => {
    const res = calculateRoomStatus(
      {
        bookings: [
          {
            id: "b-cancelled",
            reference: "BK-CAN",
            status: BookingStatus.CANCELLED,
            checkInAt: new Date("2026-10-28T14:00:00.000Z"),
            checkOutAt: new Date("2026-10-30T10:00:00.000Z"),
          },
          {
            id: "b-checkedout",
            reference: "BK-OUT",
            status: BookingStatus.CHECKED_OUT,
            checkInAt: new Date("2026-10-28T14:00:00.000Z"),
            checkOutAt: new Date("2026-10-30T10:00:00.000Z"),
          },
        ],
      },
      baseTime
    );

    expect(res.status).toBe("AVAILABLE");
  });

  it("prioritizes MAINTENANCE over OCCUPIED if both are active simultaneously", () => {
    const res = calculateRoomStatus(
      {
        maintenance: [
          {
            startsAt: new Date("2026-10-29T08:00:00.000Z"),
            endsAt: new Date("2026-10-29T12:00:00.000Z"),
            reason: "Emergency pipe leak",
          },
        ],
        bookings: [
          {
            id: "b-active",
            reference: "BK-ACTIVE",
            status: BookingStatus.CHECKED_IN,
            checkInAt: new Date("2026-10-28T14:00:00.000Z"),
            checkOutAt: new Date("2026-10-30T10:00:00.000Z"),
            guests: [{ name: "Alice", isPrimary: true }],
          },
        ],
      },
      baseTime
    );

    expect(res.status).toBe("MAINTENANCE");
    expect(res.maintenanceReason).toBe("Emergency pipe leak");
  });

  it("flags open problems as overlay across any room status", () => {
    const res = calculateRoomStatus(
      {
        problems: [
          {
            id: "p-1",
            description: "TV remote battery dead",
            severity: Severity.LOW,
            status: ProblemStatus.OPEN,
          },
          {
            id: "p-2",
            description: "Tap dripping",
            severity: Severity.MEDIUM,
            status: ProblemStatus.FIXED,
          },
        ],
      },
      baseTime
    );

    expect(res.status).toBe("AVAILABLE");
    expect(res.hasProblem).toBe(true);
    expect(res.openProblemsCount).toBe(1);
  });

  it("derives OCCUPIED when a CHECKED_IN booking has not checked out even past scheduled checkOutAt", () => {
    // Scheduled checkout was 2 hours ago, but actualCheckOutAt is null (overstaying)
    const overstayTime = new Date("2026-10-30T12:00:00.000Z");
    const res = calculateRoomStatus(
      {
        bookings: [
          {
            id: "b-overstay",
            reference: "BK-OVERSTAY",
            status: BookingStatus.CHECKED_IN,
            checkInAt: new Date("2026-10-28T10:00:00.000Z"),
            checkOutAt: new Date("2026-10-30T10:00:00.000Z"),
            actualCheckOutAt: null,
            guests: [{ name: "Bob Overstay", isPrimary: true }],
          },
        ],
      },
      overstayTime
    );

    expect(res.status).toBe("OCCUPIED");
    expect(res.currentBooking?.guestName).toBe("Bob Overstay");
  });
});
