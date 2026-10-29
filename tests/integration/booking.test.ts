import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, BookingStatus, Role, PaymentKind } from "@prisma/client";
import * as sessionModule from "@/server/auth/session";
import { ROLES } from "@/lib/constants";
import { bookingService } from "@/server/services/booking.service";
import { createBookingAction } from "@/server/actions/booking.actions";
import { AppError } from "@/lib/errors";

const connectionString = process.env.DATABASE_URL_TEST || process.env.DATABASE_URL;

describe("Phase 1.5: Booking & Check-in (Integration)", () => {
  let pool: Pool;
  let prisma: PrismaClient;
  let testTypeId: string;
  let room201Id: string;
  let room202Id: string;
  let testStaffUser: { id: string; name: string; email: string; role: Role };

  const receptionistActor = {
    id: "receptionist-bkg-test-id",
    name: "Staff Test",
    email: "receptionist-bkg@hotelpaul.in",
    role: ROLES.RECEPTIONIST,
    isActive: true,
  };

  beforeAll(async () => {
    if (!connectionString) {
      throw new Error("No database connection string for tests");
    }
    pool = new Pool({ connectionString });
    const adapter = new PrismaPg(pool);
    prisma = new PrismaClient({ adapter });

    // 1. Ensure test staff user
    const user = await prisma.user.upsert({
      where: { email: "bkg-staff@hotelpaul.in" },
      update: {},
      create: {
        name: "Booking Staff",
        email: "bkg-staff@hotelpaul.in",
        role: Role.RECEPTIONIST,
      },
    });
    testStaffUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    };

    // 2. Dedicated room type
    const type = await prisma.roomType.create({
      data: { name: `BkgSuite_${Date.now()}` },
    });
    testTypeId = type.id;

    // 3. Two test rooms: ROOM-201 (active) and ROOM-202 (disabled)
    const room1 = await prisma.room.create({
      data: {
        number: `201_${Date.now()}`,
        typeId: testTypeId,
        pricePerNight: 2400,
        isActive: true,
      },
    });
    room201Id = room1.id;

    const room2 = await prisma.room.create({
      data: {
        number: `202_${Date.now()}`,
        typeId: testTypeId,
        pricePerNight: 3500,
        isActive: false, // Disabled
      },
    });
    room202Id = room2.id;
  });

  afterAll(async () => {
    await prisma.invoice.deleteMany({
      where: { booking: { roomId: { in: [room201Id, room202Id] } } },
    });
    await prisma.payment.deleteMany({
      where: { booking: { roomId: { in: [room201Id, room202Id] } } },
    });
    await prisma.bookingGuest.deleteMany({
      where: { booking: { roomId: { in: [room201Id, room202Id] } } },
    });
    await prisma.booking.deleteMany({
      where: { roomId: { in: [room201Id, room202Id] } },
    });
    await prisma.roomMaintenance.deleteMany({
      where: { roomId: { in: [room201Id, room202Id] } },
    });
    await prisma.roomProblem.deleteMany({
      where: { roomId: { in: [room201Id, room202Id] } },
    });
    await prisma.room.deleteMany({
      where: { id: { in: [room201Id, room202Id] } },
    });
    await prisma.roomType.delete({
      where: { id: testTypeId },
    });
    await prisma.$disconnect();
    await pool.end();
  });

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("creates a RESERVED booking and generates sequential human reference", async () => {
    const checkIn = new Date("2026-12-05T10:00:00.000Z");
    const checkOut = new Date("2026-12-07T10:00:00.000Z"); // 2 days

    const booking = await bookingService.createBooking(testStaffUser, {
      roomId: room201Id,
      checkInAt: checkIn,
      checkOutAt: checkOut,
      action: "RESERVE",
      source: "WALK_IN",
      rateApplied: 2400,
      discount: 0,
      advanceAmount: 0,
      guests: [
        {
          name: "Subhas Chandra Bose",
          fatherName: "Janakinath Bose",
          age: 45,
          sex: "MALE",
          mobile: "9876500001",
          isPrimary: true,
        },
      ],
    });

    expect(booking.id).toBeDefined();
    expect(booking.reference).toMatch(/^BK-\d{8}-\d{3}$/);
    expect(booking.status).toBe(BookingStatus.RESERVED);
    expect(booking.actualCheckInAt).toBeNull();
    expect(booking.primaryGuestName).toBe("Subhas Chandra Bose");
    expect(booking.stayDays).toBe(2);
    expect(booking.rateApplied).toBe(2400);
    expect(booking.advancePaid).toBe(0);
  });

  it("creates an immediate CHECKED_IN booking and records actualCheckInAt", async () => {
    const checkIn = new Date("2026-12-08T10:00:00.000Z");
    const checkOut = new Date("2026-12-09T10:00:00.000Z"); // 1 day

    const booking = await bookingService.createBooking(testStaffUser, {
      roomId: room201Id,
      checkInAt: checkIn,
      checkOutAt: checkOut,
      action: "CHECK_IN",
      source: "WALK_IN",
      rateApplied: 2400,
      discount: 200,
      advanceAmount: 0,
      guests: [
        {
          name: "Rabindranath Tagore",
          isPrimary: true,
          mobile: "9876500002",
        },
      ],
    });

    expect(booking.status).toBe(BookingStatus.CHECKED_IN);
    expect(booking.actualCheckInAt).not.toBeNull();
    expect(booking.discount).toBe(200);
  });

  it("records advance payment with mode and links Payment record", async () => {
    const checkIn = new Date("2026-12-10T10:00:00.000Z");
    const checkOut = new Date("2026-12-12T10:00:00.000Z");

    const booking = await bookingService.createBooking(testStaffUser, {
      roomId: room201Id,
      checkInAt: checkIn,
      checkOutAt: checkOut,
      action: "RESERVE",
      source: "PHONE",
      rateApplied: 2400,
      advanceAmount: 1500,
      advanceMode: "UPI",
      guests: [
        {
          name: "Kazi Nazrul Islam",
          isPrimary: true,
          mobile: "9876500003",
        },
      ],
    });

    expect(booking.advancePaid).toBe(1500);

    // Verify payment in database
    const payments = await prisma.payment.findMany({
      where: { bookingId: booking.id },
    });

    expect(payments).toHaveLength(1);
    expect(payments[0].kind).toBe(PaymentKind.ADVANCE);
    expect(payments[0].mode).toBe("UPI");
    expect(Number(payments[0].amount)).toBe(1500);
  });

  it("rejects double-booking overlapping an existing reservation with ROOM_OVERLAP", async () => {
    // There is already a booking on room201 from 2026-12-10T10:00 to 2026-12-12T10:00
    const overlappingCheckIn = new Date("2026-12-11T12:00:00.000Z");
    const overlappingCheckOut = new Date("2026-12-13T12:00:00.000Z");

    await expect(
      bookingService.createBooking(testStaffUser, {
        roomId: room201Id,
        checkInAt: overlappingCheckIn,
        checkOutAt: overlappingCheckOut,
        action: "RESERVE",
        source: "WALK_IN",
        rateApplied: 2400,
        advanceAmount: 0,
        guests: [{ name: "Conflicting Guest", isPrimary: true }],
      })
    ).rejects.toThrowError(AppError);

    try {
      await bookingService.createBooking(testStaffUser, {
        roomId: room201Id,
        checkInAt: overlappingCheckIn,
        checkOutAt: overlappingCheckOut,
        action: "RESERVE",
        source: "WALK_IN",
        rateApplied: 2400,
        advanceAmount: 0,
        guests: [{ name: "Conflicting Guest", isPrimary: true }],
      });
    } catch (err) {
      expect((err as AppError).code).toBe("ROOM_OVERLAP");
    }
  });

  it("blocks booking a room scheduled for maintenance with MAINTENANCE_OVERLAP", async () => {
    const maintStart = new Date("2026-12-15T08:00:00.000Z");
    const maintEnd = new Date("2026-12-16T18:00:00.000Z");

    await prisma.roomMaintenance.create({
      data: {
        roomId: room201Id,
        startsAt: maintStart,
        endsAt: maintEnd,
        reason: "Plumbing repair",
        createdById: testStaffUser.id,
      },
    });

    await expect(
      bookingService.createBooking(testStaffUser, {
        roomId: room201Id,
        checkInAt: new Date("2026-12-15T12:00:00.000Z"),
        checkOutAt: new Date("2026-12-16T12:00:00.000Z"),
        action: "RESERVE",
        source: "WALK_IN",
        rateApplied: 2400,
        advanceAmount: 0,
        guests: [{ name: "Guest During Maint", isPrimary: true }],
      })
    ).rejects.toThrowError(AppError);

    try {
      await bookingService.createBooking(testStaffUser, {
        roomId: room201Id,
        checkInAt: new Date("2026-12-15T12:00:00.000Z"),
        checkOutAt: new Date("2026-12-16T12:00:00.000Z"),
        action: "RESERVE",
        source: "WALK_IN",
        rateApplied: 2400,
        advanceAmount: 0,
        guests: [{ name: "Guest During Maint", isPrimary: true }],
      });
    } catch (err) {
      expect((err as AppError).code).toBe("MAINTENANCE_OVERLAP");
    }
  });

  it("rejects booking a disabled room with VALIDATION_ERROR", async () => {
    await expect(
      bookingService.createBooking(testStaffUser, {
        roomId: room202Id, // Disabled room
        checkInAt: new Date("2026-12-20T10:00:00.000Z"),
        checkOutAt: new Date("2026-12-21T10:00:00.000Z"),
        action: "RESERVE",
        source: "WALK_IN",
        rateApplied: 3500,
        advanceAmount: 0,
        guests: [{ name: "Disabled Room Guest", isPrimary: true }],
      })
    ).rejects.toThrowError(/is currently disabled/);
  });

  it("executes createBookingAction successfully with receptionist credentials", async () => {
    vi.spyOn(sessionModule, "requireSession").mockResolvedValue({
      actor: receptionistActor,
    });

    const checkIn = new Date("2026-12-25T10:00:00.000Z");
    const checkOut = new Date("2026-12-27T10:00:00.000Z");

    const result = await createBookingAction({
      roomId: room201Id,
      checkInAt: checkIn.toISOString(),
      checkOutAt: checkOut.toISOString(),
      action: "CHECK_IN",
      source: "ONLINE",
      rateApplied: 2400,
      discount: 0,
      advanceAmount: 1000,
      advanceMode: "CARD",
      guests: [
        {
          name: "Amartya Sen",
          isPrimary: true,
          mobile: "9876500004",
        },
      ],
    });

    expect(result.ok).toBe(true);
    if (!result.ok || !result.data) return;

    expect(result.data.status).toBe(BookingStatus.CHECKED_IN);
    expect(result.data.advancePaid).toBe(1000);
    expect(result.data.primaryGuestName).toBe("Amartya Sen");
  });
});
