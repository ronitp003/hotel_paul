import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, BookingStatus, InvoiceStatus, Role } from "@prisma/client";
import * as sessionModule from "@/server/auth/session";
import { dashboardService } from "@/server/services/dashboard.service";
import { GET } from "@/app/api/dashboard/route";
import { dashboardSummarySchema } from "@/features/dashboard/schemas";
import { startOfISTDay, endOfISTDay } from "@/lib/datetime";

const connectionString = process.env.DATABASE_URL_TEST || process.env.DATABASE_URL;

describe("Phase 1.7: Dashboard v1 (Integration)", () => {
  let pool: Pool;
  let prisma: PrismaClient;
  let testRoomId: string;
  let testTypeId: string;
  let testBookingId: string;
  let testInvoiceId: string;

  beforeAll(async () => {
    if (!connectionString) {
      throw new Error("No database connection string for tests");
    }
    pool = new Pool({ connectionString });
    const adapter = new PrismaPg(pool);
    prisma = new PrismaClient({ adapter });

    // 1. Create a dedicated test room type and room
    const type = await prisma.roomType.create({
      data: { name: `DashType_${Date.now()}` },
    });
    testTypeId = type.id;

    const room = await prisma.room.create({
      data: {
        number: `DASH_${Date.now()}`,
        typeId: testTypeId,
        pricePerNight: 2000,
        isActive: true,
      },
    });
    testRoomId = room.id;

    // 2. Ensure test user
    const user = await prisma.user.upsert({
      where: { email: "dash-staff@hotelpaul.in" },
      update: {},
      create: {
        name: "Dashboard Staff",
        email: "dash-staff@hotelpaul.in",
        role: Role.RECEPTIONIST,
      },
    });

    // 3. Create a booking checking in and checking out today (IST)
    const now = new Date();
    const todayStart = startOfISTDay(now);
    const todayEnd = endOfISTDay(now);

    const booking = await prisma.booking.create({
      data: {
        reference: `BK-DASH-${Date.now()}`,
        roomId: testRoomId,
        status: BookingStatus.CHECKED_IN,
        checkInAt: todayStart,
        checkOutAt: todayEnd,
        rateApplied: 2000,
        createdById: user.id,
        guests: {
          create: {
            name: "Rajesh Sharma",
            mobile: "9876543210",
            isPrimary: true,
          },
        },
      },
    });
    testBookingId = booking.id;

    // 4. Create an issued invoice within this month
    const invoice = await prisma.invoice.create({
      data: {
        number: 99999 + Math.floor(Math.random() * 10000),
        displayNo: `INV-DASH-${Date.now()}`,
        bookingId: testBookingId,
        status: InvoiceStatus.ISSUED,
        issuedAt: now,
        issuedById: user.id,
        taxableAmount: 2000,
        cgst: 50,
        sgst: 50,
        billAmount: 2100,
        advancePaid: 2100,
        balance: 0,
        snapshot: { test: true },
      },
    });
    testInvoiceId = invoice.id;
  });

  afterAll(async () => {
    if (testInvoiceId) {
      await prisma.invoice.deleteMany({ where: { id: testInvoiceId } });
    }
    if (testBookingId) {
      await prisma.payment.deleteMany({ where: { bookingId: testBookingId } });
      await prisma.bookingGuest.deleteMany({ where: { bookingId: testBookingId } });
      await prisma.booking.deleteMany({ where: { id: testBookingId } });
    }
    if (testRoomId) {
      await prisma.room.deleteMany({ where: { id: testRoomId } });
    }
    if (testTypeId) {
      await prisma.roomType.deleteMany({ where: { id: testTypeId } });
    }
    await prisma.$disconnect();
    await pool.end();
  });

  it("calculates live dashboard summary with room counts, movements, and billing", async () => {
    const summary = await dashboardService.getDashboardSummary();

    // Validate room counts
    expect(summary.rooms.total).toBeGreaterThanOrEqual(1);
    expect(summary.rooms.occupied).toBeGreaterThanOrEqual(1);
    expect(summary.rooms.available).toBeGreaterThanOrEqual(0);

    // Validate movements for today
    expect(summary.movements.arrivals.total).toBeGreaterThanOrEqual(1);
    expect(summary.movements.departures.total).toBeGreaterThanOrEqual(1);

    // Validate list of arriving and departing guests
    const foundArrival = summary.arrivingToday.find((b) => b.id === testBookingId);
    expect(foundArrival).toBeDefined();
    expect(foundArrival?.guestName).toBe("Rajesh Sharma");

    const foundDeparture = summary.departingToday.find((b) => b.id === testBookingId);
    expect(foundDeparture).toBeDefined();
    expect(foundDeparture?.guestName).toBe("Rajesh Sharma");

    // Validate MTD billing & GST calculation
    expect(summary.billing.invoicesCount).toBeGreaterThanOrEqual(1);
    expect(summary.billing.totalBilled).toBeGreaterThanOrEqual(2100);
    expect(summary.billing.totalGst).toBeGreaterThanOrEqual(100);
    expect(summary.billing.monthName).toBeTruthy();
  });

  it("serves valid summary data from GET /api/dashboard endpoint for authenticated sessions", async () => {
    vi.spyOn(sessionModule, "requireSession").mockResolvedValue({
      actor: {
        id: "test-dash-actor",
        name: "Test Staff",
        email: "staff@hotelpaul.in",
        role: "RECEPTIONIST",
        isActive: true,
      },
    });

    const response = await GET();
    expect(response.status).toBe(200);

    const json = await response.json();
    const parsed = dashboardSummarySchema.safeParse(json);
    expect(parsed.success).toBe(true);
  });
});
