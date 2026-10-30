import "server-only";
import { prisma } from "@/server/db";
import { BookingStatus } from "@prisma/client";

export interface CalendarRoomItem {
  id: string;
  number: string;
  typeId: string;
  typeName: string;
  pricePerNight: number;
  isActive: boolean;
  hasOpenProblem: boolean;
  openProblemsCount: number;
}

export interface CalendarBookingEvent {
  id: string;
  reference: string;
  roomId: string;
  status: BookingStatus;
  checkInAt: string; // ISO string
  checkOutAt: string; // ISO string
  actualCheckInAt: string | null;
  actualCheckOutAt: string | null;
  primaryGuestName: string;
  primaryGuestMobile: string | null;
  guestCount: number;
  rateApplied: number;
  discount: number;
  totalCharges: number;
  totalPaid: number;
  balanceDue: number;
  source: string;
  companyName: string | null;
}

export interface CalendarMaintenanceEvent {
  id: string;
  roomId: string;
  startsAt: string; // ISO string
  endsAt: string; // ISO string
  reason: string;
}

export interface CalendarTimelineData {
  timeRange: {
    start: string; // ISO string
    end: string; // ISO string
  };
  rooms: CalendarRoomItem[];
  bookings: CalendarBookingEvent[];
  maintenance: CalendarMaintenanceEvent[];
}

export const calendarService = {
  /**
   * Fetches rooms, overlapping bookings, and overlapping maintenance records
   * for the given time interval [startUtc, endUtc].
   */
  async getTimelineData(startUtc: Date, endUtc: Date): Promise<CalendarTimelineData> {
    // 1. Fetch active rooms with type & problem status
    const roomsData = await prisma.room.findMany({
      where: { isActive: true },
      include: {
        type: { select: { name: true } },
        problems: {
          where: { status: "OPEN" },
          select: { id: true },
        },
      },
      orderBy: { number: "asc" },
    });

    const rooms: CalendarRoomItem[] = roomsData.map((r) => ({
      id: r.id,
      number: r.number,
      typeId: r.typeId,
      typeName: r.type.name,
      pricePerNight: Number(r.pricePerNight),
      isActive: r.isActive,
      hasOpenProblem: r.problems.length > 0,
      openProblemsCount: r.problems.length,
    }));

    // 2. Fetch bookings overlapping [startUtc, endUtc]
    // Overlap condition: checkInAt < endUtc AND checkOutAt > startUtc
    const bookingsData = await prisma.booking.findMany({
      where: {
        status: { in: [BookingStatus.RESERVED, BookingStatus.CHECKED_IN, BookingStatus.CHECKED_OUT] },
        checkInAt: { lt: endUtc },
        checkOutAt: { gt: startUtc },
      },
      include: {
        guests: {
          orderBy: { isPrimary: "desc" },
          select: { name: true, mobile: true, isPrimary: true },
        },
        charges: { select: { amount: true } },
        payments: { select: { kind: true, amount: true } },
      },
      orderBy: { checkInAt: "asc" },
    });

    const bookings: CalendarBookingEvent[] = bookingsData.map((b) => {
      const primaryGuest = b.guests.find((g) => g.isPrimary) || b.guests[0];
      const primaryGuestName = primaryGuest ? primaryGuest.name : "Unnamed Guest";
      const primaryGuestMobile = primaryGuest ? primaryGuest.mobile : null;

      const rate = Number(b.rateApplied);
      const discount = Number(b.discount);

      // Simple sum of extra charges
      const chargesSum = b.charges.reduce((acc, c) => acc + Number(c.amount), 0);

      // Payments calculations
      let totalPaid = 0;
      let refunds = 0;
      for (const p of b.payments) {
        const amt = Number(p.amount);
        if (p.kind === "REFUND") {
          refunds += amt;
        } else {
          totalPaid += amt;
        }
      }

      // Net payments made
      const netPaid = totalPaid - refunds;

      // Approximate balance estimation
      const estimatedTotal = Math.max(0, rate + chargesSum - discount);
      const balanceDue = Math.max(0, estimatedTotal - netPaid);

      return {
        id: b.id,
        reference: b.reference,
        roomId: b.roomId,
        status: b.status,
        checkInAt: b.checkInAt.toISOString(),
        checkOutAt: b.checkOutAt.toISOString(),
        actualCheckInAt: b.actualCheckInAt ? b.actualCheckInAt.toISOString() : null,
        actualCheckOutAt: b.actualCheckOutAt ? b.actualCheckOutAt.toISOString() : null,
        primaryGuestName,
        primaryGuestMobile,
        guestCount: b.guests.length,
        rateApplied: rate,
        discount,
        totalCharges: chargesSum,
        totalPaid: netPaid,
        balanceDue,
        source: b.source,
        companyName: b.companyName,
      };
    });

    // 3. Fetch maintenance periods overlapping [startUtc, endUtc]
    const maintenanceData = await prisma.roomMaintenance.findMany({
      where: {
        startsAt: { lt: endUtc },
        endsAt: { gt: startUtc },
      },
      orderBy: { startsAt: "asc" },
    });

    const maintenance: CalendarMaintenanceEvent[] = maintenanceData.map((m) => ({
      id: m.id,
      roomId: m.roomId,
      startsAt: m.startsAt.toISOString(),
      endsAt: m.endsAt.toISOString(),
      reason: m.reason,
    }));

    return {
      timeRange: {
        start: startUtc.toISOString(),
        end: endUtc.toISOString(),
      },
      rooms,
      bookings,
      maintenance,
    };
  },
};
