import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import * as sessionModule from "@/server/auth/session";
import { ROLES } from "@/lib/constants";
import {
  createRoomAction,
  bulkCreateRoomsAction,
  updateRoomAction,
  toggleRoomActiveAction,
} from "@/server/actions/room.actions";
import { roomService } from "@/server/services/room.service";

const connectionString = process.env.DATABASE_URL_TEST || process.env.DATABASE_URL;

describe("Phase 1.3 Rooms Inventory & Management (Integration)", () => {
  let pool: Pool;
  let prisma: PrismaClient;
  let testTypeId: string;

  const ownerActor = {
    id: "owner-rooms-test-id",
    name: "Owner Test",
    email: "owner@hotelpaul.in",
    role: ROLES.OWNER,
    isActive: true,
  };

  const receptionistActor = {
    id: "receptionist-rooms-test-id",
    name: "Staff Test",
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

    // Create a dedicated RoomType for tests
    const type = await prisma.roomType.create({
      data: { name: `Test Type ${Date.now()}` },
    });
    testTypeId = type.id;
  });

  afterAll(async () => {
    // Clean up created rooms and types
    await prisma.room.deleteMany({ where: { typeId: testTypeId } });
    await prisma.roomType.delete({ where: { id: testTypeId } });
    await prisma.$disconnect();
    await pool.end();
  });

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("Security: Receptionist is strictly forbidden from mutating rooms", () => {
    beforeEach(() => {
      vi.spyOn(sessionModule, "requireSession").mockResolvedValue({
        actor: receptionistActor,
      });
    });

    it("forbids createRoomAction", async () => {
      const res = await createRoomAction({
        number: "999",
        typeId: testTypeId,
        pricePerNight: 2000,
        isActive: true,
      });
      expect(res.ok).toBe(false);
      expect(res.code).toBe("FORBIDDEN");
    });

    it("forbids bulkCreateRoomsAction", async () => {
      const res = await bulkCreateRoomsAction({
        prefix: "B-",
        startNumber: 901,
        endNumber: 905,
        typeId: testTypeId,
        pricePerNight: 2000,
        isActive: true,
      });
      expect(res.ok).toBe(false);
      expect(res.code).toBe("FORBIDDEN");
    });

    it("forbids updateRoomAction", async () => {
      const res = await updateRoomAction("any-id", {
        number: "999",
        typeId: testTypeId,
        pricePerNight: 2000,
        isActive: true,
      });
      expect(res.ok).toBe(false);
      expect(res.code).toBe("FORBIDDEN");
    });

    it("forbids toggleRoomActiveAction", async () => {
      const res = await toggleRoomActiveAction("any-id", false);
      expect(res.ok).toBe(false);
      expect(res.code).toBe("FORBIDDEN");
    });
  });

  describe("Owner: Room Creation, Bulk Batching & Collision Handling", () => {
    let createdRoomId: string;
    const singleRoomNumber = `SR-${Date.now().toString().slice(-4)}`;

    beforeEach(() => {
      vi.spyOn(sessionModule, "requireSession").mockResolvedValue({
        actor: ownerActor,
      });
    });

    it("creates a single room and records an audit log entry", async () => {
      const auditsBefore = await prisma.auditLog.count({
        where: { action: "room.create" },
      });

      const res = await createRoomAction({
        number: singleRoomNumber,
        typeId: testTypeId,
        pricePerNight: 2500,
        isActive: true,
      });

      expect(res.ok).toBe(true);
      const data = res.data as { id: string; number: string; pricePerNight: number };
      expect(data.number).toBe(singleRoomNumber);
      expect(data.pricePerNight).toBe(2500);
      expect(typeof data.pricePerNight).toBe("number"); // Plain number verification
      createdRoomId = data.id;

      const auditsAfter = await prisma.auditLog.count({
        where: { action: "room.create" },
      });
      expect(auditsAfter).toBe(auditsBefore + 1);
    });

    it("rejects duplicate room numbers case-insensitively", async () => {
      const res = await createRoomAction({
        number: singleRoomNumber.toLowerCase(),
        typeId: testTypeId,
        pricePerNight: 3000,
        isActive: true,
      });

      expect(res.ok).toBe(false);
      expect(res.code).toBe("VALIDATION_ERROR");
      expect(res.message).toMatch(/already exists/i);
    });

    it("bulk creates rooms by numerical range in a single batch", async () => {
      const prefix = `BLK-${Date.now().toString().slice(-3)}-`;
      const res = await bulkCreateRoomsAction({
        prefix,
        startNumber: 1,
        endNumber: 3,
        typeId: testTypeId,
        pricePerNight: 2200,
        isActive: true,
      });

      expect(res.ok).toBe(true);
      const data = res.data as { count: number; numbers: string[] };
      expect(data.count).toBe(3);
      expect(data.numbers).toEqual([`${prefix}1`, `${prefix}2`, `${prefix}3`]);

      // Check rooms exist in DB
      const createdCount = await prisma.room.count({
        where: { number: { in: data.numbers } },
      });
      expect(createdCount).toBe(3);
    });

    it("rejects bulk creation when any room in range already exists", async () => {
      // Attempting to bulk create a range that contains singleRoomNumber
      const firstRes = await bulkCreateRoomsAction({
        prefix: "",
        startNumber: 1,
        endNumber: 2,
        typeId: testTypeId,
        pricePerNight: 2000,
        isActive: true,
      });
      expect(firstRes.ok).toBe(true);

      // Now attempt duplicate on the same range
      const duplicateRes = await bulkCreateRoomsAction({
        prefix: "",
        startNumber: 1,
        endNumber: 2,
        typeId: testTypeId,
        pricePerNight: 2000,
        isActive: true,
      });

      expect(duplicateRes.ok).toBe(false);
      expect(duplicateRes.code).toBe("VALIDATION_ERROR");
      expect(duplicateRes.message).toMatch(/already exist/i);
    });

    it("updates room rate and logs audit difference", async () => {
      const res = await updateRoomAction(createdRoomId, {
        number: singleRoomNumber,
        typeId: testTypeId,
        pricePerNight: 3500,
        isActive: true,
      });

      expect(res.ok).toBe(true);
      const data = res.data as { pricePerNight: number };
      expect(data.pricePerNight).toBe(3500);

      const latestAudit = await prisma.auditLog.findFirst({
        where: { action: "room.update", entityId: createdRoomId },
        orderBy: { createdAt: "desc" },
      });
      expect(latestAudit).not.toBeNull();
      const meta = latestAudit?.metadata as { after?: { pricePerNight?: number } };
      expect(meta?.after?.pricePerNight).toBe(3500);
    });

    it("toggles room active status and logs audit entry", async () => {
      const deactivateRes = await toggleRoomActiveAction(createdRoomId, false);
      expect(deactivateRes.ok).toBe(true);
      const deactData = deactivateRes.data as { isActive: boolean };
      expect(deactData.isActive).toBe(false);

      const activateRes = await toggleRoomActiveAction(createdRoomId, true);
      expect(activateRes.ok).toBe(true);
      const actData = activateRes.data as { isActive: boolean };
      expect(actData.isActive).toBe(true);
    });

    it("lists rooms with derived status and verifies plain object numbers", async () => {
      const list = await roomService.listRoomsWithStatus({ typeId: testTypeId });
      expect(list.length).toBeGreaterThan(0);

      const target = list.find((r) => r.id === createdRoomId);
      expect(target).toBeDefined();
      expect(target?.status).toBe("AVAILABLE");
      expect(typeof target?.pricePerNight).toBe("number");
      expect(target?.pricePerNight).toBe(3500);
      expect(target?.pricePerNight).not.toHaveProperty("d"); // No Decimal instance
    });
  });
});
