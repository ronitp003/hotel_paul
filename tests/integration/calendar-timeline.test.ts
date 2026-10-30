import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/server/db";
import { calendarService } from "@/server/services/calendar.service";
import { BookingStatus } from "@prisma/client";

describe("Phase 2.1: Calendar Timeline Service & Overlaps", () => {
  let testRoomId: string;
  let testBookingId: string;
  let testMaintenanceId: string;

  beforeAll(async () => {
    // 1. Ensure test room type exists
    let testType = await prisma.roomType.findFirst();
    if (!testType) {
      testType = await prisma.roomType.create({
        data: { name: "Calendar Deluxe Test" },
      });
    }

    // 2. Create test room
    const testRoom = await prisma.room.create({
      data: {
        number: `CAL-${Date.now().toString().slice(-4)}`,
        typeId: testType.id,
        pricePerNight: 2500,
        isActive: true,
      },
    });
    testRoomId = testRoom.id;

    // 3. Create a test booking from Day 2 10:00 to Day 4 10:00
    const checkIn = new Date("2026-11-02T10:00:00.000Z");
    const checkOut = new Date("2026-11-04T10:00:00.000Z");

    const testBooking = await prisma.booking.create({
      data: {
        reference: `BK-CAL-${Date.now().toString().slice(-4)}`,
        roomId: testRoomId,
        status: BookingStatus.CHECKED_IN,
        checkInAt: checkIn,
        checkOutAt: checkOut,
        rateApplied: 2500,
        discount: 0,
        createdById: "system-test",
        guests: {
          create: [
            {
              name: "Timeline Test Guest",
              mobile: "9876543210",
              isPrimary: true,
            },
          ],
        },
      },
    });
    testBookingId = testBooking.id;

    // 4. Create a test maintenance from Day 5 12:00 to Day 6 12:00
    const maint = await prisma.roomMaintenance.create({
      data: {
        roomId: testRoomId,
        startsAt: new Date("2026-11-05T12:00:00.000Z"),
        endsAt: new Date("2026-11-06T12:00:00.000Z"),
        reason: "AC Filter Cleaning & Servicing",
        createdById: "system-test",
      },
    });
    testMaintenanceId = maint.id;
  });

  afterAll(async () => {
    if (testBookingId) {
      await prisma.bookingGuest.deleteMany({ where: { bookingId: testBookingId } });
      await prisma.booking.delete({ where: { id: testBookingId } }).catch(() => {});
    }
    if (testMaintenanceId) {
      await prisma.roomMaintenance.delete({ where: { id: testMaintenanceId } }).catch(() => {});
    }
    if (testRoomId) {
      await prisma.room.delete({ where: { id: testRoomId } }).catch(() => {});
    }
  });

  it("retrieves rooms, overlapping bookings, and maintenance accurately in timeline range", async () => {
    // Range covering Nov 1 to Nov 7
    const startRange = new Date("2026-11-01T00:00:00.000Z");
    const endRange = new Date("2026-11-07T00:00:00.000Z");

    const timeline = await calendarService.getTimelineData(startRange, endRange);

    // 1. Room is present
    const room = timeline.rooms.find((r) => r.id === testRoomId);
    expect(room).toBeDefined();
    expect(room?.pricePerNight).toBe(2500);

    // 2. Booking is present
    const booking = timeline.bookings.find((b) => b.id === testBookingId);
    expect(booking).toBeDefined();
    expect(booking?.primaryGuestName).toBe("Timeline Test Guest");
    expect(booking?.primaryGuestMobile).toBe("9876543210");
    expect(booking?.status).toBe(BookingStatus.CHECKED_IN);
    expect(new Date(booking!.checkInAt).toISOString()).toBe("2026-11-02T10:00:00.000Z");
    expect(new Date(booking!.checkOutAt).toISOString()).toBe("2026-11-04T10:00:00.000Z");

    // 3. Maintenance is present
    const maintenance = timeline.maintenance.find((m) => m.id === testMaintenanceId);
    expect(maintenance).toBeDefined();
    expect(maintenance?.reason).toBe("AC Filter Cleaning & Servicing");
    expect(new Date(maintenance!.startsAt).toISOString()).toBe("2026-11-05T12:00:00.000Z");
    expect(new Date(maintenance!.endsAt).toISOString()).toBe("2026-11-06T12:00:00.000Z");
  });

  it("excludes bookings outside the query timeline range", async () => {
    // Range before the booking (Oct 20 to Oct 30)
    const startRange = new Date("2026-10-20T00:00:00.000Z");
    const endRange = new Date("2026-10-30T00:00:00.000Z");

    const timeline = await calendarService.getTimelineData(startRange, endRange);
    const booking = timeline.bookings.find((b) => b.id === testBookingId);
    expect(booking).toBeUndefined();

    const maintenance = timeline.maintenance.find((m) => m.id === testMaintenanceId);
    expect(maintenance).toBeUndefined();
  });
});
