import "server-only";
import { prisma } from "@/server/db";
import { AppError } from "@/lib/errors";
import { Decimal } from "decimal.js";
import { formatIST } from "@/lib/datetime";
import { type Actor, settingsService } from "./settings.service";
import { calculateStay } from "./billing.service";
import { type NewBookingInput } from "@/features/bookings/schemas";
import { BookingStatus, PaymentKind, PaymentMode, type Sex } from "@prisma/client";

export interface BookingResponse {
  id: string;
  reference: string;
  roomId: string;
  roomNumber: string;
  roomTypeName: string;
  status: BookingStatus;
  source: string;
  checkInAt: Date;
  checkOutAt: Date;
  actualCheckInAt: Date | null;
  actualCheckOutAt: Date | null;
  primaryGuestName: string;
  guestsCount: number;
  rateApplied: number;
  discount: number;
  gstPercentOverride: number | null;
  advancePaid: number;
  stayDays: number;
  estimatedTotal: number;
  balanceDue: number;
}

export const bookingService = {
  /**
   * Creates a new booking (either as a RESERVED booking or immediately CHECKED_IN).
   * Verifies room existence, active state, absence of maintenance collisions,
   * creates advance payment if provided, records audit logs, and handles
   * PostgreSQL exclusion constraints cleanly.
   */
  async createBooking(actor: Actor, data: NewBookingInput): Promise<BookingResponse> {
    const checkIn = new Date(data.checkInAt);
    const checkOut = new Date(data.checkOutAt);

    if (isNaN(checkIn.getTime()) || isNaN(checkOut.getTime())) {
      throw new AppError("VALIDATION_ERROR", "Invalid check-in or check-out date.");
    }

    if (checkOut.getTime() <= checkIn.getTime()) {
      throw new AppError(
        "VALIDATION_ERROR",
        "Check-out time must be strictly after check-in time."
      );
    }

    const settings = await settingsService.getSettings();
    const stay = calculateStay(checkIn, checkOut, settings.hotel.graceMinutes);

    return await prisma.$transaction(async (tx) => {
      // 1. Verify Room exists and is active
      const room = await tx.room.findUnique({
        where: { id: data.roomId },
        include: { type: true },
      });

      if (!room) {
        throw new AppError("ROOM_NOT_FOUND", "The selected room does not exist.");
      }

      if (!room.isActive) {
        throw new AppError(
          "VALIDATION_ERROR",
          `Room ${room.number} is currently disabled and cannot be booked.`
        );
      }

      // 2. Pre-check maintenance collision [startsAt, endsAt)
      const maintenanceConflict = await tx.roomMaintenance.findFirst({
        where: {
          roomId: data.roomId,
          startsAt: { lt: checkOut },
          endsAt: { gt: checkIn },
        },
      });

      if (maintenanceConflict) {
        throw new AppError(
          "MAINTENANCE_OVERLAP",
          `Room ${room.number} is scheduled for maintenance during this time period (${maintenanceConflict.reason}).`
        );
      }

      // 3. Pre-check booking collision [checkInAt, checkOutAt)
      const bookingConflict = await tx.booking.findFirst({
        where: {
          roomId: data.roomId,
          status: { in: [BookingStatus.RESERVED, BookingStatus.CHECKED_IN] },
          checkInAt: { lt: checkOut },
          checkOutAt: { gt: checkIn },
        },
      });

      if (bookingConflict) {
        throw new AppError(
          "ROOM_OVERLAP",
          `Room ${room.number} is already booked or occupied for the selected dates.`
        );
      }

      // 4. Generate sequential human-readable reference for today: BK-YYYYMMDD-001
      const todayPrefix = `BK-${formatIST(new Date(), "yyyyMMdd")}-`;
      const latestBookingToday = await tx.booking.findFirst({
        where: { reference: { startsWith: todayPrefix } },
        orderBy: { reference: "desc" },
        select: { reference: true },
      });

      let nextSequence = 1;
      if (latestBookingToday?.reference) {
        const seqPart = latestBookingToday.reference.replace(todayPrefix, "");
        const parsed = parseInt(seqPart, 10);
        if (!isNaN(parsed)) {
          nextSequence = parsed + 1;
        }
      }

      const reference = `${todayPrefix}${String(nextSequence).padStart(3, "0")}`;

      // 5. Determine initial status & check-in timestamps
      const isCheckInNow = data.action === "CHECK_IN";
      const status = isCheckInNow ? BookingStatus.CHECKED_IN : BookingStatus.RESERVED;
      const actualCheckInAt = isCheckInNow ? new Date() : null;

      const rateAppliedDecimal = new Decimal(data.rateApplied);
      const discountDecimal = new Decimal(data.discount || 0);
      const gstOverrideDecimal =
        data.gstPercentOverride !== null && data.gstPercentOverride !== undefined
          ? new Decimal(data.gstPercentOverride)
          : null;

      // 6. Create booking with guests
      let booking;
      try {
        booking = await tx.booking.create({
          data: {
            reference,
            roomId: data.roomId,
            status,
            source: data.source,
            checkInAt: checkIn,
            checkOutAt: checkOut,
            actualCheckInAt,
            arrivingFrom: data.arrivingFrom || null,
            purposeOfVisit: data.purposeOfVisit || null,
            companyName: data.companyName || null,
            companyGstin: data.companyGstin || null,
            companyAddress: data.companyAddress || null,
            rateApplied: rateAppliedDecimal,
            discount: discountDecimal,
            gstPercentOverride: gstOverrideDecimal,
            createdById: actor.id,
            guests: {
              create: data.guests.map((g) => ({
                name: g.name.trim(),
                fatherName: g.fatherName?.trim() || null,
                age: g.age ?? null,
                sex: (g.sex as Sex) ?? null,
                mobile: g.mobile?.trim() || null,
                isPrimary: Boolean(g.isPrimary),
              })),
            },
          },
          include: {
            room: { include: { type: true } },
            guests: true,
          },
        });
      } catch (err: unknown) {
        const errorMsg = (err as Error)?.message || "";
        if (
          errorMsg.includes("23P01") ||
          errorMsg.includes("booking_no_overlap") ||
          errorMsg.includes("exclusion constraint")
        ) {
          throw new AppError(
            "ROOM_OVERLAP",
            `Room ${room.number} was just booked by another user for the selected dates. Please choose another room or time.`
          );
        }
        throw err;
      }

      // 7. Record advance payment if provided (> 0)
      let advanceAmount = 0;
      if (data.advanceAmount && data.advanceAmount > 0) {
        if (!data.advanceMode) {
          throw new AppError(
            "VALIDATION_ERROR",
            "Payment mode is required for advance payment."
          );
        }

        const paymentDecimal = new Decimal(data.advanceAmount);
        advanceAmount = paymentDecimal.toNumber();

        await tx.payment.create({
          data: {
            bookingId: booking.id,
            kind: PaymentKind.ADVANCE,
            mode: data.advanceMode as PaymentMode,
            amount: paymentDecimal,
            note: "Advance payment collected at booking",
            createdById: actor.id,
          },
        });
      }

      // 8. Calculate estimated bill totals for response
      const roomCharges = rateAppliedDecimal.mul(stay.days);
      const taxableAmount = Decimal.max(0, roomCharges.sub(discountDecimal));

      // Match GST slab percentage
      let effectiveGstPercent = 0;
      if (gstOverrideDecimal !== null) {
        effectiveGstPercent = gstOverrideDecimal.toNumber();
      } else {
        const matchedSlab = settings.gstSlabs.find((s) => {
          const min = new Decimal(s.minRate);
          const max = s.maxRate ? new Decimal(s.maxRate) : null;
          if (rateAppliedDecimal.greaterThanOrEqualTo(min)) {
            if (!max || rateAppliedDecimal.lessThanOrEqualTo(max)) {
              return true;
            }
          }
          return false;
        });
        effectiveGstPercent = matchedSlab ? Number(matchedSlab.percent) : 0;
      }

      const totalTax = taxableAmount.mul(effectiveGstPercent).div(100);
      let estimatedTotal = taxableAmount.add(totalTax);

      if (settings.hotel.roundBillToRupee) {
        estimatedTotal = estimatedTotal.round();
      }

      const balanceDue = Decimal.max(
        0,
        estimatedTotal.sub(new Decimal(advanceAmount))
      ).toNumber();

      // 9. Write audit log
      const primaryGuest =
        booking.guests.find((g) => g.isPrimary) || booking.guests[0];

      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          action: isCheckInNow ? "booking.checkIn" : "booking.create",
          entity: "Booking",
          entityId: booking.id,
          metadata: {
            reference: booking.reference,
            roomNumber: room.number,
            status: booking.status,
            stayDays: stay.days,
            primaryGuest: primaryGuest?.name || "Guest",
            advance: advanceAmount,
            estimatedTotal: estimatedTotal.toNumber(),
          },
        },
      });

      return {
        id: booking.id,
        reference: booking.reference,
        roomId: booking.roomId,
        roomNumber: room.number,
        roomTypeName: room.type.name,
        status: booking.status,
        source: booking.source,
        checkInAt: booking.checkInAt,
        checkOutAt: booking.checkOutAt,
        actualCheckInAt: booking.actualCheckInAt,
        actualCheckOutAt: booking.actualCheckOutAt,
        primaryGuestName: primaryGuest?.name || "Guest",
        guestsCount: booking.guests.length,
        rateApplied: rateAppliedDecimal.toNumber(),
        discount: discountDecimal.toNumber(),
        gstPercentOverride: gstOverrideDecimal ? gstOverrideDecimal.toNumber() : null,
        advancePaid: advanceAmount,
        stayDays: stay.days,
        estimatedTotal: estimatedTotal.toNumber(),
        balanceDue,
      };
    });
  },

  /**
   * Retrieves a single booking with room, guests, payments, charges, and invoice details.
   */
  async getBooking(id: string) {
    const booking = await prisma.booking.findUnique({
      where: { id },
      include: {
        room: { include: { type: true } },
        guests: { orderBy: { isPrimary: "desc" } },
        payments: { orderBy: { receivedAt: "asc" } },
        charges: { orderBy: { createdAt: "asc" } },
        invoice: true,
      },
    });

    if (!booking) {
      throw new AppError("BOOKING_NOT_FOUND", "Booking not found.");
    }

    const settings = await settingsService.getSettings();
    const stay = calculateStay(
      booking.checkInAt,
      booking.checkOutAt,
      settings.hotel.graceMinutes
    );

    const totalPaid = booking.payments
      .filter((p) => p.kind !== PaymentKind.REFUND)
      .reduce((acc, p) => acc.add(new Decimal(p.amount)), new Decimal(0));

    const totalRefunds = booking.payments
      .filter((p) => p.kind === PaymentKind.REFUND)
      .reduce((acc, p) => acc.add(new Decimal(p.amount)), new Decimal(0));

    const netPaid = totalPaid.sub(totalRefunds);

    const roomCharges = new Decimal(booking.rateApplied).mul(stay.days);
    const otherTaxableCharges = booking.charges
      .filter((c) => c.isTaxable)
      .reduce((acc, c) => acc.add(new Decimal(c.amount)), new Decimal(0));
    const nonTaxableCharges = booking.charges
      .filter((c) => !c.isTaxable)
      .reduce((acc, c) => acc.add(new Decimal(c.amount)), new Decimal(0));

    const taxableAmount = Decimal.max(
      0,
      roomCharges.add(otherTaxableCharges).sub(new Decimal(booking.discount))
    );

    let gstPercent = 0;
    if (booking.gstPercentOverride !== null) {
      gstPercent = Number(booking.gstPercentOverride);
    } else {
      const matchedSlab = settings.gstSlabs.find((s) => {
        const min = new Decimal(s.minRate);
        const max = s.maxRate ? new Decimal(s.maxRate) : null;
        const rate = new Decimal(booking.rateApplied);
        if (rate.greaterThanOrEqualTo(min)) {
          if (!max || rate.lessThanOrEqualTo(max)) return true;
        }
        return false;
      });
      gstPercent = matchedSlab ? Number(matchedSlab.percent) : 0;
    }

    const taxAmount = taxableAmount.mul(gstPercent).div(100);
    let billTotal = taxableAmount.add(taxAmount).add(nonTaxableCharges);

    if (settings.hotel.roundBillToRupee) {
      billTotal = billTotal.round();
    }

    const balance = billTotal.sub(netPaid);

    return {
      id: booking.id,
      reference: booking.reference,
      status: booking.status,
      source: booking.source,
      roomId: booking.roomId,
      roomNumber: booking.room.number,
      roomTypeName: booking.room.type.name,
      checkInAt: booking.checkInAt,
      checkOutAt: booking.checkOutAt,
      actualCheckInAt: booking.actualCheckInAt,
      actualCheckOutAt: booking.actualCheckOutAt,
      arrivingFrom: booking.arrivingFrom,
      purposeOfVisit: booking.purposeOfVisit,
      companyName: booking.companyName,
      companyGstin: booking.companyGstin,
      companyAddress: booking.companyAddress,
      rateApplied: Number(booking.rateApplied),
      discount: Number(booking.discount),
      gstPercentOverride: booking.gstPercentOverride
        ? Number(booking.gstPercentOverride)
        : null,
      effectiveGstPercent: gstPercent,
      stayDays: stay.days,
      roomCharges: roomCharges.toNumber(),
      taxableAmount: taxableAmount.toNumber(),
      taxAmount: taxAmount.toNumber(),
      cgst: taxAmount.div(2).toNumber(),
      sgst: taxAmount.div(2).toNumber(),
      totalAmount: billTotal.toNumber(),
      totalPaid: netPaid.toNumber(),
      balanceDue: balance.toNumber(),
      guests: booking.guests.map((g) => ({
        id: g.id,
        name: g.name,
        fatherName: g.fatherName,
        age: g.age,
        sex: g.sex,
        mobile: g.mobile,
        isPrimary: g.isPrimary,
      })),
      payments: booking.payments.map((p) => ({
        id: p.id,
        kind: p.kind,
        mode: p.mode,
        amount: Number(p.amount),
        note: p.note,
        receivedAt: p.receivedAt,
      })),
      charges: booking.charges.map((c) => ({
        id: c.id,
        description: c.description,
        amount: Number(c.amount),
        isTaxable: c.isTaxable,
        createdAt: c.createdAt,
      })),
      invoice: booking.invoice
        ? {
            id: booking.invoice.id,
            number: booking.invoice.number,
            displayNo: booking.invoice.displayNo,
            status: booking.invoice.status,
            issuedAt: booking.invoice.issuedAt,
          }
        : null,
    };
  },

  /**
   * Lists bookings with pagination, status filter, and guest/room search.
   */
  async listBookings(options?: {
    status?: BookingStatus;
    search?: string;
    limit?: number;
    offset?: number;
  }) {
    const limit = Math.min(100, Math.max(1, options?.limit ?? 50));
    const offset = Math.max(0, options?.offset ?? 0);

    const where = {
      ...(options?.status ? { status: options.status } : {}),
      ...(options?.search
        ? {
            OR: [
              { reference: { contains: options.search.trim(), mode: "insensitive" as const } },
              { room: { number: { contains: options.search.trim(), mode: "insensitive" as const } } },
              {
                guests: {
                  some: {
                    name: { contains: options.search.trim(), mode: "insensitive" as const },
                  },
                },
              },
            ],
          }
        : {}),
    };

    const [total, bookings] = await Promise.all([
      prisma.booking.count({ where }),
      prisma.booking.findMany({
        where,
        include: {
          room: { include: { type: true } },
          guests: { where: { isPrimary: true } },
          payments: true,
        },
        orderBy: { checkInAt: "desc" },
        take: limit,
        skip: offset,
      }),
    ]);

    return {
      total,
      limit,
      offset,
      bookings: bookings.map((b) => {
        const primaryGuest = b.guests[0];
        const advance = b.payments
          .filter((p) => p.kind === PaymentKind.ADVANCE)
          .reduce((sum, p) => sum + Number(p.amount), 0);

        return {
          id: b.id,
          reference: b.reference,
          roomId: b.roomId,
          roomNumber: b.room.number,
          roomTypeName: b.room.type.name,
          status: b.status,
          source: b.source,
          checkInAt: b.checkInAt,
          checkOutAt: b.checkOutAt,
          actualCheckInAt: b.actualCheckInAt,
          actualCheckOutAt: b.actualCheckOutAt,
          guestName: primaryGuest?.name || "Guest",
          guestMobile: primaryGuest?.mobile || null,
          rateApplied: Number(b.rateApplied),
          advancePaid: advance,
        };
      }),
    };
  },
};
