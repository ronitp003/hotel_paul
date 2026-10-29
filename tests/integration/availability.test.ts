import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, BookingStatus, Role } from "@prisma/client";
import * as sessionModule from "@/server/auth/session";
import { ROLES } from "@/lib/constants";
import { roomService } from "@/server/services/room.service";
import { findAvailableRoomsAction } from "@/server/actions/room.actions";

const connectionString = process.env.DATABASE_URL_TEST || process.env.DATABASE_URL;

describe("Phase 1.4: Room Availability & Exclusion Constraints (Integration)", () => {
  let pool: Pool;
  let prisma: PrismaClient;
  let testTypeId: string;
  let room101Id: string;
  let room102Id: string;
  let testUserId: string;

  const receptionistActor = {
    id: "receptionist-avail-test-id",
    name: "Staff Test",
    email: "receptionist-avail@hotelpaul.in",
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

    // 1. Ensure test user exists
    const user = await prisma.user.upsert({
      where: { email: "avail-staff@hotelpaul.in" },
      update: {},
      create: {
        name: "Avail Staff",
        email: "avail-staff@hotelpaul.in",
        role: Role.RECEPTIONIST,
      },
    });
    testUserId = user.id;

    // 2. Create a dedicated RoomType
    const type = await prisma.roomType.create({
      data: { name: `AvailSuite_${Date.now()}` },
    });
    testTypeId = type.id;

    // 3. Create two test rooms: AVAIL-101 (active) and AVAIL-102 (disabled)
    const room1 = await prisma.room.create({
      data: {
        number: `AVAIL-101_${Date.now()}`,
        typeId: testTypeId,
        pricePerNight: 2500,
        isActive: true,
      },
    });
    room101Id = room1.id;

    const room2 = await prisma.room.create({
      data: {
        number: `AVAIL-102_${Date.now()}`,
        typeId: testTypeId,
        pricePerNight: 3000,
        isActive: false, // Inactive / disabled room
      },
    });
    room102Id = room2.id;
  });

  afterAll(async () => {
    // Clean up created test data
    await prisma.invoice.deleteMany({
      where: { booking: { roomId: { in: [room101Id, room102Id] } } },
    });
    await prisma.payment.deleteMany({
      where: { booking: { roomId: { in: [room101Id, room102Id] } } },
    });
    await prisma.bookingGuest.deleteMany({
      where: { booking: { roomId: { in: [room101Id, room102Id] } } },
    });
    await prisma.booking.deleteMany({
      where: { roomId: { in: [room101Id, room102Id] } },
    });
    await prisma.roomMaintenance.deleteMany({
      where: { roomId: { in: [room101Id, room102Id] } },
    });
    await prisma.roomProblem.deleteMany({
      where: { roomId: { in: [room101Id, room102Id] } },
    });
    await prisma.room.deleteMany({
      where: { id: { in: [room101Id, room102Id] } },
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

  it("reports active empty room as available and disabled room as disabled", async () => {
    const checkIn = new Date("2026-11-10T10:00:00.000Z");
    const checkOut = new Date("2026-11-12T10:00:00.000Z"); // 2 days stay

    const result = await roomService.findAvailableRooms(checkIn, checkOut, {
      typeId: testTypeId,
    });

    expect(result.stay.days).toBe(2);
    expect(result.totalCount).toBe(2);
    expect(result.availableCount).toBe(1);

    const r101 = result.rooms.find((r) => r.id === room101Id);
    expect(r101).toBeDefined();
    expect(r101?.isAvailable).toBe(true);
    expect(r101?.unavailableType).toBeNull();
    expect(r101?.unavailableReason).toBeNull();
    expect(r101?.pricePerNight).toBe(2500);
    expect(r101?.estimatedTotal).toBe(5000); // 2500 * 2 days

    const r102 = result.rooms.find((r) => r.id === room102Id);
    expect(r102).toBeDefined();
    expect(r102?.isAvailable).toBe(false);
    expect(r102?.unavailableType).toBe("DISABLED");
    expect(r102?.unavailableReason).toBe("Room is currently disabled");
  });

  it("detects booking conflict, marks room unavailable, and formats friendly reason", async () => {
    const bkgCheckIn = new Date("2026-11-10T10:00:00.000Z");
    const bkgCheckOut = new Date("2026-11-12T10:00:00.000Z");

    const booking = await prisma.booking.create({
      data: {
        reference: `BK-TEST-${Date.now()}`,
        roomId: room101Id,
        status: BookingStatus.RESERVED,
        checkInAt: bkgCheckIn,
        checkOutAt: bkgCheckOut,
        rateApplied: 2500,
        createdById: testUserId,
        guests: {
          create: [{ name: "Satyajit Ray", isPrimary: true }],
        },
      },
    });

    // 1. Query exact overlapping window
    const resultExact = await roomService.findAvailableRooms(bkgCheckIn, bkgCheckOut, {
      typeId: testTypeId,
    });
    const r101Exact = resultExact.rooms.find((r) => r.id === room101Id);

    expect(r101Exact?.isAvailable).toBe(false);
    expect(r101Exact?.unavailableType).toBe("RESERVED");
    expect(r101Exact?.unavailableReason).toContain("Reserved");
    expect(r101Exact?.conflictingBooking?.guestName).toBe("Satyajit Ray");
    expect(r101Exact?.conflictingBooking?.id).toBe(booking.id);

    // 2. Query partial overlap inside window
    const insideStart = new Date("2026-11-11T08:00:00.000Z");
    const insideEnd = new Date("2026-11-11T16:00:00.000Z");
    const resultInside = await roomService.findAvailableRooms(insideStart, insideEnd, {
      typeId: testTypeId,
    });
    const r101Inside = resultInside.rooms.find((r) => r.id === room101Id);
    expect(r101Inside?.isAvailable).toBe(false);
    expect(r101Inside?.unavailableType).toBe("RESERVED");
  });

  it("permits back-to-back stays where checkout at T matches next check-in at T", async () => {
    // Existing booking on room101 runs: 2026-11-10T10:00:00Z to 2026-11-12T10:00:00Z

    // 1. Prior stay: ends exactly at 2026-11-10T10:00:00Z
    const priorCheckIn = new Date("2026-11-08T10:00:00.000Z");
    const priorCheckOut = new Date("2026-11-10T10:00:00.000Z"); // Checkout matches checkin
    const priorResult = await roomService.findAvailableRooms(priorCheckIn, priorCheckOut, {
      typeId: testTypeId,
    });
    const r101Prior = priorResult.rooms.find((r) => r.id === room101Id);
    expect(r101Prior?.isAvailable).toBe(true);

    // 2. Subsequent stay: begins exactly at 2026-11-12T10:00:00Z
    const nextCheckIn = new Date("2026-11-12T10:00:00.000Z"); // Checkin matches checkout
    const nextCheckOut = new Date("2026-11-14T10:00:00.000Z");
    const nextResult = await roomService.findAvailableRooms(nextCheckIn, nextCheckOut, {
      typeId: testTypeId,
    });
    const r101Next = nextResult.rooms.find((r) => r.id === room101Id);
    expect(r101Next?.isAvailable).toBe(true);
  });

  it("allows excluding a booking ID when re-checking room availability during an edit", async () => {
    const existingBooking = await prisma.booking.findFirst({
      where: { roomId: room101Id },
    });
    expect(existingBooking).not.toBeNull();

    // Querying same window with excludeBookingId ignores this booking
    const result = await roomService.findAvailableRooms(
      existingBooking!.checkInAt,
      existingBooking!.checkOutAt,
      {
        typeId: testTypeId,
        excludeBookingId: existingBooking!.id,
      }
    );

    const r101 = result.rooms.find((r) => r.id === room101Id);
    expect(r101?.isAvailable).toBe(true);
  });

  it("detects maintenance period collision and reports reason", async () => {
    const maintStartsAt = new Date("2026-11-15T08:00:00.000Z");
    const maintEndsAt = new Date("2026-11-16T12:00:00.000Z");

    await prisma.roomMaintenance.create({
      data: {
        roomId: room101Id,
        startsAt: maintStartsAt,
        endsAt: maintEndsAt,
        reason: "Deep carpet cleaning",
        createdById: testUserId,
      },
    });

    const result = await roomService.findAvailableRooms(
      new Date("2026-11-15T10:00:00.000Z"),
      new Date("2026-11-17T10:00:00.000Z"),
      { typeId: testTypeId }
    );

    const r101 = result.rooms.find((r) => r.id === room101Id);
    expect(r101?.isAvailable).toBe(false);
    expect(r101?.unavailableType).toBe("MAINTENANCE");
    expect(r101?.unavailableReason).toContain("Under maintenance");
    expect(r101?.unavailableReason).toContain("Deep carpet cleaning");
  });

  it("does not block availability when existing booking is CANCELLED or CHECKED_OUT", async () => {
    // 1. Cancelled booking
    await prisma.booking.create({
      data: {
        reference: `BK-CANCELLED-${Date.now()}`,
        roomId: room101Id,
        status: BookingStatus.CANCELLED,
        checkInAt: new Date("2026-11-20T10:00:00.000Z"),
        checkOutAt: new Date("2026-11-22T10:00:00.000Z"),
        rateApplied: 2500,
        createdById: testUserId,
      },
    });

    const cancelResult = await roomService.findAvailableRooms(
      new Date("2026-11-20T10:00:00.000Z"),
      new Date("2026-11-22T10:00:00.000Z"),
      { typeId: testTypeId }
    );
    const r101Cancelled = cancelResult.rooms.find((r) => r.id === room101Id);
    expect(r101Cancelled?.isAvailable).toBe(true);

    // 2. Checked-out booking
    await prisma.booking.create({
      data: {
        reference: `BK-CHECKEDOUT-${Date.now()}`,
        roomId: room101Id,
        status: BookingStatus.CHECKED_OUT,
        checkInAt: new Date("2026-11-23T10:00:00.000Z"),
        checkOutAt: new Date("2026-11-25T10:00:00.000Z"),
        rateApplied: 2500,
        createdById: testUserId,
      },
    });

    const checkOutResult = await roomService.findAvailableRooms(
      new Date("2026-11-23T10:00:00.000Z"),
      new Date("2026-11-25T10:00:00.000Z"),
      { typeId: testTypeId }
    );
    const r101CheckedOut = checkOutResult.rooms.find((r) => r.id === room101Id);
    expect(r101CheckedOut?.isAvailable).toBe(true);
  });

  it("fails cleanly when two simultaneous bookings overlap via PostgreSQL exclusion constraint", async () => {
    const concurrentStart = new Date("2026-11-28T10:00:00.000Z");
    const concurrentEnd = new Date("2026-11-30T10:00:00.000Z");

    const [res1, res2] = await Promise.allSettled([
      prisma.booking.create({
        data: {
          reference: `BK-CONCURRENT-A-${Date.now()}`,
          roomId: room101Id,
          status: BookingStatus.RESERVED,
          checkInAt: concurrentStart,
          checkOutAt: concurrentEnd,
          rateApplied: 2500,
          createdById: testUserId,
        },
      }),
      prisma.booking.create({
        data: {
          reference: `BK-CONCURRENT-B-${Date.now()}`,
          roomId: room101Id,
          status: BookingStatus.RESERVED,
          checkInAt: concurrentStart,
          checkOutAt: concurrentEnd,
          rateApplied: 2500,
          createdById: testUserId,
        },
      }),
    ]);

    const successes = [res1, res2].filter((r) => r.status === "fulfilled");
    const failures = [res1, res2].filter((r) => r.status === "rejected");

    // Exactly one should succeed and one must be rejected by Postgres exclusion constraint
    expect(successes).toHaveLength(1);
    expect(failures).toHaveLength(1);

    const rejectedReason = (failures[0] as PromiseRejectedResult).reason;
    const msg = rejectedReason?.message || "";
    expect(msg).toMatch(/23P01|exclusion constraint|booking_no_overlap/i);
  });

  it("executes findAvailableRoomsAction successfully with receptionist credentials", async () => {
    vi.spyOn(sessionModule, "requireSession").mockResolvedValue({
      actor: receptionistActor,
    });

    const checkIn = "2026-12-01T10:00:00.000Z";
    const checkOut = "2026-12-03T10:00:00.000Z";

    const response = await findAvailableRoomsAction(checkIn, checkOut, {
      typeId: testTypeId,
    });

    expect(response.ok).toBe(true);
    if (!response.ok || !response.data) return;

    expect(response.data.stay.days).toBe(2);
    expect(response.data.totalCount).toBe(2);
    expect(response.data.rooms.length).toBe(2);
  });
});
