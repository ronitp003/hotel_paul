import "dotenv/config";
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
} from "@prisma/client";
import * as sessionModule from "@/server/auth/session";
import { can } from "@/server/auth/permissions";
import { ROLES } from "@/lib/constants";
import { registerService } from "@/server/services/register.service";
import { GET as getRegisterRoute } from "@/app/api/register/route";
import { GET as getAnalyticsRoute } from "@/app/api/analytics/route";
import { NextRequest } from "next/server";
import { formatIST, fromISTInput } from "@/lib/datetime";
import { addDays, subDays } from "date-fns";

const connectionString =
  process.env.DATABASE_URL_TEST || process.env.DATABASE_URL;

describe("Phase 3.1: Check-in Register & Analytics (Integration)", () => {
  let pool: Pool;
  let prisma: PrismaClient;
  let testRoomId: string;
  let testRoomNumber: string;
  let testRoomId2: string;
  let testRoomNumber2: string;
  let testTypeId: string;
  let testTypeName: string;
  let targetDateStr: string;
  let bookingTodayId: string;
  let bookingYesterdayId: string;

  beforeAll(async () => {
    if (!connectionString) {
      throw new Error("No database connection string for tests");
    }
    pool = new Pool({ connectionString });
    const adapter = new PrismaPg(pool);
    prisma = new PrismaClient({ adapter });

    // 1. Create Room Type & Room
    testTypeName = `RegisterType_${Date.now()}`;
    const type = await prisma.roomType.create({
      data: { name: testTypeName },
    });
    testTypeId = type.id;

    testRoomNumber = `REG_${Date.now().toString().slice(-4)}`;
    const room = await prisma.room.create({
      data: {
        number: testRoomNumber,
        typeId: testTypeId,
        pricePerNight: 2500,
        isActive: true,
      },
    });
    testRoomId = room.id;

    testRoomNumber2 = `REG2_${Date.now().toString().slice(-4)}`;
    const room2 = await prisma.room.create({
      data: {
        number: testRoomNumber2,
        typeId: testTypeId,
        pricePerNight: 2500,
        isActive: true,
      },
    });
    testRoomId2 = room2.id;

    // 2. Ensure test Owner and Receptionist users exist
    const testOwner = await prisma.user.upsert({
      where: { email: "owner-test@hotelpaul.in" },
      update: {},
      create: {
        name: "Test Owner",
        email: "owner-test@hotelpaul.in",
        role: Role.OWNER,
      },
    });

    await prisma.user.upsert({
      where: { email: "staff-test@hotelpaul.in" },
      update: {},
      create: {
        name: "Test Receptionist",
        email: "staff-test@hotelpaul.in",
        role: Role.RECEPTIONIST,
      },
    });

    // 3. Set target date
    const now = new Date();
    targetDateStr = formatIST(now, "yyyy-MM-dd");
    const checkInToday = fromISTInput(`${targetDateStr}T14:00:00`);
    const checkOutToday = addDays(checkInToday, 2);

    const yesterdayDateStr = formatIST(subDays(now, 1), "yyyy-MM-dd");
    const checkInYesterday = fromISTInput(`${yesterdayDateStr}T11:00:00`);
    const checkOutYesterday = addDays(checkInYesterday, 2);

    // 4. Create booking for today with Primary Guest + Accompanying Guests + Travel Data
    const bookingToday = await prisma.booking.create({
      data: {
        reference: `HP-REG-${Date.now().toString().slice(-5)}`,
        roomId: testRoomId,
        createdById: testOwner.id,
        checkInAt: checkInToday,
        checkOutAt: checkOutToday,
        actualCheckInAt: checkInToday,
        status: BookingStatus.CHECKED_IN,
        source: BookingSource.WALK_IN,
        arrivingFrom: "Kolkata, West Bengal",
        purposeOfVisit: "Business",
        rateApplied: 2500,
        guests: {
          create: [
            {
              name: "Sourav Paul",
              fatherName: "Rabindra Paul",
              age: 32,
              sex: Sex.MALE,
              mobile: "9876543210",
              isPrimary: true,
            },
            {
              name: "Priya Paul",
              fatherName: "Sunil Das",
              age: 28,
              sex: Sex.FEMALE,
              mobile: "9876543211",
              isPrimary: false,
            },
            {
              name: "Aarav Paul",
              fatherName: "Sourav Paul",
              age: 5,
              sex: Sex.MALE,
              mobile: null,
              isPrimary: false,
            },
          ],
        },
      },
    });
    bookingTodayId = bookingToday.id;

    // 5. Create booking for yesterday (to verify day filtering ignores other dates)
    const bookingYesterday = await prisma.booking.create({
      data: {
        reference: `HP-YEST-${Date.now().toString().slice(-5)}`,
        roomId: testRoomId2,
        createdById: testOwner.id,
        checkInAt: checkInYesterday,
        checkOutAt: checkOutYesterday,
        actualCheckInAt: checkInYesterday,
        status: BookingStatus.CHECKED_IN,
        source: BookingSource.ONLINE,
        arrivingFrom: "Delhi",
        purposeOfVisit: "Leisure",
        rateApplied: 2500,
        guests: {
          create: [
            {
              name: "Rahul Sharma",
              fatherName: "Mohan Sharma",
              age: 40,
              sex: Sex.MALE,
              mobile: "9123456780",
              isPrimary: true,
            },
          ],
        },
      },
    });
    bookingYesterdayId = bookingYesterday.id;

    // 6. Create completed payment and refund to test payment collection analytics
    await prisma.payment.create({
      data: {
        bookingId: bookingToday.id,
        kind: PaymentKind.PAYMENT,
        mode: PaymentMode.UPI,
        amount: 3000,
        receivedAt: checkInToday,
        createdById: testOwner.id,
      },
    });

    await prisma.payment.create({
      data: {
        bookingId: bookingToday.id,
        kind: PaymentKind.REFUND,
        mode: PaymentMode.UPI,
        amount: 500,
        receivedAt: checkInToday,
        createdById: testOwner.id,
      },
    });
  });

  afterAll(async () => {
    // Cleanup test data - delete payments first due to foreign key
    if (bookingTodayId || bookingYesterdayId) {
      await prisma.payment.deleteMany({
        where: {
          bookingId: {
            in: [bookingTodayId, bookingYesterdayId].filter(Boolean),
          },
        },
      });
    }

    if (bookingTodayId) {
      await prisma.bookingGuest.deleteMany({
        where: { bookingId: bookingTodayId },
      });
      await prisma.booking.deleteMany({
        where: { id: bookingTodayId },
      });
    }

    if (bookingYesterdayId) {
      await prisma.bookingGuest.deleteMany({
        where: { bookingId: bookingYesterdayId },
      });
      await prisma.booking.deleteMany({
        where: { id: bookingYesterdayId },
      });
    }

    if (testRoomId) {
      await prisma.room.deleteMany({ where: { id: testRoomId } });
    }
    if (testRoomId2) {
      await prisma.room.deleteMany({ where: { id: testRoomId2 } });
    }
    if (testTypeId) {
      await prisma.roomType.deleteMany({ where: { id: testTypeId } });
    }

    await prisma.$disconnect();
    await pool.end();
  });

  // ── Access Control Tests ──
  describe("Owner-Only Access Control", () => {
    it("allows OWNER to access register.view and analytics.view", () => {
      expect(can(ROLES.OWNER, "register.view")).toBe(true);
      expect(can(ROLES.OWNER, "analytics.view")).toBe(true);
    });

    it("strictly forbids RECEPTIONIST from register.view and analytics.view", () => {
      expect(can(ROLES.RECEPTIONIST, "register.view")).toBe(false);
      expect(can(ROLES.RECEPTIONIST, "analytics.view")).toBe(false);
    });

    it("rejects non-owner in register API route", async () => {
      vi.spyOn(sessionModule, "requireSession").mockResolvedValueOnce({
        actor: {
          id: "receptionist-id",
          name: "Reception Staff",
          email: "staff@hotelpaul.in",
          role: ROLES.RECEPTIONIST,
          isActive: true,
        },
      });

      const req = new NextRequest("http://localhost:3000/api/register");
      const res = await getRegisterRoute(req);
      expect(res.status).toBe(403);

      const json = await res.json();
      expect(json.ok).toBe(false);
      expect(json.code).toBe("FORBIDDEN");
    });

    it("rejects non-owner in analytics API route", async () => {
      vi.spyOn(sessionModule, "requireSession").mockResolvedValueOnce({
        actor: {
          id: "receptionist-id",
          name: "Reception Staff",
          email: "staff@hotelpaul.in",
          role: ROLES.RECEPTIONIST,
          isActive: true,
        },
      });

      const req = new NextRequest("http://localhost:3000/api/analytics");
      const res = await getAnalyticsRoute(req);
      expect(res.status).toBe(403);

      const json = await res.json();
      expect(json.ok).toBe(false);
      expect(json.code).toBe("FORBIDDEN");
    });
  });

  // ── Check-in Register Functional Tests ──
  describe("Check-in Register Functionality", () => {
    it("fetches register for target day only (strict day filtering, no weeks)", async () => {
      const { register, rooms } = await registerService.getCheckInRegister({
        date: targetDateStr,
      });

      expect(register.date).toBe(targetDateStr);
      expect(register.totalCheckIns).toBeGreaterThanOrEqual(1);

      // Verify that today's booking is present
      const entry = register.entries.find((e) => e.id === bookingTodayId);
      expect(entry).toBeDefined();

      // Verify that yesterday's booking is NOT present (strictly day-by-day)
      const yesterdayEntry = register.entries.find(
        (e) => e.id === bookingYesterdayId
      );
      expect(yesterdayEntry).toBeUndefined();

      // Verify rooms list includes our test room
      const testRoomInList = rooms.find((r) => r.id === testRoomId);
      expect(testRoomInList).toBeDefined();
    });

    it("strictly verifies register entry fields (Guest Records, Travel Data, Room & Booking, No status/billing, Check-in only)", async () => {
      const { register } = await registerService.getCheckInRegister({
        date: targetDateStr,
      });

      const entry = register.entries.find((e) => e.id === bookingTodayId)!;
      expect(entry).toBeDefined();

      // 1. Stay timeline: Only checkInTime is present, check-out must not be in the entry
      const entryRecord = entry as unknown as Record<string, unknown>;
      expect(entry.checkInTime).toBeDefined();
      expect(entryRecord.checkOutTime).toBeUndefined();
      expect(entryRecord.checkOutAt).toBeUndefined();

      // 2. Room & Booking
      expect(entry.roomNumber).toBe(testRoomNumber);
      expect(entry.roomTypeName).toBe(testTypeName);
      expect(entry.reference).toContain("HP-REG-");
      expect(entry.source).toBe(BookingSource.WALK_IN);

      // 3. Primary Guest
      expect(entry.primaryGuest.name).toBe("Sourav Paul");
      expect(entry.primaryGuest.fatherName).toBe("Rabindra Paul");
      expect(entry.primaryGuest.mobile).toBe("9876543210");
      expect(entry.primaryGuest.age).toBe(32);
      expect(entry.primaryGuest.sex).toBe(Sex.MALE);

      // 4. Accompanying Occupants
      expect(entry.accompanyingGuests.length).toBe(2);
      const priya = entry.accompanyingGuests.find((g) => g.name === "Priya Paul");
      expect(priya).toBeDefined();
      expect(priya?.fatherName).toBe("Sunil Das");
      expect(priya?.age).toBe(28);
      expect(priya?.sex).toBe(Sex.FEMALE);

      const aarav = entry.accompanyingGuests.find((g) => g.name === "Aarav Paul");
      expect(aarav).toBeDefined();
      expect(aarav?.age).toBe(5);

      // 5. Travel Data
      expect(entry.arrivingFrom).toBe("Kolkata, West Bengal");
      expect(entry.purposeOfVisit).toBe("Business");

      // 6. Strict Exclusion: No status and No billing
      expect(entryRecord.status).toBeUndefined();
      expect(entryRecord.rateApplied).toBeUndefined();
      expect(entryRecord.totalAmount).toBeUndefined();
      expect(entryRecord.advancePaid).toBeUndefined();
      expect(entryRecord.balanceAmount).toBeUndefined();
      expect(entryRecord.invoice).toBeUndefined();
    });

    it("filters register by search query across guest, father name, and origin", async () => {
      // Search by primary guest name
      const resByName = await registerService.getCheckInRegister({
        date: targetDateStr,
        search: "Sourav",
      });
      expect(resByName.register.entries.some((e) => e.id === bookingTodayId)).toBe(
        true
      );

      // Search by father's name
      const resByFather = await registerService.getCheckInRegister({
        date: targetDateStr,
        search: "Rabindra",
      });
      expect(resByFather.register.entries.some((e) => e.id === bookingTodayId)).toBe(
        true
      );

      // Search by arriving city
      const resByOrigin = await registerService.getCheckInRegister({
        date: targetDateStr,
        search: "Kolkata",
      });
      expect(resByOrigin.register.entries.some((e) => e.id === bookingTodayId)).toBe(
        true
      );

      // Search non-existent term
      const resNoMatch = await registerService.getCheckInRegister({
        date: targetDateStr,
        search: "NonExistentXYZ999",
      });
      expect(resNoMatch.register.entries.length).toBe(0);
    });

    it("filters register by roomId", async () => {
      const resByRoom = await registerService.getCheckInRegister({
        date: targetDateStr,
        roomId: testRoomId,
      });
      expect(resByRoom.register.entries.every((e) => e.roomNumber === testRoomNumber)).toBe(
        true
      );
    });
  });

  // ── Analytics Functional Tests ──
  describe("Analytics Calculations & Aggregations", () => {
    it("computes analytics data for 7d range with new operational & financial charts", async () => {
      const data = await registerService.getAnalytics({ range: "7d" });

      expect(data.range).toBe("7d");
      expect(data.summary).toBeDefined();
      expect(data.summary.totalCheckIns).toBeGreaterThanOrEqual(1);
      expect(data.summary.totalGuests).toBeGreaterThanOrEqual(1);
      expect(typeof data.summary.avgStayDuration).toBe("number");
      expect(typeof data.summary.totalRevenue).toBe("number");

      // Weekday Check-ins (Monday to Sunday)
      expect(data.weekdayCheckIns).toBeDefined();
      expect(data.weekdayCheckIns?.length).toBe(7);
      expect(data.weekdayCheckIns?.map((w) => w.day)).toEqual([
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
        "Sunday",
      ]);

      // 1. Daily Check-in Volume (X-axis has actual date labels like "01 Nov", 7 days)
      expect(data.dailyCheckIns.length).toBe(7);
      expect(data.dailyCheckIns[0].label).toMatch(/^\d{2}\s[A-Z][a-z]{2}$/);
      expect(typeof data.dailyCheckIns[0].checkIns).toBe("number");

      // 2. Property Occupancy Rate (independent daily percentages, 0-100%)
      expect(data.occupancyTrend.length).toBe(7);
      for (const occ of data.occupancyTrend) {
        expect(occ.occupancyPercent).toBeGreaterThanOrEqual(0);
        expect(occ.occupancyPercent).toBeLessThanOrEqual(100);
        expect(occ.totalRooms).toBeGreaterThanOrEqual(1);
      }

      // 3. Check-in Time Distribution (4 slots: Morning, Afternoon, Evening, Night)
      expect(data.checkInTimeDistribution.length).toBe(4);
      const slotNames = data.checkInTimeDistribution.map((s) => s.slot);
      expect(slotNames).toEqual(["MORNING", "AFTERNOON", "EVENING", "NIGHT"]);

      // Verify today's 14:00 check-in is mapped to Afternoon and yesterday's 11:00 check-in is Morning
      const afternoonSlot = data.checkInTimeDistribution.find((s) => s.slot === "AFTERNOON");
      const morningSlot = data.checkInTimeDistribution.find((s) => s.slot === "MORNING");
      expect(afternoonSlot?.count).toBeGreaterThanOrEqual(1);
      expect(morningSlot?.count).toBeGreaterThanOrEqual(1);

      // Total counts across all 4 slots must equal total check-in events in range
      const totalArrivalsInSlots = data.checkInTimeDistribution.reduce(
        (sum, s) => sum + s.count,
        0
      );
      expect(totalArrivalsInSlots).toBe(data.summary.totalCheckIns);

      // 4. Payment Collection Trends (Net Collections = Completed Payments - Completed Refunds)
      expect(data.paymentCollections).toBeDefined();
      expect(data.paymentCollections.daily.length).toBe(7);
      expect(data.paymentCollections.weekly.length).toBeGreaterThanOrEqual(1);

      // Verify payment of 3000 and refund of 500 were factored in
      expect(data.paymentCollections.totalGrossPayments).toBeGreaterThanOrEqual(3000);
      expect(data.paymentCollections.totalRefunds).toBeGreaterThanOrEqual(500);
      expect(data.paymentCollections.totalNetCollections).toBe(
        Math.round(
          (data.paymentCollections.totalGrossPayments -
            data.paymentCollections.totalRefunds) *
            100
        ) / 100
      );

      // Verify daily collection net = gross - refund
      for (const dayCol of data.paymentCollections.daily) {
        expect(dayCol.netCollections).toBe(
          Math.round((dayCol.grossPayments - dayCol.refunds) * 100) / 100
        );
      }

      // 5. Booking sources
      expect(data.sources.length).toBeGreaterThan(0);
    });

    it("computes analytics data for 14d, 30d, and month ranges", async () => {
      const data14 = await registerService.getAnalytics({ range: "14d" });
      expect(data14.range).toBe("14d");
      expect(data14.dailyCheckIns.length).toBe(14);
      expect(data14.paymentCollections.daily.length).toBe(14);
      expect(data14.paymentCollections.weekly.length).toBe(2);

      const data30 = await registerService.getAnalytics({ range: "30d" });
      expect(data30.range).toBe("30d");
      expect(data30.dailyCheckIns.length).toBe(30);
      expect(data30.paymentCollections.daily.length).toBe(30);
      expect(data30.paymentCollections.weekly.length).toBe(5);

      const dataMonth = await registerService.getAnalytics({ range: "month" });
      expect(dataMonth.range).toBe("month");
      expect(dataMonth.dailyCheckIns.length).toBeGreaterThanOrEqual(1);
      expect(dataMonth.paymentCollections.daily.length).toBe(
        dataMonth.dailyCheckIns.length
      );
    });
  });
});
