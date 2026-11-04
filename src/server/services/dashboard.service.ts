import "server-only";
import { prisma } from "@/server/db";
import { Decimal } from "decimal.js";
import { addDays } from "date-fns";
import { roomService } from "./room.service";
import { billingService } from "./billing.service";
import {
  startOfISTDay,
  endOfISTDay,
  startOfISTMonth,
  endOfISTMonth,
  formatIST,
} from "@/lib/datetime";
import type {
  DashboardSummary,
  TodayGuestMovement,
  ForecastDay,
  DashboardLowStockAlert,
} from "@/features/dashboard/schemas";
import { BookingStatus, InvoiceStatus, Role } from "@prisma/client";

export const dashboardService = {
  /**
   * Computes the operational KPI summary for Dashboard v2.
   * Includes room statuses, today's arrivals & departures in IST, payments due, MTD billing/GST,
   * low-stock alerts, and 7-day booked-room occupancy forecast.
   * Respects role-based permissions: financial billing info is only fetched for OWNER.
   */
  async getDashboardSummary(userRole?: Role | string): Promise<DashboardSummary> {
    const now = new Date();
    const startOfDayUTC = startOfISTDay(now);
    const endOfDayUTC = endOfISTDay(now);
    const startOfMonthUTC = startOfISTMonth(now);
    const endOfMonthUTC = endOfISTMonth(now);
    const monthName = formatIST(now, "MMMM yyyy");

    // 1. Room Statuses via derived status service
    const rooms = await roomService.listRoomsWithStatus();
    const roomCounts = {
      total: rooms.length,
      occupied: rooms.filter((r) => r.status === "OCCUPIED").length,
      available: rooms.filter((r) => r.status === "AVAILABLE").length,
      reserved: rooms.filter((r) => r.status === "RESERVED").length,
      maintenance: rooms.filter((r) => r.status === "MAINTENANCE").length,
      problems: rooms.filter((r) => r.hasProblem).length,
    };

    // 2. Today's Arrivals (scheduled check-in falls within today IST)
    const arrivalBookings = await prisma.booking.findMany({
      where: {
        checkInAt: {
          gte: startOfDayUTC,
          lte: endOfDayUTC,
        },
        status: { in: [BookingStatus.RESERVED, BookingStatus.CHECKED_IN, BookingStatus.CHECKED_OUT] },
      },
      include: {
        room: { include: { type: true } },
        guests: { where: { isPrimary: true } },
      },
      orderBy: { checkInAt: "asc" },
    });

    const arrivalsCheckedIn = arrivalBookings.filter(
      (b) => b.status === BookingStatus.CHECKED_IN || b.status === BookingStatus.CHECKED_OUT
    ).length;
    const arrivalsExpected = arrivalBookings.filter(
      (b) => b.status === BookingStatus.RESERVED
    ).length;

    const arrivingToday: TodayGuestMovement[] = arrivalBookings.map((b) => ({
      id: b.id,
      reference: b.reference,
      guestName: b.guests[0]?.name || "Guest",
      guestMobile: b.guests[0]?.mobile || null,
      roomNumber: b.room.number,
      roomTypeName: b.room.type.name,
      time: b.checkInAt.toISOString(),
      status: b.status,
      balanceDue: 0,
    }));

    // 3. Today's Departures (scheduled check-out falls within today IST)
    const departureBookings = await prisma.booking.findMany({
      where: {
        checkOutAt: {
          gte: startOfDayUTC,
          lte: endOfDayUTC,
        },
        status: { in: [BookingStatus.RESERVED, BookingStatus.CHECKED_IN, BookingStatus.CHECKED_OUT] },
      },
      include: {
        room: { include: { type: true } },
        guests: { where: { isPrimary: true } },
      },
      orderBy: { checkOutAt: "asc" },
    });

    const departuresCheckedOut = departureBookings.filter(
      (b) => b.status === BookingStatus.CHECKED_OUT
    ).length;
    const departuresPending = departureBookings.filter(
      (b) => b.status !== BookingStatus.CHECKED_OUT
    ).length;

    // For departures, calculate current balance due
    const departingToday: TodayGuestMovement[] = await Promise.all(
      departureBookings.map(async (b) => {
        let balanceDue = 0;
        try {
          const res = await billingService.getBookingBill(b.id);
          balanceDue = res.bill.balanceDue;
        } catch {
          balanceDue = 0;
        }

        return {
          id: b.id,
          reference: b.reference,
          guestName: b.guests[0]?.name || "Guest",
          guestMobile: b.guests[0]?.mobile || null,
          roomNumber: b.room.number,
          roomTypeName: b.room.type.name,
          time: b.checkOutAt.toISOString(),
          status: b.status,
          balanceDue,
        };
      })
    );

    // 4. Payments Due across all active CHECKED_IN stays
    const activeCheckedInBookings = await prisma.booking.findMany({
      where: {
        status: BookingStatus.CHECKED_IN,
      },
      select: { id: true },
    });

    let dueCount = 0;
    let dueTotal = new Decimal(0);
    const bookingBalanceMap = new Map<string, number>();

    for (const b of activeCheckedInBookings) {
      try {
        const res = await billingService.getBookingBill(b.id);
        const bal = res.bill.balanceDue;
        bookingBalanceMap.set(b.id, bal);
        if (bal > 0) {
          dueCount++;
          dueTotal = dueTotal.add(new Decimal(bal));
        }
      } catch {
        bookingBalanceMap.set(b.id, 0);
      }
    }

    // Enrich rooms with real-time balance due
    const enrichedRooms = rooms.map((r) => ({
      ...r,
      balanceDue: r.currentBooking?.id
        ? bookingBalanceMap.get(r.currentBooking.id) ?? 0
        : 0,
    }));

    // 5. Monthly Billed Revenue and Total GST Payable (Owner role only)
    const isOwner = !userRole || userRole === Role.OWNER;
    let billing: DashboardSummary["billing"] = null;

    if (isOwner) {
      const monthInvoices = await prisma.invoice.findMany({
        where: {
          status: InvoiceStatus.ISSUED,
          issuedAt: {
            gte: startOfMonthUTC,
            lte: endOfMonthUTC,
          },
        },
        select: {
          billAmount: true,
          cgst: true,
          sgst: true,
        },
      });

      let monthlyTotalBilled = new Decimal(0);
      let monthlyTotalGst = new Decimal(0);

      for (const inv of monthInvoices) {
        monthlyTotalBilled = monthlyTotalBilled.add(new Decimal(inv.billAmount));
        monthlyTotalGst = monthlyTotalGst
          .add(new Decimal(inv.cgst))
          .add(new Decimal(inv.sgst));
      }

      billing = {
        invoicesCount: monthInvoices.length,
        totalBilled: monthlyTotalBilled.toNumber(),
        totalGst: monthlyTotalGst.toNumber(),
        monthName,
      };
    }

    // 6. Low Stock Alerts (Phase 2.4/2.5)
    const activeInventory = await prisma.inventoryItem.findMany({
      where: {
        isActive: true,
        reorderLevel: { gt: 0 },
      },
      select: {
        id: true,
        name: true,
        unit: true,
        qtyStore: true,
        reorderLevel: true,
      },
      orderBy: { qtyStore: "asc" },
    });

    const lowStockItems = activeInventory.filter(
      (i) => i.qtyStore <= i.reorderLevel
    );

    const lowStock: DashboardLowStockAlert = {
      count: lowStockItems.length,
      items: lowStockItems.slice(0, 5),
    };

    // 7. 7-Day Booked-Room Occupancy Forecast (Phase 2.5)
    const forecastStartUTC = startOfISTDay(now);
    const forecastEndUTC = endOfISTDay(addDays(now, 6));

    const forecastBookings = await prisma.booking.findMany({
      where: {
        status: { in: [BookingStatus.RESERVED, BookingStatus.CHECKED_IN] },
        AND: [
          { checkInAt: { lt: forecastEndUTC } },
          { checkOutAt: { gt: forecastStartUTC } },
        ],
      },
      select: {
        id: true,
        roomId: true,
        checkInAt: true,
        checkOutAt: true,
        status: true,
      },
    });

    const forecastMaintenance = await prisma.roomMaintenance.findMany({
      where: {
        AND: [
          { startsAt: { lt: forecastEndUTC } },
          { endsAt: { gt: forecastStartUTC } },
        ],
      },
      select: {
        id: true,
        roomId: true,
        startsAt: true,
        endsAt: true,
      },
    });

    const totalRooms = roomCounts.total;
    const forecast: ForecastDay[] = [];

    for (let i = 0; i < 7; i++) {
      const targetDate = addDays(now, i);
      const dayStart = startOfISTDay(targetDate);
      const dayEnd = endOfISTDay(targetDate);

      // Booked rooms on this day (distinct rooms)
      const dayBookedRoomIds = new Set<string>();
      for (const b of forecastBookings) {
        if (b.checkInAt < dayEnd && b.checkOutAt > dayStart) {
          dayBookedRoomIds.add(b.roomId);
        }
      }

      // Maintenance rooms on this day (distinct rooms)
      const dayMaintenanceRoomIds = new Set<string>();
      for (const m of forecastMaintenance) {
        if (m.startsAt < dayEnd && m.endsAt > dayStart) {
          dayMaintenanceRoomIds.add(m.roomId);
        }
      }

      const bookedCount = dayBookedRoomIds.size;
      const maintenanceCount = dayMaintenanceRoomIds.size;
      const availableCount = Math.max(
        0,
        totalRooms - bookedCount - maintenanceCount
      );
      const occupancyPercent =
        totalRooms > 0 ? Math.round((bookedCount / totalRooms) * 100) : 0;

      const dayStr = formatIST(targetDate, "dd MMM");
      const dayOfWeek = formatIST(targetDate, "EEE");
      const label =
        i === 0
          ? `Today (${dayStr})`
          : i === 1
          ? `Tomorrow (${dayStr})`
          : dayStr;

      forecast.push({
        date: formatIST(targetDate, "yyyy-MM-dd"),
        label,
        dayOfWeek,
        booked: bookedCount,
        maintenance: maintenanceCount,
        available: availableCount,
        totalRooms,
        occupancyPercent,
      });
    }

    return {
      rooms: roomCounts,
      roomList: enrichedRooms,
      movements: {
        arrivals: {
          total: arrivalBookings.length,
          checkedIn: arrivalsCheckedIn,
          expected: arrivalsExpected,
        },
        departures: {
          total: departureBookings.length,
          checkedOut: departuresCheckedOut,
          pending: departuresPending,
        },
      },
      paymentsDue: {
        count: dueCount,
        totalAmount: dueTotal.toNumber(),
      },
      billing,
      lowStock,
      forecast,
      arrivingToday,
      departingToday,
    };
  },
};
