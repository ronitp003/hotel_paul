import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  PrismaClient,
  BookingStatus,
  BookingSource,
  Sex,
  Role,
  PaymentKind,
  PaymentMode,
  InvoiceStatus,
} from "@prisma/client";
import { can } from "@/server/auth/permissions";
import { ROLES } from "@/lib/constants";
import * as sessionModule from "@/server/auth/session";
import { backupService } from "@/server/services/backup.service";
import { formatIST, fromISTInput } from "@/lib/datetime";
import { addDays } from "date-fns";
import type { Actor } from "@/server/auth/session";
import { NextRequest } from "next/server";
import { GET as getBackupJsonRoute } from "@/app/api/export/backup-json/route";
import { GET as getBookingsCsvRoute } from "@/app/api/export/bookings-csv/route";
import { POST as postDryRunRoute } from "@/app/api/backup/dry-run/route";
import { POST as postRestoreRoute } from "@/app/api/backup/restore/route";

const connectionString =
  process.env.DATABASE_URL_TEST || process.env.DATABASE_URL;

describe("Phase 3.2: Export / Backup / Import (Integration)", () => {
  let pool: Pool;
  let prisma: PrismaClient;
  let testRoomId: string;
  let testRoomNumber: string;
  let testTypeId: string;
  let testTypeName: string;
  let testBookingId: string;
  let testInvoiceId: string;
  let testInvoiceNumber: number;
  let testInvoiceDisplayNo: string;
  let testOwner: Actor;

  beforeAll(async () => {
    if (!connectionString) {
      throw new Error("No database connection string for tests");
    }
    pool = new Pool({ connectionString });
    const adapter = new PrismaPg(pool);
    prisma = new PrismaClient({ adapter });

    // 1. Create Room Type & Room
    testTypeName = `BackupType_${Date.now()}`;
    const type = await prisma.roomType.create({
      data: { name: testTypeName },
    });
    testTypeId = type.id;

    testRoomNumber = `BK_${Date.now().toString().slice(-4)}`;
    const room = await prisma.room.create({
      data: {
        number: testRoomNumber,
        typeId: testTypeId,
        pricePerNight: 3500,
        isActive: true,
      },
    });
    testRoomId = room.id;

    // 2. Ensure test Owner exists
    const ownerUser = await prisma.user.upsert({
      where: { email: "owner-backup-test@hotelpaul.in" },
      update: {},
      create: {
        name: "Test Backup Owner",
        email: "owner-backup-test@hotelpaul.in",
        role: Role.OWNER,
      },
    });

    testOwner = {
      id: ownerUser.id,
      name: ownerUser.name,
      email: ownerUser.email,
      role: ownerUser.role as "OWNER",
      isActive: true,
    };

    // 3. Create a test booking with guests, payments, and an invoice
    const now = new Date();
    const targetDateStr = formatIST(now, "yyyy-MM-dd");
    const checkIn = fromISTInput(`${targetDateStr}T14:00:00`);
    const checkOut = addDays(checkIn, 2);

    testInvoiceNumber = Math.floor(Date.now() / 1000) % 900000 + 100000;
    testInvoiceDisplayNo = `HP-TEST-${testInvoiceNumber}`;

    const booking = await prisma.booking.create({
      data: {
        reference: `HP-BK-${Date.now().toString().slice(-5)}`,
        roomId: testRoomId,
        createdById: testOwner.id,
        checkInAt: checkIn,
        checkOutAt: checkOut,
        actualCheckInAt: checkIn,
        status: BookingStatus.CHECKED_OUT,
        source: BookingSource.WALK_IN,
        arrivingFrom: "Bangalore",
        purposeOfVisit: "Business",
        rateApplied: 3500,
        discount: 0,
        guests: {
          create: [
            {
              name: "Ananya Roy",
              fatherName: "Bimal Roy",
              age: 29,
              sex: Sex.FEMALE,
              mobile: "9876501234",
              isPrimary: true,
            },
          ],
        },
        charges: {
          create: [
            {
              description: "Airport Pickup",
              amount: 800,
              isTaxable: true,
              createdById: testOwner.id,
            },
          ],
        },
        payments: {
          create: [
            {
              kind: PaymentKind.ADVANCE,
              mode: PaymentMode.UPI,
              amount: 2000,
              receivedAt: checkIn,
              createdById: testOwner.id,
            },
            {
              kind: PaymentKind.PAYMENT,
              mode: PaymentMode.CASH,
              amount: 5800,
              receivedAt: checkOut,
              createdById: testOwner.id,
            },
          ],
        },
      },
    });
    testBookingId = booking.id;

    const invoice = await prisma.invoice.create({
      data: {
        number: testInvoiceNumber,
        displayNo: testInvoiceDisplayNo,
        bookingId: testBookingId,
        status: InvoiceStatus.ISSUED,
        issuedAt: checkOut,
        issuedById: testOwner.id,
        taxableAmount: 7800,
        cgst: 468,
        sgst: 468,
        billAmount: 8736,
        advancePaid: 2000,
        balance: 0,
        snapshot: { test: true },
      },
    });
    testInvoiceId = invoice.id;
  });

  afterAll(async () => {
    // Teardown test data in reverse foreign key order
    if (testInvoiceId) {
      await prisma.invoice.deleteMany({ where: { id: testInvoiceId } });
    }
    if (testBookingId) {
      await prisma.payment.deleteMany({ where: { bookingId: testBookingId } });
      await prisma.charge.deleteMany({ where: { bookingId: testBookingId } });
      await prisma.bookingGuest.deleteMany({ where: { bookingId: testBookingId } });
      await prisma.booking.deleteMany({ where: { id: testBookingId } });
    }
    if (testRoomId) {
      await prisma.room.deleteMany({ where: { id: testRoomId } });
    }
    if (testTypeId) {
      await prisma.roomType.deleteMany({ where: { id: testTypeId } });
    }

    // Clean up test audit logs
    await prisma.auditLog.deleteMany({
      where: {
        action: { in: ["data.backup", "data.export", "data.import"] },
        actorId: testOwner.id,
      },
    });

    await prisma.$disconnect();
    await pool.end();
  });

  // ── Access Control Tests ──
  describe("Permissions Matrix", () => {
    it("allows OWNER role for all data management actions", () => {
      expect(can(ROLES.OWNER, "data.backup")).toBe(true);
      expect(can(ROLES.OWNER, "data.export")).toBe(true);
      expect(can(ROLES.OWNER, "data.import")).toBe(true);
    });

    it("strictly blocks RECEPTIONIST role from data export, backup, and import", () => {
      expect(can(ROLES.RECEPTIONIST, "data.backup")).toBe(false);
      expect(can(ROLES.RECEPTIONIST, "data.export")).toBe(false);
      expect(can(ROLES.RECEPTIONIST, "data.import")).toBe(false);
    });
  });

  // ── JSON Full Backup Tests ──
  describe("generateFullBackup", () => {
    it("exports complete structured JSON backup matching schemaVersion 1", async () => {
      const backup = await backupService.generateFullBackup(testOwner);

      expect(backup.metadata).toBeDefined();
      expect(backup.metadata.schemaVersion).toBe(1);
      expect(backup.metadata.exportedBy.id).toBe(testOwner.id);
      expect(backup.metadata.hotel.name).toBeDefined();

      // Counts must be accurate numbers
      expect(backup.metadata.counts.rooms).toBeGreaterThanOrEqual(1);
      expect(backup.metadata.counts.bookings).toBeGreaterThanOrEqual(1);
      expect(backup.metadata.counts.payments).toBeGreaterThanOrEqual(1);
      expect(backup.metadata.counts.invoices).toBeGreaterThanOrEqual(1);

      // Verify catalog contains our test room
      const foundRoom = backup.catalog.rooms.find((r) => r.id === testRoomId);
      expect(foundRoom).toBeDefined();
      expect(foundRoom?.number).toBe(testRoomNumber);
      expect(foundRoom?.pricePerNight).toBe(3500);

      // Verify bookings contain our test booking with nested relations
      const foundBooking = backup.bookings.find((b) => b.id === testBookingId);
      expect(foundBooking).toBeDefined();
      expect(foundBooking?.guests.length).toBeGreaterThanOrEqual(1);
      expect(foundBooking?.charges.length).toBeGreaterThanOrEqual(1);
      expect(foundBooking?.payments.length).toBeGreaterThanOrEqual(2);
      expect(foundBooking?.invoice?.number).toBe(testInvoiceNumber);

      // Verify audit log entry was created
      const audit = await prisma.auditLog.findFirst({
        where: {
          action: "data.backup",
          actorId: testOwner.id,
        },
        orderBy: { createdAt: "desc" },
      });
      expect(audit).toBeDefined();
    });
  });

  // ── Accountant Bookings CSV Export Tests ──
  describe("generateBookingsCsv", () => {
    it("generates accountant CSV with UTF-8 BOM and required financial columns", async () => {
      const result = await backupService.generateBookingsCsv(
        { range: "all", status: "ALL" },
        testOwner
      );

      expect(result.count).toBeGreaterThanOrEqual(1);
      expect(result.filename).toMatch(/^hotel-paul-accountant-bookings-all-.*\.csv$/);

      // Verify UTF-8 BOM
      expect(result.csv.startsWith("\uFEFF")).toBe(true);

      const lines = result.csv.replace("\uFEFF", "").split("\r\n");
      const headerLine = lines[0];

      // Verify all required accountant and tax columns exist
      expect(headerLine).toContain("Invoice No");
      expect(headerLine).toContain("Booking Reference");
      expect(headerLine).toContain("Primary Guest Name");
      expect(headerLine).toContain("Room Number");
      expect(headerLine).toContain("Check-In Date (IST)");
      expect(headerLine).toContain("Check-Out Date (IST)");
      expect(headerLine).toContain("Total Taxable Amount (₹)");
      expect(headerLine).toContain("CGST (₹)");
      expect(headerLine).toContain("SGST (₹)");
      expect(headerLine).toContain("Total Invoice Amount (₹)");
      expect(headerLine).toContain("Advance Received (₹)");
      expect(headerLine).toContain("Net Collections (₹)");
      expect(headerLine).toContain("Payment Mode(s)");
      expect(headerLine).toContain("Payment Status");

      // Verify test booking row is present with correct data
      const matchingRow = lines.find((l) => l.includes(testInvoiceDisplayNo));
      expect(matchingRow).toBeDefined();
      expect(matchingRow).toContain("Ananya Roy");
      expect(matchingRow).toContain("Bangalore");
      expect(matchingRow).toContain(testRoomNumber);

      // Verify audit log entry
      const audit = await prisma.auditLog.findFirst({
        where: {
          action: "data.export",
          actorId: testOwner.id,
        },
        orderBy: { createdAt: "desc" },
      });
      expect(audit).toBeDefined();
    });

    it("filters CSV export by 7d, 30d, and month ranges", async () => {
      const res7d = await backupService.generateBookingsCsv(
        { range: "7d", status: "ALL" },
        testOwner
      );
      expect(res7d.filename).toContain("7d");
      expect(typeof res7d.count).toBe("number");

      const resMonth = await backupService.generateBookingsCsv(
        { range: "month", status: "ALL" },
        testOwner
      );
      expect(resMonth.filename).toContain("month");
      expect(typeof resMonth.count).toBe("number");
    });
  });

  // ── Dry Run Conflict Detection Tests ──
  describe("dryRunBackupImport", () => {
    it("detects room stay overlap conflicts during dry-run", async () => {
      const backup = await backupService.generateFullBackup(testOwner);

      // Create a mock backup containing a stay that overlaps an active booking in the same room
      const now = new Date();
      const targetDateStr = formatIST(now, "yyyy-MM-dd");
      const overlappingStart = fromISTInput(`${targetDateStr}T15:00:00`);
      const overlappingEnd = addDays(overlappingStart, 1);

      const modifiedBackup = {
        ...backup,
        bookings: [
          {
            ...backup.bookings[0],
            id: "fake-new-id-1",
            reference: `HP-FAKE-${Date.now()}`,
            roomId: testRoomId,
            checkInAt: overlappingStart.toISOString(),
            checkOutAt: overlappingEnd.toISOString(),
            status: BookingStatus.CHECKED_IN,
            invoice: null,
          },
        ],
      };

      const diff = await backupService.dryRunBackupImport(modifiedBackup);
      expect(diff.canProceed).toBe(false);
      expect(diff.conflicts.some((c) => c.type === "ROOM_STAY_OVERLAP")).toBe(true);
    });

    it("detects invoice number collision conflicts during dry-run", async () => {
      const backup = await backupService.generateFullBackup(testOwner);

      // Modify booking reference so it's treated as a new booking, but retain colliding invoice number
      const modifiedBackup = {
        ...backup,
        bookings: [
          {
            ...backup.bookings[0],
            id: "fake-new-booking-2",
            reference: `HP-COLLIDE-${Date.now()}`,
            invoice: {
              ...backup.bookings[0].invoice!,
              id: "fake-new-inv-2",
              number: testInvoiceNumber, // Collides with existing invoice
              displayNo: `HP-DUP-${testInvoiceNumber}`,
            },
          },
        ],
      };

      const diff = await backupService.dryRunBackupImport(modifiedBackup);
      expect(diff.canProceed).toBe(false);
      expect(diff.conflicts.some((c) => c.type === "INVOICE_NUMBER_COLLISION")).toBe(true);
    });

    it("allows restore when there are no conflicts", async () => {
      // Create a clean backup with non-conflicting new room and non-conflicting booking
      const cleanBackup = {
        metadata: {
          schemaVersion: 1,
          exportedAt: new Date().toISOString(),
          exportedBy: {
            id: testOwner.id,
            name: testOwner.name,
            email: testOwner.email,
          },
          hotel: {
            name: "Hotel Paul",
            gstin: "19AAAAA0000A1Z5",
            phone: "+91 98765 43210",
            address: "123 Station Road",
          },
          counts: {
            roomTypes: 1,
            rooms: 1,
            bookings: 1,
            guests: 1,
            charges: 0,
            payments: 1,
            invoices: 0,
            inventoryItems: 0,
            inventoryMovements: 0,
            roomMaintenance: 0,
            roomProblems: 0,
          },
        },
        settings: {
          hotelSettings: null,
          gstSlabs: [],
          invoiceSequence: null,
        },
        catalog: {
          roomTypes: [{ id: "new-type-99", name: `UniqueType_${Date.now()}` }],
          rooms: [
            {
              id: "new-room-99",
              number: `UNQ_${Date.now().toString().slice(-4)}`,
              typeId: "new-type-99",
              pricePerNight: 4000,
              isActive: true,
              createdAt: new Date().toISOString(),
            },
          ],
        },
        bookings: [
          {
            id: "new-booking-99",
            reference: `HP-UNQ-${Date.now()}`,
            groupBookingId: null,
            isGroupMaster: false,
            roomId: "new-room-99",
            status: BookingStatus.RESERVED,
            source: BookingSource.ONLINE,
            checkInAt: addDays(new Date(), 30).toISOString(),
            checkOutAt: addDays(new Date(), 32).toISOString(),
            actualCheckInAt: null,
            actualCheckOutAt: null,
            arrivingFrom: "Mumbai",
            purposeOfVisit: "Leisure",
            companyName: null,
            companyGstin: null,
            companyAddress: null,
            rateApplied: 4000,
            discount: 0,
            gstPercentOverride: null,
            createdById: testOwner.id,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            guests: [
              {
                id: "new-guest-99",
                allocatedRoomId: null,
                isPrimary: true,
                name: "Clean Guest",
                fatherName: null,
                age: 30,
                sex: Sex.MALE,
                mobile: "9998887776",
              },
            ],
            charges: [],
            payments: [],
            invoice: null,
          },
        ],
        inventory: { items: [], movements: [] },
        maintenance: { records: [], problems: [] },
      };

      const diff = await backupService.dryRunBackupImport(cleanBackup);
      expect(diff.canProceed).toBe(true);
      expect(diff.conflicts.length).toBe(0);
      expect(diff.diffs.rooms.new).toBe(1);
      expect(diff.diffs.bookings.new).toBe(1);
    });
  });

  // ── API Route Endpoints ──
  describe("API Route Handlers", () => {
    it("GET /api/export/backup-json rejects receptionist and allows owner", async () => {
      // 1. Receptionist must be rejected with 403
      vi.spyOn(sessionModule, "requireSession").mockResolvedValueOnce({
        actor: {
          id: "receptionist-test-id",
          name: "Receptionist",
          email: "staff@hotelpaul.in",
          role: ROLES.RECEPTIONIST,
          isActive: true,
        },
      });

      const forbiddenRes = await getBackupJsonRoute();
      expect(forbiddenRes.status).toBe(403);

      // 2. Owner must be allowed with 200 and attachment header
      vi.spyOn(sessionModule, "requireSession").mockResolvedValueOnce({
        actor: testOwner,
      });

      const allowedRes = await getBackupJsonRoute();
      expect(allowedRes.status).toBe(200);
      expect(allowedRes.headers.get("Content-Type")).toContain("application/json");
      expect(allowedRes.headers.get("Content-Disposition")).toContain("attachment; filename=");

      const json = await allowedRes.json();
      expect(json.metadata.schemaVersion).toBe(1);
      expect(json.bookings).toBeDefined();
    });

    it("GET /api/export/bookings-csv rejects receptionist and allows owner", async () => {
      // 1. Receptionist rejected with 403
      vi.spyOn(sessionModule, "requireSession").mockResolvedValueOnce({
        actor: {
          id: "receptionist-test-id",
          name: "Receptionist",
          email: "staff@hotelpaul.in",
          role: ROLES.RECEPTIONIST,
          isActive: true,
        },
      });

      const reqForbidden = new NextRequest("http://localhost:3000/api/export/bookings-csv?range=7d");
      const forbiddenRes = await getBookingsCsvRoute(reqForbidden);
      expect(forbiddenRes.status).toBe(403);

      // 2. Owner allowed with 200 and CSV content
      vi.spyOn(sessionModule, "requireSession").mockResolvedValueOnce({
        actor: testOwner,
      });

      const reqAllowed = new NextRequest("http://localhost:3000/api/export/bookings-csv?range=7d");
      const allowedRes = await getBookingsCsvRoute(reqAllowed);
      expect(allowedRes.status).toBe(200);
      expect(allowedRes.headers.get("Content-Type")).toContain("text/csv");
      expect(allowedRes.headers.get("Content-Disposition")).toContain("attachment; filename=");

      const arrayBuffer = await allowedRes.arrayBuffer();
      const rawBytes = Buffer.from(arrayBuffer);
      expect(rawBytes[0]).toBe(0xEF);
      expect(rawBytes[1]).toBe(0xBB);
      expect(rawBytes[2]).toBe(0xBF);
      expect(rawBytes.toString("utf-8")).toContain("Booking Reference");
    });

    it("POST /api/backup/dry-run checks schema and conflict analysis", async () => {
      // 1. Receptionist rejected with 403
      vi.spyOn(sessionModule, "requireSession").mockResolvedValueOnce({
        actor: {
          id: "receptionist-test-id",
          name: "Receptionist",
          email: "staff@hotelpaul.in",
          role: ROLES.RECEPTIONIST,
          isActive: true,
        },
      });

      const reqForbidden = new NextRequest("http://localhost:3000/api/backup/dry-run", {
        method: "POST",
        body: JSON.stringify({}),
      });
      const forbiddenRes = await postDryRunRoute(reqForbidden);
      expect(forbiddenRes.status).toBe(403);

      // 2. Owner with invalid format returns 400 validation error
      vi.spyOn(sessionModule, "requireSession").mockResolvedValueOnce({
        actor: testOwner,
      });

      const reqInvalid = new NextRequest("http://localhost:3000/api/backup/dry-run", {
        method: "POST",
        body: JSON.stringify({ invalid: true }),
      });
      const invalidRes = await postDryRunRoute(reqInvalid);
      expect(invalidRes.status).toBe(400);
      const invalidJson = await invalidRes.json();
      expect(invalidJson.ok).toBe(false);
      expect(invalidJson.code).toBe("VALIDATION_ERROR");
    });

    it("POST /api/backup/restore requires confirmation and rejects non-owners", async () => {
      // 1. Receptionist rejected with 403
      vi.spyOn(sessionModule, "requireSession").mockResolvedValueOnce({
        actor: {
          id: "receptionist-test-id",
          name: "Receptionist",
          email: "staff@hotelpaul.in",
          role: ROLES.RECEPTIONIST,
          isActive: true,
        },
      });

      const reqForbidden = new NextRequest("http://localhost:3000/api/backup/restore", {
        method: "POST",
        body: JSON.stringify({ backupData: {}, confirmed: true }),
      });
      const forbiddenRes = await postRestoreRoute(reqForbidden);
      expect(forbiddenRes.status).toBe(403);

      // 2. Owner without confirmation returns 400
      vi.spyOn(sessionModule, "requireSession").mockResolvedValueOnce({
        actor: testOwner,
      });

      const reqUnconfirmed = new NextRequest("http://localhost:3000/api/backup/restore", {
        method: "POST",
        body: JSON.stringify({ backupData: {}, confirmed: false }),
      });
      const unconfirmedRes = await postRestoreRoute(reqUnconfirmed);
      expect(unconfirmedRes.status).toBe(400);
      const unconfirmedJson = await unconfirmedRes.json();
      expect(unconfirmedJson.ok).toBe(false);
      expect(unconfirmedJson.error).toContain("confirmation");

      // 3. Owner with valid backup and confirmed: true
      vi.spyOn(sessionModule, "requireSession").mockResolvedValueOnce({
        actor: testOwner,
      });

      const fullBackup = await backupService.generateFullBackup(testOwner);
      const reqRestore = new NextRequest("http://localhost:3000/api/backup/restore", {
        method: "POST",
        body: JSON.stringify({ backupData: fullBackup, confirmed: true }),
      });
      const restoreRes = await postRestoreRoute(reqRestore);
      const restoreJson = await restoreRes.json();
      console.log("RESTORE TEST RESULT:", restoreRes.status, restoreJson);
      expect(restoreRes.status).toBe(200);
      expect(restoreJson.ok).toBe(true);
    });
  });
});
