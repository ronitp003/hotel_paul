import "server-only";
import { prisma } from "@/server/db";
import { Decimal } from "decimal.js";
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
} from "@/features/dashboard/schemas";
import { BookingStatus, InvoiceStatus } from "@prisma/client";

export const dashboardService = {
  /**
   * Computes the operational KPI summary for Dashboard v1.
   * Includes room statuses, today's arrivals & departures in IST, payments due, and MTD billing/GST.
   */
  async getDashboardSummary(): Promise<DashboardSummary> {
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

    for (const b of activeCheckedInBookings) {
      try {
        const res = await billingService.getBookingBill(b.id);
        if (res.bill.balanceDue > 0) {
          dueCount++;
          dueTotal = dueTotal.add(new Decimal(res.bill.balanceDue));
        }
      } catch {
        // Skip any errored bill
      }
    }

    // 5. Monthly Billed Revenue and Total GST Payable
    // TODO(confirm): Confirm with accountant whether monthly GST payable is based on issued invoices or collected payments.
    // Currently based on issued invoices during the IST calendar month.
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
      monthlyTotalGst = monthlyTotalGst.add(new Decimal(inv.cgst)).add(new Decimal(inv.sgst));
    }

    return {
      rooms: roomCounts,
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
      billing: {
        invoicesCount: monthInvoices.length,
        totalBilled: monthlyTotalBilled.toNumber(),
        totalGst: monthlyTotalGst.toNumber(),
        monthName,
      },
      arrivingToday,
      departingToday,
    };
  },
};
