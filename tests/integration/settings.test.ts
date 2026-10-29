import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, InvoiceStatus } from "@prisma/client";
import * as sessionModule from "@/server/auth/session";
import { ROLES } from "@/lib/constants";
import {
  updateHotelDetailsAction,
  updateBillingSettingsAction,
  updateInvoiceSettingsAction,
  createGstSlabAction,
  updateGstSlabAction,
  toggleGstSlabAction,
  deleteGstSlabAction,
} from "@/server/actions/settings.actions";
import {
  createRoomTypeAction,
  updateRoomTypeAction,
  deleteRoomTypeAction,
} from "@/server/actions/room-type.actions";

const connectionString = process.env.DATABASE_URL_TEST || process.env.DATABASE_URL;

describe("Phase 1.2 Settings & Room Types (Integration)", () => {
  let pool: Pool;
  let prisma: PrismaClient;
  const ownerActor = {
    id: "owner-test-id",
    name: "Owner Test",
    email: "owner@hotelpaul.in",
    role: ROLES.OWNER,
    isActive: true,
  };
  const receptionistActor = {
    id: "receptionist-test-id",
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

    // Ensure HotelSettings and InvoiceSequence rows exist
    await prisma.hotelSettings.upsert({
      where: { id: 1 },
      update: {},
      create: {
        id: 1,
        name: "Hotel Paul Test",
        address: "Test Address",
        phone: "+91 98765 43210",
        gstin: "19AAAAA0000A1Z5",
        invoicePrefix: "HP-",
        invoiceNotes: "Test Notes",
        graceMinutes: 0,
        roundBillToRupee: false,
        gstOnOtherCharges: false,
      },
    });

    await prisma.invoiceSequence.upsert({
      where: { id: 1 },
      update: {},
      create: { id: 1, nextNo: 1001 },
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await pool.end();
  });

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("Security: Receptionist is strictly forbidden from all settings actions", () => {
    beforeEach(() => {
      vi.spyOn(sessionModule, "requireSession").mockResolvedValue({
        actor: receptionistActor,
      });
    });

    it("forbids updateHotelDetailsAction", async () => {
      const res = await updateHotelDetailsAction({
        name: "Hacked Hotel",
        address: "123 St",
        phone: "+91 98765 43210",
        gstin: "",
      });
      expect(res.ok).toBe(false);
      expect(res.code).toBe("FORBIDDEN");
    });

    it("forbids updateBillingSettingsAction", async () => {
      const res = await updateBillingSettingsAction({
        graceMinutes: 30,
        roundBillToRupee: true,
        gstOnOtherCharges: true,
      });
      expect(res.ok).toBe(false);
      expect(res.code).toBe("FORBIDDEN");
    });

    it("forbids updateInvoiceSettingsAction", async () => {
      const res = await updateInvoiceSettingsAction({
        invoicePrefix: "HACK-",
        invoiceNotes: "Notes",
        nextNo: 9999,
      });
      expect(res.ok).toBe(false);
      expect(res.code).toBe("FORBIDDEN");
    });

    it("forbids GST slab actions", async () => {
      const createRes = await createGstSlabAction({
        minRate: 0,
        maxRate: null,
        percent: 18,
        isActive: true,
      });
      expect(createRes.ok).toBe(false);
      expect(createRes.code).toBe("FORBIDDEN");

      const updateRes = await updateGstSlabAction("any-id", {
        minRate: 0,
        maxRate: null,
        percent: 18,
        isActive: true,
      });
      expect(updateRes.ok).toBe(false);
      expect(updateRes.code).toBe("FORBIDDEN");

      const toggleRes = await toggleGstSlabAction("any-id", false);
      expect(toggleRes.ok).toBe(false);
      expect(toggleRes.code).toBe("FORBIDDEN");

      const deleteRes = await deleteGstSlabAction("any-id");
      expect(deleteRes.ok).toBe(false);
      expect(deleteRes.code).toBe("FORBIDDEN");
    });

    it("forbids room type actions", async () => {
      const createRes = await createRoomTypeAction({ name: "Hacked Type" });
      expect(createRes.ok).toBe(false);
      expect(createRes.code).toBe("FORBIDDEN");

      const updateRes = await updateRoomTypeAction("any-id", { name: "Renamed" });
      expect(updateRes.ok).toBe(false);
      expect(updateRes.code).toBe("FORBIDDEN");

      const deleteRes = await deleteRoomTypeAction("any-id");
      expect(deleteRes.ok).toBe(false);
      expect(deleteRes.code).toBe("FORBIDDEN");
    });
  });

  describe("Invoice Sequence Validation", () => {
    it("rejects next invoice number lower than highest issued invoice + 1", async () => {
      vi.spyOn(sessionModule, "requireSession").mockResolvedValue({
        actor: ownerActor,
      });

      // Create an isolated test room
      const testRoom = await prisma.room.create({
        data: {
          number: `R-INV-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
          pricePerNight: 1000,
          type: { create: { name: `Type-INV-${Date.now()}-${Math.floor(Math.random() * 10000)}` } },
        },
      });

      const testBooking = await prisma.booking.create({
        data: {
          reference: `BK-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
          roomId: testRoom.id,
          checkInAt: new Date(),
          checkOutAt: new Date(Date.now() + 86400000),
          rateApplied: 1000,
          createdById: ownerActor.id,
        },
      });

      const testInvoice = await prisma.invoice.create({
        data: {
          number: 2000,
          displayNo: `HP-2000-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
          bookingId: testBooking.id,
          status: InvoiceStatus.ISSUED,
          issuedAt: new Date(),
          issuedById: ownerActor.id,
          taxableAmount: 1000,
          cgst: 25,
          sgst: 25,
          billAmount: 1050,
          advancePaid: 0,
          balance: 0,
          snapshot: { test: true },
        },
      });

      try {
        // Attempting to set nextNo <= 2000 must fail
        const res = await updateInvoiceSettingsAction({
          invoicePrefix: "HP-",
          invoiceNotes: "Thank you",
          nextNo: 2000,
        });

        expect(res.ok).toBe(false);
        expect(res.code).toBe("VALIDATION_ERROR");
        expect(res.message).toMatch(/cannot be lower than 2001/);

        // Attempting to set nextNo = 2001 must succeed
        const validRes = await updateInvoiceSettingsAction({
          invoicePrefix: "HP-",
          invoiceNotes: "Thank you",
          nextNo: 2001,
        });
        expect(validRes.ok).toBe(true);
      } finally {
        await prisma.invoice.deleteMany({ where: { id: testInvoice.id } });
        await prisma.booking.deleteMany({ where: { id: testBooking.id } });
        await prisma.room.deleteMany({ where: { id: testRoom.id } });
      }
    });
  });

  describe("GST Slabs Continuity & Validation", () => {
    beforeEach(() => {
      vi.spyOn(sessionModule, "requireSession").mockResolvedValue({
        actor: ownerActor,
      });
    });

    it("rejects overlapping or gapped GST slabs", async () => {
      // Overlapping slab: attempting to create a slab with minRate 5000 when an active slab covers up to 7500
      const overlapRes = await createGstSlabAction({
        minRate: 5000,
        maxRate: 10000,
        percent: 12,
        isActive: true,
      });
      expect(overlapRes.ok).toBe(false);
      expect(overlapRes.code).toBe("VALIDATION_ERROR");

      // Gapped slab: attempting to create a slab with minRate 9000
      const gapRes = await createGstSlabAction({
        minRate: 9000,
        maxRate: null,
        percent: 28,
        isActive: true,
      });
      expect(gapRes.ok).toBe(false);
      expect(gapRes.code).toBe("VALIDATION_ERROR");
    });
  });

  describe("Room Type Uniqueness & Delete Guard", () => {
    let createdTypeId: string;
    const testTypeName = `Suite Deluxe ${Date.now()}`;

    beforeEach(() => {
      vi.spyOn(sessionModule, "requireSession").mockResolvedValue({
        actor: ownerActor,
      });
    });

    it("creates a room type and logs exactly one audit entry", async () => {
      const auditsBefore = await prisma.auditLog.count({
        where: { action: "roomType.create" },
      });

      const res = await createRoomTypeAction({ name: testTypeName });
      expect(res.ok).toBe(true);
      createdTypeId = (res.data as { id: string }).id;

      const auditsAfter = await prisma.auditLog.count({
        where: { action: "roomType.create" },
      });
      expect(auditsAfter).toBe(auditsBefore + 1);
    });

    it("rejects case-insensitive duplicate room type names", async () => {
      const res = await createRoomTypeAction({
        name: testTypeName.toLowerCase(),
      });
      expect(res.ok).toBe(false);
      expect(res.code).toBe("VALIDATION_ERROR");
      expect(res.message).toMatch(/already exists/i);
    });

    it("blocks room type deletion when rooms are assigned to it", async () => {
      // Create a temporary room referencing this room type
      const testRoom = await prisma.room.create({
        data: {
          number: `T-${Date.now()}`,
          pricePerNight: 2000,
          typeId: createdTypeId,
        },
      });

      try {
        const res = await deleteRoomTypeAction(createdTypeId);
        expect(res.ok).toBe(false);
        expect(res.code).toBe("VALIDATION_ERROR");
        expect(res.message).toMatch(/Cannot delete.*room.*assigned/i);
      } finally {
        await prisma.room.delete({ where: { id: testRoom.id } });
      }
    });

    it("allows deletion when no rooms are assigned and writes audit log", async () => {
      const auditsBefore = await prisma.auditLog.count({
        where: { action: "roomType.delete" },
      });

      const res = await deleteRoomTypeAction(createdTypeId);
      expect(res.ok).toBe(true);

      const auditsAfter = await prisma.auditLog.count({
        where: { action: "roomType.delete" },
      });
      expect(auditsAfter).toBe(auditsBefore + 1);
    });
  });

  describe("Hotel Settings Mutations & Audit Diff", () => {
    it("updates hotel details and records before/after diff in audit log", async () => {
      vi.spyOn(sessionModule, "requireSession").mockResolvedValue({
        actor: ownerActor,
      });

      const uniquePhone = `+91 98765 ${Math.floor(10000 + Math.random() * 90000)}`;
      const res = await updateHotelDetailsAction({
        name: "Hotel Paul Updated",
        address: "Bolpur Santiniketan Road",
        phone: uniquePhone,
        gstin: "19AAAAA0000A1Z5",
      });

      expect(res.ok).toBe(true);

      const latestAudit = await prisma.auditLog.findFirst({
        where: { action: "settings.updateHotelDetails" },
        orderBy: { createdAt: "desc" },
      });

      expect(latestAudit).not.toBeNull();
      expect(latestAudit?.actorId).toBe(ownerActor.id);
      const meta = latestAudit?.metadata as { after?: { phone?: string } } | null;
      expect(meta?.after?.phone).toBe(uniquePhone);
    });
  });
});
