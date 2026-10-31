import "dotenv/config";
import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  vi,
} from "vitest";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import * as sessionModule from "@/server/auth/session";
import { ROLES } from "@/lib/constants";
import {
  logProblemAction,
  markProblemFixedAction,
  createMaintenanceAction,
  deleteMaintenanceAction,
  closeMaintenanceAction,
  checkMaintenanceConflictsAction,
} from "@/server/actions/room-maintenance.actions";
import { roomService } from "@/server/services/room.service";
import { roomMaintenanceService } from "@/server/services/room-maintenance.service";
import { Prisma } from "@prisma/client";

const connectionString =
  process.env.DATABASE_URL_TEST || process.env.DATABASE_URL;

describe("Phase 2.2: Room Problems & Maintenance (Integration)", () => {
  let pool: Pool;
  let prisma: PrismaClient;
  let testRoomId: string;
  let testRoomNumber: string;

  const receptionistActor = {
    id: "receptionist-test-user-id",
    name: "Staff Receptionist",
    email: "receptionist@hotelpaul.in",
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

    // Create a dedicated RoomType and Room for testing
    const type = await prisma.roomType.create({
      data: { name: `Test Maintenance Type ${Date.now()}` },
    });

    testRoomNumber = `T-${Date.now().toString().slice(-4)}`;
    const room = await prisma.room.create({
      data: {
        number: testRoomNumber,
        typeId: type.id,
        pricePerNight: 2500,
        isActive: true,
      },
    });
    testRoomId = room.id;
  });

  afterAll(async () => {
    if (testRoomId) {
      await prisma.roomProblem.deleteMany({ where: { roomId: testRoomId } });
      await prisma.roomMaintenance.deleteMany({ where: { roomId: testRoomId } });
      await prisma.payment.deleteMany({
        where: { booking: { roomId: testRoomId } },
      });
      await prisma.bookingGuest.deleteMany({
        where: { booking: { roomId: testRoomId } },
      });
      await prisma.booking.deleteMany({ where: { roomId: testRoomId } });
      await prisma.room.deleteMany({ where: { id: testRoomId } });
    }
    await prisma.$disconnect();
    await pool.end();
  });

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(sessionModule, "requireSession").mockResolvedValue({
      actor: receptionistActor,
    });
  });

  it("logs a room problem with severity, audit log, and marks derived problem status", async () => {
    const res = await logProblemAction({
      roomId: testRoomId,
      severity: "HIGH",
      description: "Air conditioner leaking water on carpet.",
    });

    expect(res.ok).toBe(true);
    expect(res.data).toBeDefined();
    const problem = res.data as {
      id: string;
      severity: string;
      status: string;
      reportedById: string;
    };
    expect(problem.severity).toBe("HIGH");
    expect(problem.status).toBe("OPEN");
    expect(problem.reportedById).toBe(receptionistActor.id);

    // Verify Audit Log
    const audit = await prisma.auditLog.findFirst({
      where: {
        entity: "RoomProblem",
        entityId: problem.id,
        action: "ROOM_PROBLEM_LOGGED",
      },
    });
    expect(audit).not.toBeNull();
    expect(audit?.actorId).toBe(receptionistActor.id);

    // Verify room status now shows hasProblem = true
    const roomStatus = await roomService.getRoomStatus(testRoomId);
    expect(roomStatus.hasProblem).toBe(true);
    expect(roomStatus.openProblemsCount).toBe(1);
  });

  it("marks an open problem as fixed, records fixer info, and resolves room problem flag", async () => {
    // 1. Get the open problem
    const openProblem = await prisma.roomProblem.findFirst({
      where: { roomId: testRoomId, status: "OPEN" },
    });
    expect(openProblem).not.toBeNull();

    // 2. Mark fixed
    const res = await markProblemFixedAction({
      problemId: openProblem?.id || "",
    });
    expect(res.ok).toBe(true);
    const fixed = res.data as {
      id: string;
      status: string;
      fixedById: string;
      fixedAt: Date | null;
    };
    expect(fixed.status).toBe("FIXED");
    expect(fixed.fixedById).toBe(receptionistActor.id);
    expect(fixed.fixedAt).not.toBeNull();

    // Verify Audit Log
    const audit = await prisma.auditLog.findFirst({
      where: {
        entity: "RoomProblem",
        entityId: openProblem?.id || "",
        action: "ROOM_PROBLEM_FIXED",
      },
    });
    expect(audit).not.toBeNull();

    // Verify room status has cleared open problem
    const roomStatus = await roomService.getRoomStatus(testRoomId);
    expect(roomStatus.hasProblem).toBe(false);
    expect(roomStatus.openProblemsCount).toBe(0);
  });

  it("schedules a maintenance period, blocks room availability, and warns on booking collisions", async () => {
    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const dayAfter = new Date(now.getTime() + 48 * 60 * 60 * 1000);

    // 1. Create a future booking on the room
    const booking = await prisma.booking.create({
      data: {
        reference: `BK-TEST-${Date.now().toString().slice(-4)}`,
        roomId: testRoomId,
        status: "RESERVED",
        checkInAt: tomorrow,
        checkOutAt: dayAfter,
        rateApplied: 2500,
        createdById: receptionistActor.id,
        guests: {
          create: {
            name: "Rajesh Test",
            isPrimary: true,
            mobile: "9876543210",
          },
        },
      },
    });
    expect(booking.id).toBeDefined();

    // 2. Attempt to schedule maintenance overlapping with the booking -> must strictly fail
    const failRes = await createMaintenanceAction({
      roomId: testRoomId,
      startsAt: tomorrow.toISOString(),
      endsAt: dayAfter.toISOString(),
      reason: "Complete bathroom pipe renovation",
      confirmOverlap: false,
    });
    expect(failRes.ok).toBe(false);
    expect(failRes.code).toBe("MAINTENANCE_OVERLAP");

    // Even if confirmOverlap = true is sent, system MUST NOT permit maintenance on occupied/reserved room
    const failResWithConfirm = await createMaintenanceAction({
      roomId: testRoomId,
      startsAt: tomorrow.toISOString(),
      endsAt: dayAfter.toISOString(),
      reason: "Complete bathroom pipe renovation",
      confirmOverlap: true,
    });
    expect(failResWithConfirm.ok).toBe(false);
    expect(failResWithConfirm.code).toBe("MAINTENANCE_OVERLAP");

    // 3. Room becomes free (e.g. booking is removed/checked-out)
    await prisma.booking.delete({ where: { id: booking.id } });

    // Now scheduling maintenance on the free room succeeds
    const successRes = await createMaintenanceAction({
      roomId: testRoomId,
      startsAt: tomorrow.toISOString(),
      endsAt: dayAfter.toISOString(),
      reason: "Complete bathroom pipe renovation",
    });
    expect(successRes.ok).toBe(true);
    const maintenance = successRes.data as { id: string };
    expect(maintenance.id).toBeDefined();

    // Verify maintenance collision is immediately detected
    const maintConflictRes = await checkMaintenanceConflictsAction({
      roomId: testRoomId,
      startsAt: tomorrow.toISOString(),
      endsAt: dayAfter.toISOString(),
    });
    expect(maintConflictRes.ok).toBe(true);
    const maintConflictData = maintConflictRes.data as {
      maintenance: Array<{ id: string; reason: string }>;
      roomUpcomingMaintenance: Array<{ id: string; reason: string }>;
    };
    expect(maintConflictData.maintenance.length).toBeGreaterThanOrEqual(1);
    expect(maintConflictData.maintenance[0]?.reason).toBe(
      "Complete bathroom pipe renovation"
    );

    // Verify roomService.listRoomsWithStatus includes upcoming maintenance
    const roomsWithStatus = await roomService.listRoomsWithStatus();
    const testRoom = roomsWithStatus.find((r) => r.id === testRoomId);
    expect(testRoom).toBeDefined();
    expect(testRoom?.upcomingMaintenance?.length).toBeGreaterThanOrEqual(1);
    expect(testRoom?.upcomingMaintenance?.[0]?.reason).toBe(
      "Complete bathroom pipe renovation"
    );

    // Verify Audit Log
    const audit = await prisma.auditLog.findFirst({
      where: {
        entity: "RoomMaintenance",
        entityId: maintenance.id,
        action: "ROOM_MAINTENANCE_SCHEDULED",
      },
    });
    expect(audit).not.toBeNull();

    // 4. Cancel / remove maintenance period
    const deleteRes = await deleteMaintenanceAction({
      maintenanceId: maintenance.id,
    });
    expect(deleteRes.ok).toBe(true);

    const checkDeleted = await prisma.roomMaintenance.findUnique({
      where: { id: maintenance.id },
    });
    expect(checkDeleted).toBeNull();
  });

  it("fetches room details and serializes all values into plain objects with no Decimal instances", async () => {
    // Create an active checked-in booking with payment
    const now = new Date();
    const checkIn = new Date(now.getTime() - 2 * 60 * 60 * 1000);
    const checkOut = new Date(now.getTime() + 22 * 60 * 60 * 1000);

    const booking = await prisma.booking.create({
      data: {
        reference: `BK-RSC-${Date.now().toString().slice(-4)}`,
        roomId: testRoomId,
        status: "CHECKED_IN",
        checkInAt: checkIn,
        checkOutAt: checkOut,
        actualCheckInAt: checkIn,
        rateApplied: 2500,
        discount: 100,
        createdById: receptionistActor.id,
        guests: {
          create: {
            name: "Serialization Test Guest",
            isPrimary: true,
            mobile: "9876543210",
          },
        },
        payments: {
          create: {
            kind: "ADVANCE",
            mode: "CASH",
            amount: 1500,
            receivedAt: now,
            createdById: receptionistActor.id,
          },
        },
      },
    });

    // Fetch details
    const details = await roomMaintenanceService.getRoomDetails(testRoomId);

    expect(details.room.id).toBe(testRoomId);
    expect(typeof details.room.pricePerNight).toBe("number");
    expect(details.room.pricePerNight).toBe(2500);

    // Verify currentBooking
    expect(details.currentBooking).not.toBeNull();
    if (details.currentBooking) {
      expect(typeof details.currentBooking.rateApplied).toBe("number");
      expect(typeof details.currentBooking.discount).toBe("number");
      expect(details.currentBooking.rateApplied).toBe(2500);
      expect(details.currentBooking.discount).toBe(100);
    }

    // Verify recentBookings
    expect(details.recentBookings.length).toBeGreaterThanOrEqual(1);
    const recent = details.recentBookings.find((b) => b.id === booking.id);
    expect(recent).toBeDefined();
    expect(typeof recent?.rateApplied).toBe("number");
    expect(typeof recent?.totalPaid).toBe("number");
    expect(recent?.totalPaid).toBe(1500);

    // Recursively assert NO Prisma.Decimal instances anywhere in the response
    function assertNoDecimal(obj: unknown, path = "root"): void {
      if (obj === null || obj === undefined) return;
      if (obj instanceof Prisma.Decimal) {
        throw new Error(`Found Prisma.Decimal at ${path}`);
      }
      if (typeof obj === "object") {
        if (obj instanceof Date) return;
        for (const [key, value] of Object.entries(obj)) {
          assertNoDecimal(value, `${path}.${key}`);
        }
      }
    }

    expect(() => assertNoDecimal(details)).not.toThrow();

    // Clean up test booking so testRoomId remains free
    await prisma.payment.deleteMany({ where: { bookingId: booking.id } });
    await prisma.booking.delete({ where: { id: booking.id } });
  });

  it("includes open problem descriptions in listRoomsWithStatus for staff inspection", async () => {
    // Log a test problem
    await logProblemAction({
      roomId: testRoomId,
      severity: "CRITICAL",
      description: "Broken electrical switch near bed.",
    });

    const rooms = await roomService.listRoomsWithStatus();
    const targetRoom = rooms.find((r) => r.id === testRoomId);

    expect(targetRoom).toBeDefined();
    expect(targetRoom?.hasProblem).toBe(true);
    expect(targetRoom?.openProblems).toBeDefined();
    expect(targetRoom?.openProblems?.length).toBeGreaterThanOrEqual(1);

    const problem = targetRoom?.openProblems?.find(
      (p) => p.description === "Broken electrical switch near bed."
    );
    expect(problem).toBeDefined();
    expect(problem?.severity).toBe("CRITICAL");
  });

  it("differentiates between Close Maintenance (saves to history) and Remove Block (discards completely)", async () => {
    const now = new Date();
    const startsAt = new Date(now.getTime() - 1000 * 60 * 60); // 1 hr ago
    const endsAt = new Date(now.getTime() + 1000 * 60 * 60 * 48); // 48 hrs in future

    // 1. Create maintenance to close early
    const createRes = await createMaintenanceAction({
      roomId: testRoomId,
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
      reason: "AC duct deep cleaning",
    });
    expect(createRes.ok).toBe(true);
    const maintId = (createRes.data as { id: string }).id;

    // Verify it is active
    let details = await roomMaintenanceService.getRoomDetails(testRoomId);
    expect(details.activeMaintenance.some((m) => m.id === maintId)).toBe(true);

    // 2. Close Maintenance early
    const closeRes = await closeMaintenanceAction({
      maintenanceId: maintId,
      completionNote: "Finished duct filter replacement early",
    });
    expect(closeRes.ok).toBe(true);

    // Verify it is NO LONGER active and is moved to pastMaintenance (saved in history!)
    details = await roomMaintenanceService.getRoomDetails(testRoomId);
    expect(details.activeMaintenance.some((m) => m.id === maintId)).toBe(false);
    const completedEntry = details.pastMaintenance.find((m) => m.id === maintId);
    expect(completedEntry).toBeDefined();
    expect(completedEntry?.reason).toContain("Finished duct filter replacement early");
    expect(new Date(completedEntry!.endsAt).getTime()).toBeLessThanOrEqual(Date.now() + 5000);

    // 3. Create accidental maintenance block to remove completely
    const accidentalStart = new Date(now.getTime() + 1000 * 60 * 60 * 72); // 72 hrs in future
    const accidentalEnd = new Date(now.getTime() + 1000 * 60 * 60 * 96); // 96 hrs in future
    const accidentalRes = await createMaintenanceAction({
      roomId: testRoomId,
      startsAt: accidentalStart.toISOString(),
      endsAt: accidentalEnd.toISOString(),
      reason: "Accidental test maintenance entry",
    });
    expect(accidentalRes.ok).toBe(true);
    const accidentalId = (accidentalRes.data as { id: string }).id;

    // 4. Remove Block completely
    const deleteRes = await deleteMaintenanceAction({
      maintenanceId: accidentalId,
    });
    expect(deleteRes.ok).toBe(true);

    // Verify it does NOT exist in activeMaintenance NOR pastMaintenance!
    details = await roomMaintenanceService.getRoomDetails(testRoomId);
    expect(details.activeMaintenance.some((m) => m.id === accidentalId)).toBe(false);
    expect(details.pastMaintenance.some((m) => m.id === accidentalId)).toBe(false);
  });

  it("allows immediately scheduling new maintenance after closing an earlier maintenance without collision", async () => {
    // Dedicated room for complete isolation
    const roomType = await prisma.roomType.findFirst();
    const dedicatedRoom = await prisma.room.create({
      data: {
        number: `T-MNT-${Date.now().toString().slice(-4)}`,
        typeId: roomType!.id,
        pricePerNight: 2000,
        isActive: true,
      },
    });

    try {
      // 1. Create a 3-day maintenance starting in the future
      const now = new Date();
      const futureStart = new Date(now.getTime() + 1000 * 60 * 10); // 10 mins in future
      const futureEnd = new Date(now.getTime() + 1000 * 60 * 60 * 24 * 3); // 3 days in future

      const initialRes = await createMaintenanceAction({
        roomId: dedicatedRoom.id,
        startsAt: futureStart.toISOString(),
        endsAt: futureEnd.toISOString(),
        reason: "Initial 3-day maintenance block",
      });
      expect(initialRes.ok).toBe(true);
      const maintId = (initialRes.data as { id: string }).id;

      // 2. Close the maintenance early (sets endsAt to completedAt <= now)
      const closeRes = await closeMaintenanceAction({
        maintenanceId: maintId,
        completionNote: "Finished early",
      });
      expect(closeRes.ok).toBe(true);

      // 3. Test sub-minute scheduling: startsAt precedes completion by a few seconds (minute truncation)
      const currentMinuteStart = new Date(Date.now() - 5000);
      const newEnd = new Date(Date.now() + 1000 * 60 * 60 * 24); // 1 day
      const conflictRes = await checkMaintenanceConflictsAction({
        roomId: dedicatedRoom.id,
        startsAt: currentMinuteStart.toISOString(),
        endsAt: newEnd.toISOString(),
      });
      expect(conflictRes.ok).toBe(true);
      const conflictData = conflictRes.data as {
        maintenance: Array<{ id: string; reason: string }>;
      };
      expect(conflictData.maintenance.length).toBe(0);

      // 4. Immediately schedule the new maintenance -> must succeed with NO collision
      const secondCreateRes = await createMaintenanceAction({
        roomId: dedicatedRoom.id,
        startsAt: currentMinuteStart.toISOString(),
        endsAt: newEnd.toISOString(),
        reason: "New immediate maintenance block",
        confirmOverlap: false,
      });
      expect(secondCreateRes.ok).toBe(true);
    } finally {
      await prisma.roomMaintenance.deleteMany({
        where: { roomId: dedicatedRoom.id },
      });
      await prisma.room.delete({ where: { id: dedicatedRoom.id } });
    }
  });
});

