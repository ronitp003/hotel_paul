import "server-only";

import { prisma } from "@/server/db";
import {
  BookingStatus,
  type BookingSource,
  PaymentKind,
} from "@prisma/client";
import {
  subDays,
  eachDayOfInterval,
} from "date-fns";
import {
  startOfISTDay,
  endOfISTDay,
  startOfISTMonth,
  formatIST,
  toIST,
  fromISTInput,
} from "@/lib/datetime";
import { calculateStay } from "@/lib/stay";
import type {
  RegisterDayData,
  RegisterEntry,
  AnalyticsData,
  AnalyticsDailyCheckIn,
  AnalyticsOccupancyDay,
  AnalyticsWeekdayCheckIn,
  CheckInTimeSlot,
  PaymentCollectionItem,
  AnalyticsCategoryItem,
} from "@/features/register/schemas";

const SOURCE_LABELS: Record<BookingSource, string> = {
  WALK_IN: "Walk-in",
  PHONE: "Phone Booking",
  ONLINE: "Online / OTA",
  CORPORATE: "Corporate",
  REFERRAL: "Referral",
  OTHER: "Other",
};

export const registerService = {
  /**
   * Retrieves the daily check-in register entries for a single day in IST.
   * Day-based filtering only (no week view), strictly without status or billing.
   */
  async getCheckInRegister(params: {
    date?: string;
    search?: string;
    roomId?: string;
  }): Promise<{
    register: RegisterDayData;
    rooms: Array<{ id: string; number: string; typeName: string }>;
  }> {
    const now = new Date();
    const targetDateStr = params.date || formatIST(now, "yyyy-MM-dd");

    // Compute start and end of target date in IST
    const parsedDate = fromISTInput(`${targetDateStr}T12:00:00`);
    const startOfDayUTC = startOfISTDay(parsedDate);
    const endOfDayUTC = endOfISTDay(parsedDate);

    // Fetch all rooms for dropdown filtering
    const allRooms = await prisma.room.findMany({
      where: { isActive: true },
      select: {
        id: true,
        number: true,
        type: { select: { name: true } },
      },
      orderBy: { number: "asc" },
    });

    const searchLower = params.search?.trim().toLowerCase();

    // Query bookings that checked in (or are scheduled to check in) on this day
    const bookings = await prisma.booking.findMany({
      where: {
        OR: [
          {
            actualCheckInAt: {
              gte: startOfDayUTC,
              lte: endOfDayUTC,
            },
          },
          {
            AND: [
              { actualCheckInAt: null },
              {
                checkInAt: {
                  gte: startOfDayUTC,
                  lte: endOfDayUTC,
                },
              },
            ],
          },
        ],
        status: {
          in: [
            BookingStatus.CHECKED_IN,
            BookingStatus.CHECKED_OUT,
            BookingStatus.RESERVED,
          ],
        },
        ...(params.roomId ? { roomId: params.roomId } : {}),
      },
      include: {
        room: { include: { type: true } },
        guests: {
          orderBy: { isPrimary: "desc" },
        },
      },
      orderBy: { checkInAt: "asc" },
    });

    // Map entries & apply text search if provided
    const entries: RegisterEntry[] = [];
    let totalGuestsCount = 0;

    for (const b of bookings) {
      const primaryGuest = b.guests.find((g) => g.isPrimary) || b.guests[0];
      const accompanyingGuests = b.guests.filter((g) => g.id !== primaryGuest?.id);

      // Filter by search term across guest name, mobile, reference, room, arrivingFrom, purpose
      if (searchLower) {
        const matchesName = primaryGuest?.name.toLowerCase().includes(searchLower);
        const matchesFather =
          primaryGuest?.fatherName?.toLowerCase().includes(searchLower) ||
          accompanyingGuests.some((ag) =>
            ag.fatherName?.toLowerCase().includes(searchLower)
          );
        const matchesMobile = primaryGuest?.mobile?.toLowerCase().includes(searchLower);
        const matchesAccompanying = accompanyingGuests.some(
          (ag) =>
            ag.name.toLowerCase().includes(searchLower) ||
            ag.mobile?.toLowerCase().includes(searchLower)
        );
        const matchesRef = b.reference.toLowerCase().includes(searchLower);
        const matchesRoom = b.room.number.toLowerCase().includes(searchLower);
        const matchesOrigin = b.arrivingFrom?.toLowerCase().includes(searchLower);
        const matchesPurpose = b.purposeOfVisit?.toLowerCase().includes(searchLower);

        if (
          !matchesName &&
          !matchesFather &&
          !matchesMobile &&
          !matchesAccompanying &&
          !matchesRef &&
          !matchesRoom &&
          !matchesOrigin &&
          !matchesPurpose
        ) {
          continue;
        }
      }

      totalGuestsCount += b.guests.length;

      entries.push({
        id: b.id,
        reference: b.reference,
        checkInTime: (b.actualCheckInAt || b.checkInAt).toISOString(),
        roomNumber: b.room.number,
        roomTypeName: b.room.type.name,
        primaryGuest: {
          id: primaryGuest?.id,
          name: primaryGuest?.name || "Guest",
          fatherName: primaryGuest?.fatherName || null,
          age: primaryGuest?.age ?? null,
          sex: primaryGuest?.sex ?? null,
          mobile: primaryGuest?.mobile || null,
        },
        accompanyingGuests: accompanyingGuests.map((ag) => ({
          id: ag.id,
          name: ag.name,
          fatherName: ag.fatherName || null,
          age: ag.age ?? null,
          sex: ag.sex ?? null,
          mobile: ag.mobile || null,
        })),
        arrivingFrom: b.arrivingFrom || null,
        purposeOfVisit: b.purposeOfVisit || null,
        source: b.source,
      });
    }

    const formattedDate = formatIST(parsedDate, "EEEE, dd MMMM yyyy");

    return {
      register: {
        date: targetDateStr,
        formattedDate,
        totalCheckIns: entries.length,
        totalGuests: totalGuestsCount,
        entries,
      },
      rooms: allRooms.map((r) => ({
        id: r.id,
        number: r.number,
        typeName: r.type.name,
      })),
    };
  },

  /**
   * Computes property operations and guest analytics for the Owner.
   */
  async getAnalytics(params: {
    range?: "7d" | "14d" | "30d" | "month";
  }): Promise<AnalyticsData> {
    const range = params.range || "7d";
    const now = new Date();
    const endOfDayUTC = endOfISTDay(now);

    let startOfDayUTC: Date;
    if (range === "14d") {
      startOfDayUTC = startOfISTDay(subDays(now, 13));
    } else if (range === "30d") {
      startOfDayUTC = startOfISTDay(subDays(now, 29));
    } else if (range === "month") {
      startOfDayUTC = startOfISTMonth(now);
    } else {
      // 7d default
      startOfDayUTC = startOfISTDay(subDays(now, 6));
    }

    const totalRooms = await prisma.room.count({
      where: { isActive: true },
    });

    // Fetch bookings in the range
    const bookings = await prisma.booking.findMany({
      where: {
        status: {
          in: [BookingStatus.CHECKED_IN, BookingStatus.CHECKED_OUT],
        },
        OR: [
          { checkInAt: { gte: startOfDayUTC, lte: endOfDayUTC } },
          { checkOutAt: { gte: startOfDayUTC, lte: endOfDayUTC } },
          {
            AND: [
              { checkInAt: { lte: startOfDayUTC } },
              { checkOutAt: { gte: endOfDayUTC } },
            ],
          },
        ],
      },
      include: {
        guests: true,
      },
    });

    // Fetch actual completed payment and refund transactions in the period
    const payments = await prisma.payment.findMany({
      where: {
        receivedAt: {
          gte: startOfDayUTC,
          lte: endOfDayUTC,
        },
      },
      select: {
        id: true,
        kind: true,
        amount: true,
        receivedAt: true,
      },
      orderBy: {
        receivedAt: "asc",
      },
    });

    // 1. Generate day-by-day intervals in IST
    const daysInterval = eachDayOfInterval({
      start: toIST(startOfDayUTC),
      end: toIST(endOfDayUTC),
    });

    const dailyCheckIns: AnalyticsDailyCheckIn[] = [];
    const occupancyTrend: AnalyticsOccupancyDay[] = [];
    const dailyCollections: PaymentCollectionItem[] = [];

    const weekdayMap: Record<string, { day: string; shortDay: string; count: number }> = {
      Monday: { day: "Monday", shortDay: "Mon", count: 0 },
      Tuesday: { day: "Tuesday", shortDay: "Tue", count: 0 },
      Wednesday: { day: "Wednesday", shortDay: "Wed", count: 0 },
      Thursday: { day: "Thursday", shortDay: "Thu", count: 0 },
      Friday: { day: "Friday", shortDay: "Fri", count: 0 },
      Saturday: { day: "Saturday", shortDay: "Sat", count: 0 },
      Sunday: { day: "Sunday", shortDay: "Sun", count: 0 },
    };

    let periodCheckInCount = 0;
    let periodTotalGuestsCount = 0;
    let periodTotalStayDays = 0;
    let periodArrivalBookingsCount = 0;

    // Check-in Time Distribution counters (Morning: 6-12, Afternoon: 12-17, Evening: 17-21, Night: 21-6)
    let morningCount = 0;
    let afternoonCount = 0;
    let eveningCount = 0;
    let nightCount = 0;
    let periodArrivalsTotal = 0;

    for (const day of daysInterval) {
      const dayStartUTC = startOfISTDay(day);
      const dayEndUTC = endOfISTDay(day);
      const dayStr = formatIST(day, "yyyy-MM-dd");
      const dayLabel = formatIST(day, "dd MMM");
      const dayOfWeekShort = formatIST(day, "EEE");
      const dayOfWeekFull = formatIST(day, "EEEE");

      // Check-ins starting on this day
      const dayArrivals = bookings.filter((b) => {
        const arrivalDate = b.actualCheckInAt || b.checkInAt;
        return arrivalDate >= dayStartUTC && arrivalDate <= dayEndUTC;
      });

      for (const b of dayArrivals) {
        const arrivalDate = b.actualCheckInAt || b.checkInAt;
        const arrivalIST = toIST(arrivalDate);
        const hour = arrivalIST.getHours();

        periodArrivalsTotal++;
        if (hour >= 6 && hour < 12) {
          morningCount++;
        } else if (hour >= 12 && hour < 17) {
          afternoonCount++;
        } else if (hour >= 17 && hour < 21) {
          eveningCount++;
        } else {
          nightCount++;
        }

        // Calculate stay duration for this arrival
        const checkOutDate = b.actualCheckOutAt || b.checkOutAt;
        try {
          if (checkOutDate > arrivalDate) {
            const stay = calculateStay(arrivalDate, checkOutDate);
            periodTotalStayDays += stay.days;
          } else {
            periodTotalStayDays += 1;
          }
        } catch {
          periodTotalStayDays += 1;
        }
        periodArrivalBookingsCount++;
      }

      const dayCheckInCount = dayArrivals.length;
      const dayGuestsCount = dayArrivals.reduce(
        (sum, b) => sum + (b.guests.length || 1),
        0
      );

      periodCheckInCount += dayCheckInCount;
      periodTotalGuestsCount += dayGuestsCount;

      if (weekdayMap[dayOfWeekFull]) {
        weekdayMap[dayOfWeekFull].count += dayCheckInCount;
      }

      dailyCheckIns.push({
        date: dayStr,
        label: dayLabel, // actual date (e.g. "31 Oct") for X-axis
        dayOfWeek: dayOfWeekShort,
        checkIns: dayCheckInCount,
        guests: dayGuestsCount,
      });

      // Occupied rooms active on this day
      const occupiedRooms = bookings.filter(
        (b) => b.checkInAt < dayEndUTC && b.checkOutAt > dayStartUTC
      ).length;

      const occupancyPercent =
        totalRooms > 0 ? Math.min(100, Math.round((occupiedRooms / totalRooms) * 100)) : 0;

      occupancyTrend.push({
        date: dayStr,
        label: dayLabel,
        occupancyPercent,
        occupiedRooms,
        totalRooms,
      });

      // Payments for this day in IST
      const dayPayments = payments.filter(
        (p) => p.receivedAt >= dayStartUTC && p.receivedAt <= dayEndUTC
      );

      const dayGross = dayPayments
        .filter((p) => p.kind === PaymentKind.ADVANCE || p.kind === PaymentKind.PAYMENT)
        .reduce((sum, p) => sum + Number(p.amount), 0);

      const dayRefunds = dayPayments
        .filter((p) => p.kind === PaymentKind.REFUND)
        .reduce((sum, p) => sum + Number(p.amount), 0);

      dailyCollections.push({
        key: dayStr,
        label: dayLabel,
        grossPayments: Math.round(dayGross * 100) / 100,
        refunds: Math.round(dayRefunds * 100) / 100,
        netCollections: Math.round((dayGross - dayRefunds) * 100) / 100,
      });
    }

    // 2. Check-in Time Distribution
    const checkInTimeDistribution: CheckInTimeSlot[] = [
      {
        slot: "MORNING",
        label: "Morning",
        timeRange: "6 AM – 12 PM",
        count: morningCount,
        percentage:
          periodArrivalsTotal > 0
            ? Math.round((morningCount / periodArrivalsTotal) * 100)
            : 0,
      },
      {
        slot: "AFTERNOON",
        label: "Afternoon",
        timeRange: "12 PM – 5 PM",
        count: afternoonCount,
        percentage:
          periodArrivalsTotal > 0
            ? Math.round((afternoonCount / periodArrivalsTotal) * 100)
            : 0,
      },
      {
        slot: "EVENING",
        label: "Evening",
        timeRange: "5 PM – 9 PM",
        count: eveningCount,
        percentage:
          periodArrivalsTotal > 0
            ? Math.round((eveningCount / periodArrivalsTotal) * 100)
            : 0,
      },
      {
        slot: "NIGHT",
        label: "Night",
        timeRange: "9 PM – 6 AM",
        count: nightCount,
        percentage:
          periodArrivalsTotal > 0
            ? Math.round((nightCount / periodArrivalsTotal) * 100)
            : 0,
      },
    ];

    // 3. Weekly Aggregation for Payment Collections
    const weeklyCollections: PaymentCollectionItem[] = [];
    const chunkSize = 7;
    for (let i = 0; i < dailyCollections.length; i += chunkSize) {
      const chunk = dailyCollections.slice(i, i + chunkSize);
      const startItem = chunk[0];
      const endItem = chunk[chunk.length - 1];
      const weekLabel =
        startItem.label === endItem.label
          ? startItem.label
          : `${startItem.label} – ${endItem.label}`;

      const gross = chunk.reduce((sum, d) => sum + d.grossPayments, 0);
      const refunds = chunk.reduce((sum, d) => sum + d.refunds, 0);
      const net = gross - refunds;

      weeklyCollections.push({
        key: `W${Math.floor(i / chunkSize) + 1}`,
        label: weekLabel,
        grossPayments: Math.round(gross * 100) / 100,
        refunds: Math.round(refunds * 100) / 100,
        netCollections: Math.round(net * 100) / 100,
      });
    }

    const totalGrossPayments = dailyCollections.reduce(
      (sum, d) => sum + d.grossPayments,
      0
    );
    const totalRefunds = dailyCollections.reduce(
      (sum, d) => sum + d.refunds,
      0
    );
    const totalNetCollections = totalGrossPayments - totalRefunds;

    // 4. Origins (Arriving From) Aggregation (retained for backward compatibility)
    const originCounts = new Map<string, number>();
    for (const b of bookings) {
      const rawOrigin = b.arrivingFrom?.trim();
      const origin = rawOrigin ? rawOrigin : "Not Specified";
      originCounts.set(origin, (originCounts.get(origin) || 0) + 1);
    }

    const origins: AnalyticsCategoryItem[] = Array.from(originCounts.entries())
      .map(([name, count]) => ({
        name,
        count,
        percentage:
          bookings.length > 0 ? Math.round((count / bookings.length) * 100) : 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);

    // 5. Purpose of Visit Aggregation
    const purposeCounts = new Map<string, number>();
    for (const b of bookings) {
      const rawPurpose = b.purposeOfVisit?.trim();
      const purpose = rawPurpose ? rawPurpose : "General";
      purposeCounts.set(purpose, (purposeCounts.get(purpose) || 0) + 1);
    }

    const purposes: AnalyticsCategoryItem[] = Array.from(purposeCounts.entries())
      .map(([name, count]) => ({
        name,
        count,
        percentage:
          bookings.length > 0 ? Math.round((count / bookings.length) * 100) : 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);

    // 6. Booking Sources
    const sourceCounts = new Map<BookingSource, number>();
    for (const b of bookings) {
      sourceCounts.set(b.source, (sourceCounts.get(b.source) || 0) + 1);
    }

    const sources: AnalyticsCategoryItem[] = Object.keys(SOURCE_LABELS).map(
      (key) => {
        const sourceKey = key as BookingSource;
        const count = sourceCounts.get(sourceKey) || 0;
        return {
          name: SOURCE_LABELS[sourceKey],
          count,
          percentage:
            bookings.length > 0 ? Math.round((count / bookings.length) * 100) : 0,
        };
      }
    );

    // Overall summary calculations
    const daysCount = daysInterval.length;
    const avgDailyCheckIns =
      daysCount > 0 ? Math.round((periodCheckInCount / daysCount) * 10) / 10 : 0;

    let avgStayDuration = 0;
    if (periodArrivalBookingsCount > 0) {
      avgStayDuration =
        Math.round((periodTotalStayDays / periodArrivalBookingsCount) * 10) / 10;
    } else if (bookings.length > 0) {
      let bStayDays = 0;
      for (const b of bookings) {
        const start = b.actualCheckInAt || b.checkInAt;
        const end = b.actualCheckOutAt || b.checkOutAt;
        try {
          bStayDays += end > start ? calculateStay(start, end).days : 1;
        } catch {
          bStayDays += 1;
        }
      }
      avgStayDuration = Math.round((bStayDays / bookings.length) * 10) / 10;
    }

    const avgOccupancyRate =
      occupancyTrend.length > 0
        ? Math.round(
            occupancyTrend.reduce((sum, d) => sum + d.occupancyPercent, 0) /
              occupancyTrend.length
          )
        : 0;

    const weekdayCheckIns: AnalyticsWeekdayCheckIn[] = [
      weekdayMap["Monday"],
      weekdayMap["Tuesday"],
      weekdayMap["Wednesday"],
      weekdayMap["Thursday"],
      weekdayMap["Friday"],
      weekdayMap["Saturday"],
      weekdayMap["Sunday"],
    ];

    const totalRevenue = Math.round(totalNetCollections * 100) / 100;

    const topOriginItem = origins.find((o) => o.name !== "Not Specified") || origins[0];
    const topPurposeItem = purposes.find((p) => p.name !== "General") || purposes[0];

    return {
      range,
      startDate: formatIST(startOfDayUTC, "dd MMM yyyy"),
      endDate: formatIST(endOfDayUTC, "dd MMM yyyy"),
      summary: {
        totalCheckIns: periodCheckInCount,
        totalGuests: periodTotalGuestsCount,
        avgDailyCheckIns,
        avgStayDuration,
        occupancyRate: avgOccupancyRate,
        totalRevenue,
        topOrigin: topOriginItem?.name || "—",
        topPurpose: topPurposeItem?.name || "—",
      },
      dailyCheckIns,
      occupancyTrend,
      checkInTimeDistribution,
      paymentCollections: {
        daily: dailyCollections,
        weekly: weeklyCollections,
        totalGrossPayments: Math.round(totalGrossPayments * 100) / 100,
        totalRefunds: Math.round(totalRefunds * 100) / 100,
        totalNetCollections: Math.round(totalNetCollections * 100) / 100,
      },
      weekdayCheckIns,
      origins,
      purposes,
      sources,
    };
  },
};

