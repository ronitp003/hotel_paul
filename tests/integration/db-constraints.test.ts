import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, BookingStatus, Role, PaymentKind, PaymentMode } from "@prisma/client";

const connectionString = process.env.DATABASE_URL;

describe("PostgreSQL Constraints & Exclusion Verification (Real DB)", () => {
  let pool: Pool;
  let prisma: PrismaClient;
  let testRoomId: string;
  let testUserId: string;

  beforeAll(async () => {
    if (!connectionString) {
      throw new Error("DATABASE_URL is not set for integration tests");
    }
    pool = new Pool({ connectionString });
    const adapter = new PrismaPg(pool);
    prisma = new PrismaClient({ adapter });

    // Ensure a test room exists
    const roomType = await prisma.roomType.upsert({
      where: { name: "Test Room Type" },
      update: {},
      create: { name: "Test Room Type" },
    });

    const room = await prisma.room.upsert({
      where: { number: "TEST-999" },
      update: {},
      create: {
        number: "TEST-999",
        pricePerNight: 1000,
        typeId: roomType.id,
      },
    });
    testRoomId = room.id;

    // Ensure a test user exists
    const user = await prisma.user.upsert({
      where: { email: "test-staff@hotelpaul.in" },
      update: {},
      create: {
        name: "Test Staff",
        email: "test-staff@hotelpaul.in",
        role: Role.RECEPTIONIST,
      },
    });
    testUserId = user.id;

    // Clean up any old test bookings for TEST-999
    await prisma.payment.deleteMany({ where: { booking: { roomId: testRoomId } } });
    await prisma.bookingGuest.deleteMany({ where: { booking: { roomId: testRoomId } } });
    await prisma.booking.deleteMany({ where: { roomId: testRoomId } });
    await prisma.roomMaintenance.deleteMany({ where: { roomId: testRoomId } });
  });

  afterAll(async () => {
    await prisma.payment.deleteMany({ where: { booking: { roomId: testRoomId } } });
    await prisma.bookingGuest.deleteMany({ where: { booking: { roomId: testRoomId } } });
    await prisma.booking.deleteMany({ where: { roomId: testRoomId } });
    await prisma.roomMaintenance.deleteMany({ where: { roomId: testRoomId } });
    await prisma.$disconnect();
    await pool.end();
  });

  it("fails with Postgres error 23P01 when inserting overlapping active bookings for the same room", async () => {
    const checkIn = new Date("2026-11-01T10:00:00.000Z");
    const checkOut = new Date("2026-11-02T10:00:00.000Z");

    // 1. Create first booking
    await prisma.booking.create({
      data: {
        reference: "BK-INT-001",
        roomId: testRoomId,
        status: BookingStatus.RESERVED,
        checkInAt: checkIn,
        checkOutAt: checkOut,
        rateApplied: 1000,
        createdById: testUserId,
      },
    });

    // 2. Attempt overlapping booking: 15:00 on Nov 1 to 15:00 on Nov 2
    const overlapCheckIn = new Date("2026-11-01T15:00:00.000Z");
    const overlapCheckOut = new Date("2026-11-02T15:00:00.000Z");

    try {
      await prisma.booking.create({
        data: {
          reference: "BK-INT-OVERLAP",
          roomId: testRoomId,
          status: BookingStatus.RESERVED,
          checkInAt: overlapCheckIn,
          checkOutAt: overlapCheckOut,
          rateApplied: 1000,
          createdById: testUserId,
        },
      });
    } catch (err: unknown) {
      // Prisma wraps raw database errors; check code or message
      const pgErr = err as { code?: string; meta?: { code?: string; message?: string }; message?: string };
      const msg = pgErr.message || "";
      expect(msg).toMatch(/23P01|exclusion constraint|booking_no_overlap/i);
    }
  });

  it("allows back-to-back stays on the same room (checkout 10:00 and next check-in 10:00)", async () => {
    // Booking 1 ends at 2026-11-02T10:00:00Z.
    // Booking 2 begins exactly at 2026-11-02T10:00:00Z.
    const backToBackCheckIn = new Date("2026-11-02T10:00:00.000Z");
    const backToBackCheckOut = new Date("2026-11-03T10:00:00.000Z");

    const booking2 = await prisma.booking.create({
      data: {
        reference: "BK-INT-BACKTOBACK",
        roomId: testRoomId,
        status: BookingStatus.CHECKED_IN,
        checkInAt: backToBackCheckIn,
        checkOutAt: backToBackCheckOut,
        rateApplied: 1000,
        createdById: testUserId,
      },
    });

    expect(booking2.id).toBeDefined();
    expect(booking2.reference).toBe("BK-INT-BACKTOBACK");
  });

  it("allows only ONE booking when two identical overlapping bookings are attempted concurrently", async () => {
    const concurrentCheckIn = new Date("2026-11-05T10:00:00.000Z");
    const concurrentCheckOut = new Date("2026-11-06T10:00:00.000Z");

    const [res1, res2] = await Promise.allSettled([
      prisma.booking.create({
        data: {
          reference: "BK-INT-CONCURRENT-A",
          roomId: testRoomId,
          status: BookingStatus.RESERVED,
          checkInAt: concurrentCheckIn,
          checkOutAt: concurrentCheckOut,
          rateApplied: 1000,
          createdById: testUserId,
        },
      }),
      prisma.booking.create({
        data: {
          reference: "BK-INT-CONCURRENT-B",
          roomId: testRoomId,
          status: BookingStatus.RESERVED,
          checkInAt: concurrentCheckIn,
          checkOutAt: concurrentCheckOut,
          rateApplied: 1000,
          createdById: testUserId,
        },
      }),
    ]);

    const successes = [res1, res2].filter((r) => r.status === "fulfilled");
    const failures = [res1, res2].filter((r) => r.status === "rejected");

    // Exactly one should succeed, and exactly one must be rejected by Postgres exclusion constraint
    expect(successes).toHaveLength(1);
    expect(failures).toHaveLength(1);
  });

  it("does not block rooms if an existing overlapping booking is CANCELLED", async () => {
    const cancelWindowStart = new Date("2026-11-10T10:00:00.000Z");
    const cancelWindowEnd = new Date("2026-11-11T10:00:00.000Z");

    // 1. Create a cancelled booking
    await prisma.booking.create({
      data: {
        reference: "BK-INT-CANCELLED",
        roomId: testRoomId,
        status: BookingStatus.CANCELLED,
        checkInAt: cancelWindowStart,
        checkOutAt: cancelWindowEnd,
        rateApplied: 1000,
        createdById: testUserId,
      },
    });

    // 2. Create a new active booking for the exact same room and time
    const activeBooking = await prisma.booking.create({
      data: {
        reference: "BK-INT-REPLACEMENT",
        roomId: testRoomId,
        status: BookingStatus.RESERVED,
        checkInAt: cancelWindowStart,
        checkOutAt: cancelWindowEnd,
        rateApplied: 1000,
        createdById: testUserId,
      },
    });

    expect(activeBooking.id).toBeDefined();
    expect(activeBooking.reference).toBe("BK-INT-REPLACEMENT");
  });

  it("enforces checkOutAt > checkInAt time order constraint", async () => {
    const checkIn = new Date("2026-11-15T12:00:00.000Z");
    const invalidCheckOut = new Date("2026-11-15T10:00:00.000Z"); // Before check-in

    await expect(
      prisma.booking.create({
        data: {
          reference: "BK-INT-INVALID-TIME",
          roomId: testRoomId,
          status: BookingStatus.RESERVED,
          checkInAt: checkIn,
          checkOutAt: invalidCheckOut,
          rateApplied: 1000,
          createdById: testUserId,
        },
      })
    ).rejects.toThrow(/booking_time_order|check constraint/i);
  });

  it("enforces payment amount > 0 check constraint", async () => {
    const validBooking = await prisma.booking.create({
      data: {
        reference: "BK-INT-PAYMENT-TEST",
        roomId: testRoomId,
        status: BookingStatus.RESERVED,
        checkInAt: new Date("2026-11-20T10:00:00.000Z"),
        checkOutAt: new Date("2026-11-21T10:00:00.000Z"),
        rateApplied: 1000,
        createdById: testUserId,
      },
    });

    await expect(
      prisma.payment.create({
        data: {
          bookingId: validBooking.id,
          kind: PaymentKind.ADVANCE,
          mode: PaymentMode.CASH,
          amount: 0, // Invalid: must be > 0
          createdById: testUserId,
        },
      })
    ).rejects.toThrow(/payment_positive|check constraint/i);
  });
});
