import "server-only";
import { prisma } from "@/server/db";
import { AppError } from "@/lib/errors";
import { Decimal } from "decimal.js";
import { formatIST } from "@/lib/datetime";
import { type Actor, settingsService } from "./settings.service";
import { calculateStay, billingService } from "./billing.service";

export type BookingBillSummary = Awaited<
  ReturnType<typeof billingService.getBookingBill>
>["bill"];
import {
  type NewBookingInput,
  type UpdateBookingDatesInput,
} from "@/features/bookings/schemas";
import {
  BookingStatus,
  PaymentKind,
  PaymentMode,
  type Sex,
} from "@prisma/client";

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
  groupBookingId?: string | null;
  isGroupMaster?: boolean;
  groupRoomCount?: number;
}

export const bookingService = {
  /**
   * Creates a new booking (either as a RESERVED booking or immediately CHECKED_IN).
   * Verifies room existence, active state, absence of maintenance collisions,
   * supports single or multi-room bookings with group linking, creates advance payment,
   * records audit logs, and handles PostgreSQL exclusion constraints cleanly.
   */
  async createBooking(
    actor: Actor,
    data: NewBookingInput
  ): Promise<BookingResponse> {
    const checkIn = new Date(data.checkInAt);
    const checkOut = new Date(data.checkOutAt);

    if (isNaN(checkIn.getTime()) || isNaN(checkOut.getTime())) {
      throw new AppError(
        "VALIDATION_ERROR",
        "Invalid check-in or check-out date."
      );
    }

    if (checkOut.getTime() <= checkIn.getTime()) {
      throw new AppError(
        "VALIDATION_ERROR",
        "Check-out time must be strictly after check-in time."
      );
    }

    const settings = await settingsService.getSettings();
    const stay = calculateStay(checkIn, checkOut, settings.hotel.graceMinutes);

    // Resolve rooms list: supports either multi-room `data.rooms` or single `data.roomId`
    const roomList: Array<{ roomId: string; rateApplied: number }> =
      data.rooms && data.rooms.length > 0
        ? data.rooms
        : [
            {
              roomId: data.roomId!,
              rateApplied: data.rateApplied ?? 0,
            },
          ];

    if (roomList.length === 0) {
      throw new AppError("VALIDATION_ERROR", "Please select at least one room.");
    }

    let retries = 5;
    while (retries > 0) {
      try {
        return await prisma.$transaction(async (tx) => {
          // 1. Verify all rooms exist and are active
          const rooms = await Promise.all(
            roomList.map(async (item) => {
              const r = await tx.room.findUnique({
                where: { id: item.roomId },
                include: { type: true },
              });

              if (!r) {
                throw new AppError(
                  "ROOM_NOT_FOUND",
                  `Room was not found in database.`
                );
              }

              if (!r.isActive) {
                throw new AppError(
                  "VALIDATION_ERROR",
                  `Room ${r.number} is currently disabled and cannot be booked.`
                );
              }

              return r;
            })
          );

          // 2. Pre-check maintenance collision for all rooms [startsAt, endsAt)
          for (const room of rooms) {
            const maintenanceConflict = await tx.roomMaintenance.findFirst({
              where: {
                roomId: room.id,
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
          }

          // 3. Pre-check booking collision for all rooms [checkInAt, checkOutAt)
          for (const room of rooms) {
            const bookingConflict = await tx.booking.findFirst({
              where: {
                roomId: room.id,
                status: {
                  in: [BookingStatus.RESERVED, BookingStatus.CHECKED_IN],
                },
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
          }

          // 4. Generate Group ID if multi-room booking
          const isGroup = roomList.length > 1;
          let groupBookingId: string | null = null;
          if (isGroup) {
            const todayGroupPrefix = `GRP-${formatIST(new Date(), "yyyyMMdd")}-`;
            const latestGroupToday = await tx.booking.findFirst({
              where: { groupBookingId: { startsWith: todayGroupPrefix } },
              orderBy: { groupBookingId: "desc" },
              select: { groupBookingId: true },
            });

            let nextGroupSeq = 1;
            if (latestGroupToday?.groupBookingId) {
              const seqPart = latestGroupToday.groupBookingId.replace(
                todayGroupPrefix,
                ""
              );
              const parsed = parseInt(seqPart, 10);
              if (!isNaN(parsed)) {
                nextGroupSeq = parsed + 1;
              }
            }
            groupBookingId = `${todayGroupPrefix}${String(nextGroupSeq).padStart(3, "0")}`;
          }

          // 5. Generate sequential human-readable references: BK-YYYYMMDD-001, ...
          const todayPrefix = `BK-${formatIST(new Date(), "yyyyMMdd")}-`;
          const latestBookingToday = await tx.booking.findFirst({
            where: { reference: { startsWith: todayPrefix } },
            orderBy: { reference: "desc" },
            select: { reference: true },
          });

          let nextSequence = 1;
          if (latestBookingToday?.reference) {
            const seqPart = latestBookingToday.reference.replace(
              todayPrefix,
              ""
            );
            const parsed = parseInt(seqPart, 10);
            if (!isNaN(parsed)) {
              nextSequence = parsed + 1;
            }
          }

          // 6. Determine initial status & check-in timestamps
          const isCheckInNow = data.action === "CHECK_IN";
          const status = isCheckInNow
            ? BookingStatus.CHECKED_IN
            : BookingStatus.RESERVED;
          const actualCheckInAt = isCheckInNow ? new Date() : null;

          const primaryGuest =
            data.guests.find((g) => g.isPrimary) || data.guests[0];

          // 7. Create each booking record
          const createdBookings = [];
          for (let i = 0; i < roomList.length; i++) {
            const item = roomList[i];
            const room = rooms[i];
            const isMaster = i === 0;
            const reference = `${todayPrefix}${String(nextSequence + i).padStart(3, "0")}`;

            // All rooms are associated with the primary guest. Master booking retains the party's guests.
            const finalRoomGuests = isMaster
              ? data.guests
              : [
                  {
                    ...primaryGuest,
                    isPrimary: true,
                  },
                ];

            const rateAppliedDecimal = new Decimal(item.rateApplied);
            const discountDecimal = isMaster
              ? new Decimal(data.discount || 0)
              : new Decimal(0);
            const gstOverrideDecimal =
              data.gstPercentOverride !== null &&
              data.gstPercentOverride !== undefined
                ? new Decimal(data.gstPercentOverride)
                : null;

            let booking;
            try {
              booking = await tx.booking.create({
                data: {
                  reference,
                  groupBookingId,
                  isGroupMaster: isMaster,
                  roomId: item.roomId,
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
                    create: finalRoomGuests.map((g) => ({
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

            createdBookings.push({ booking, room, rateAppliedDecimal });

            // Audit log for this room booking
            await tx.auditLog.create({
              data: {
                actorId: actor.id,
                action: isCheckInNow ? "booking.checkIn" : "booking.create",
                entity: "Booking",
                entityId: booking.id,
                metadata: {
                  reference: booking.reference,
                  groupBookingId,
                  isGroupMaster: isMaster,
                  roomNumber: room.number,
                  status: booking.status,
                  stayDays: stay.days,
                  primaryGuest: primaryGuest?.name || "Guest",
                },
              },
            });
          }

          const masterItem = createdBookings[0];
          const masterBooking = masterItem.booking;

          // 8. Record combined advance payment on master booking if provided
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
                bookingId: masterBooking.id,
                kind: PaymentKind.ADVANCE,
                mode: data.advanceMode as PaymentMode,
                amount: paymentDecimal,
                note: isGroup
                  ? `Group advance deposit for ${createdBookings.length} rooms (${createdBookings.map((b) => b.room.number).join(", ")})`
                  : "Advance payment collected at booking",
                createdById: actor.id,
              },
            });
          }

          // 9. Calculate combined estimated totals
          const totalNightlyTariff = roomList.reduce(
            (acc, r) => acc.add(new Decimal(r.rateApplied)),
            new Decimal(0)
          );
          const combinedRoomCharges = totalNightlyTariff.mul(stay.days);
          const discountDecimal = new Decimal(data.discount || 0);
          const taxableAmount = Decimal.max(
            0,
            combinedRoomCharges.sub(discountDecimal)
          );

          let effectiveGstPercent = 0;
          if (
            data.gstPercentOverride !== null &&
            data.gstPercentOverride !== undefined
          ) {
            effectiveGstPercent = Number(data.gstPercentOverride);
          } else {
            const matchedSlab = settings.gstSlabs.find((s) => {
              const min = new Decimal(s.minRate);
              const max = s.maxRate ? new Decimal(s.maxRate) : null;
              if (totalNightlyTariff.greaterThanOrEqualTo(min)) {
                if (!max || totalNightlyTariff.lessThanOrEqualTo(max)) {
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

          return {
            id: masterBooking.id,
            reference: masterBooking.reference,
            roomId: masterBooking.roomId,
            roomNumber: masterItem.room.number,
            roomTypeName: masterItem.room.type.name,
            status: masterBooking.status,
            source: masterBooking.source,
            checkInAt: masterBooking.checkInAt,
            checkOutAt: masterBooking.checkOutAt,
            actualCheckInAt: masterBooking.actualCheckInAt,
            actualCheckOutAt: masterBooking.actualCheckOutAt,
            primaryGuestName: primaryGuest?.name || "Guest",
            guestsCount: data.guests.length,
            rateApplied: masterItem.rateAppliedDecimal.toNumber(),
            discount: discountDecimal.toNumber(),
            gstPercentOverride:
              data.gstPercentOverride !== null &&
              data.gstPercentOverride !== undefined
                ? Number(data.gstPercentOverride)
                : null,
            advancePaid: advanceAmount,
            stayDays: stay.days,
            estimatedTotal: estimatedTotal.toNumber(),
            balanceDue,
            groupBookingId,
            isGroupMaster: isGroup,
            groupRoomCount: roomList.length,
          };
        });
      } catch (err: unknown) {
        const errorMsg = (err as Error)?.message || "";
        if (
          (errorMsg.includes("Booking_reference_key") ||
            errorMsg.includes("P2002")) &&
          retries > 1
        ) {
          retries--;
          await new Promise((r) =>
            setTimeout(r, Math.floor(Math.random() * 50) + 15)
          );
          continue;
        }
        throw err;
      }
    }
    throw new AppError(
      "INTERNAL_ERROR",
      "Failed to generate unique booking reference."
    );
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

    let groupRooms: Array<{
      id: string;
      reference: string;
      roomId: string;
      roomNumber: string;
      roomTypeName: string;
      status: BookingStatus;
      rateApplied: number;
      stayDays: number;
      roomCharge: number;
      isGroupMaster: boolean;
      guests: Array<{
        name: string;
        isPrimary: boolean;
      }>;
    }> = [];

    let groupBill: BookingBillSummary | null = null;

    if (booking.groupBookingId) {
      const billData = await billingService.getBookingBill(booking.id);
      groupBill = billData.bill;
      groupRooms = (billData.groupRooms || []).map((gr) => ({
        id: gr.bookingId,
        reference: gr.reference,
        roomId: gr.roomId,
        roomNumber: gr.roomNumber,
        roomTypeName: gr.roomTypeName,
        status: gr.status as BookingStatus,
        rateApplied: gr.rateApplied,
        stayDays: gr.stayDays,
        roomCharge: gr.roomCharge,
        isGroupMaster: gr.isGroupMaster,
        guests: gr.guests.map((g) => ({
          name: g.name,
          isPrimary: g.isPrimary,
        })),
      }));
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
      groupBookingId: booking.groupBookingId,
      isGroupMaster: booking.isGroupMaster,
      groupRooms,
      groupBill,
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
    const limit = Math.min(1000, Math.max(1, options?.limit ?? 500));
    const offset = Math.max(0, options?.offset ?? 0);

    // If search is provided, find any group bookings that match by secondary room or guest
    let matchingGroupIds: string[] = [];
    if (options?.search?.trim()) {
      const q = options.search.trim();
      const matchingBookings = await prisma.booking.findMany({
        where: {
          groupBookingId: { not: null },
          OR: [
            { room: { number: { contains: q, mode: "insensitive" } } },
            { guests: { some: { name: { contains: q, mode: "insensitive" } } } },
            { reference: { contains: q, mode: "insensitive" } },
          ],
        },
        select: { groupBookingId: true },
      });
      matchingGroupIds = Array.from(
        new Set(matchingBookings.map((b) => b.groupBookingId).filter(Boolean) as string[])
      );
    }

    const searchConditions = options?.search?.trim()
      ? [
          {
            OR: [
              {
                reference: {
                  contains: options.search.trim(),
                  mode: "insensitive" as const,
                },
              },
              {
                room: {
                  number: {
                    contains: options.search.trim(),
                    mode: "insensitive" as const,
                  },
                },
              },
              {
                guests: {
                  some: {
                    name: {
                      contains: options.search.trim(),
                      mode: "insensitive" as const,
                    },
                  },
                },
              },
              ...(matchingGroupIds.length > 0
                ? [{ groupBookingId: { in: matchingGroupIds } }]
                : []),
            ],
          },
        ]
      : [];

    const where = {
      ...(options?.status ? { status: options.status } : {}),
      AND: [
        {
          OR: [{ groupBookingId: null }, { isGroupMaster: true }],
        },
        ...searchConditions,
      ],
    };

    const [total, bookings] = await Promise.all([
      prisma.booking.count({ where }),
      prisma.booking.findMany({
        where,
        include: {
          room: { include: { type: true } },
          guests: { where: { isPrimary: true } },
          payments: true,
          invoice: {
            select: {
              id: true,
              displayNo: true,
              status: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
    ]);

    // Fetch sibling rooms and payments for any group bookings in this page
    const groupBookingIds = Array.from(
      new Set(
        bookings
          .map((b) => b.groupBookingId)
          .filter(Boolean) as string[]
      )
    );

    const siblingMap = new Map<
      string,
      Array<{
        id: string;
        roomId: string;
        roomNumber: string;
        roomTypeName: string;
        rateApplied: number;
        advancePaid: number;
        status: BookingStatus;
        invoice: { id: string; displayNo: string; status: string } | null;
      }>
    >();

    if (groupBookingIds.length > 0) {
      const siblings = await prisma.booking.findMany({
        where: { groupBookingId: { in: groupBookingIds } },
        include: {
          room: { include: { type: true } },
          payments: true,
          invoice: {
            select: {
              id: true,
              displayNo: true,
              status: true,
            },
          },
        },
        orderBy: { room: { number: "asc" } },
      });

      for (const s of siblings) {
        if (!s.groupBookingId) continue;
        const list = siblingMap.get(s.groupBookingId) || [];
        const adv = s.payments
          .filter((p) => p.kind === PaymentKind.ADVANCE)
          .reduce((sum, p) => sum + Number(p.amount), 0);

        list.push({
          id: s.id,
          roomId: s.roomId,
          roomNumber: s.room.number,
          roomTypeName: s.room.type.name,
          rateApplied: Number(s.rateApplied),
          advancePaid: adv,
          status: s.status,
          invoice: s.invoice ? { id: s.invoice.id, displayNo: s.invoice.displayNo, status: s.invoice.status } : null,
        });
        siblingMap.set(s.groupBookingId, list);
      }
    }

    return {
      total,
      limit,
      offset,
      bookings: bookings.map((b) => {
        const primaryGuest = b.guests[0];
        const singleAdvance = b.payments
          .filter((p) => p.kind === PaymentKind.ADVANCE)
          .reduce((sum, p) => sum + Number(p.amount), 0);

        const groupSiblings = b.groupBookingId
          ? siblingMap.get(b.groupBookingId) || []
          : [];

        const isGroup = groupSiblings.length > 1;

        const groupRoomNumbers = isGroup
          ? groupSiblings.map((s) => s.roomNumber)
          : [b.room.number];

        const rateApplied = isGroup
          ? groupSiblings.reduce((sum, s) => sum + s.rateApplied, 0)
          : Number(b.rateApplied);

        const advancePaid = isGroup
          ? groupSiblings.reduce((sum, s) => sum + s.advancePaid, 0)
          : singleAdvance;

        const roomNumber = isGroup
          ? groupRoomNumbers.join(", ")
          : b.room.number;

        // Group invoice: check master booking first, or any sibling with an issued invoice
        const matchedInvoice = isGroup
          ? (b.invoice || groupSiblings.find((s) => s.invoice)?.invoice || null)
          : b.invoice;

        return {
          id: b.id,
          reference: b.reference,
          roomId: b.roomId,
          roomNumber,
          roomTypeName: b.room.type.name,
          status: b.status,
          source: b.source,
          checkInAt: b.checkInAt,
          checkOutAt: b.checkOutAt,
          actualCheckInAt: b.actualCheckInAt,
          actualCheckOutAt: b.actualCheckOutAt,
          guestName: primaryGuest?.name || "Guest",
          guestMobile: primaryGuest?.mobile || null,
          rateApplied,
          advancePaid,
          createdAt: b.createdAt,
          groupBookingId: b.groupBookingId,
          isGroupMaster: b.isGroupMaster,
          groupRoomNumbers: isGroup ? groupRoomNumbers : undefined,
          groupRoomCount: isGroup ? groupRoomNumbers.length : undefined,
          invoiceId: matchedInvoice?.id || null,
          invoiceDisplayNo: matchedInvoice?.displayNo || null,
        };
      }),
    };
  },

  /**
   * Checks in a guest for an existing RESERVED booking.
   * Transitions status from RESERVED -> CHECKED_IN and sets actualCheckInAt = now.
  /**
   * Atomically checks in all eligible rooms for a group booking.
   * Ensures that all associated bookings are validated, prevents partial group check-ins on failure,
   * and records audit logs for all updated bookings.
   */
  async checkInGroup(actor: Actor, groupBookingId: string) {
    return await prisma.$transaction(async (tx) => {
      const groupBookings = await tx.booking.findMany({
        where: { groupBookingId },
        include: {
          room: { include: { type: true } },
          guests: true,
        },
      });

      if (groupBookings.length === 0) {
        throw new AppError("BOOKING_NOT_FOUND", "Group booking not found.");
      }

      const reservedBookings = groupBookings.filter(
        (b) => b.status === BookingStatus.RESERVED
      );
      const checkedInBookings = groupBookings.filter(
        (b) => b.status === BookingStatus.CHECKED_IN
      );

      if (reservedBookings.length === 0) {
        if (checkedInBookings.length > 0) {
          throw new AppError(
            "VALIDATION_ERROR",
            "All rooms in this group reservation are already checked in."
          );
        }
        throw new AppError(
          "VALIDATION_ERROR",
          "No rooms in this group are eligible for check-in."
        );
      }

      const now = new Date();
      const groupBookingIds = groupBookings.map((b) => b.id);

      // Validate all reserved rooms for maintenance or occupancy conflicts before applying any changes
      for (const b of reservedBookings) {
        const activeMaintenance = await tx.roomMaintenance.findFirst({
          where: {
            roomId: b.roomId,
            startsAt: { lte: now },
            endsAt: { gte: now },
          },
        });

        if (activeMaintenance) {
          throw new AppError(
            "MAINTENANCE_OVERLAP",
            `Cannot check in group: Room ${b.room.number} is currently under maintenance (${activeMaintenance.reason}).`
          );
        }

        const activeOtherBooking = await tx.booking.findFirst({
          where: {
            roomId: b.roomId,
            id: { notIn: groupBookingIds },
            status: BookingStatus.CHECKED_IN,
            actualCheckOutAt: null,
          },
        });

        if (activeOtherBooking) {
          throw new AppError(
            "ROOM_OVERLAP",
            `Cannot check in group: Room ${b.room.number} is currently occupied by another guest (Booking ${activeOtherBooking.reference}).`
          );
        }
      }

      // Atomically update all eligible rooms to CHECKED_IN
      const updatedBookings = [];
      for (const b of reservedBookings) {
        const updated = await tx.booking.update({
          where: { id: b.id },
          data: {
            status: BookingStatus.CHECKED_IN,
            actualCheckInAt: now,
          },
          include: {
            room: { include: { type: true } },
            guests: true,
          },
        });
        updatedBookings.push(updated);

        const primaryGuest =
          updated.guests.find((g) => g.isPrimary) || updated.guests[0];

        await tx.auditLog.create({
          data: {
            actorId: actor.id,
            action: "booking.checkInGroup",
            entity: "Booking",
            entityId: updated.id,
            metadata: {
              groupBookingId,
              reference: updated.reference,
              roomNumber: updated.room.number,
              primaryGuest: primaryGuest?.name || "Guest",
              actualCheckInAt: now.toISOString(),
            },
          },
        });
      }

      return {
        groupBookingId,
        updatedBookings,
        count: updatedBookings.length,
      };
    });
  },

  /**
   * Checks in a reserved booking.
   * If the booking belongs to a multi-room group reservation, atomically checks in all eligible
   * rooms in that group. Otherwise performs standard single-room check-in.
   */
  async checkInReserved(actor: Actor, bookingId: string) {
    return await prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findUnique({
        where: { id: bookingId },
        include: {
          room: { include: { type: true } },
          guests: true,
        },
      });

      if (!booking) {
        throw new AppError("BOOKING_NOT_FOUND", "Booking not found.");
      }

      // If part of a multi-room group reservation, check in all eligible rooms in the group
      if (booking.groupBookingId) {
        const siblingCount = await tx.booking.count({
          where: { groupBookingId: booking.groupBookingId },
        });

        if (siblingCount > 1) {
          const groupBookings = await tx.booking.findMany({
            where: { groupBookingId: booking.groupBookingId },
            include: {
              room: { include: { type: true } },
              guests: true,
            },
          });

          const reservedBookings = groupBookings.filter(
            (b) => b.status === BookingStatus.RESERVED
          );
          const checkedInBookings = groupBookings.filter(
            (b) => b.status === BookingStatus.CHECKED_IN
          );

          if (reservedBookings.length === 0) {
            if (checkedInBookings.length > 0) {
              throw new AppError(
                "VALIDATION_ERROR",
                "All rooms in this group reservation are already checked in."
              );
            }
            throw new AppError(
              "VALIDATION_ERROR",
              "No rooms in this group are eligible for check-in."
            );
          }

          const now = new Date();
          const groupBookingIds = groupBookings.map((b) => b.id);

          for (const b of reservedBookings) {
            const activeMaintenance = await tx.roomMaintenance.findFirst({
              where: {
                roomId: b.roomId,
                startsAt: { lte: now },
                endsAt: { gte: now },
              },
            });

            if (activeMaintenance) {
              throw new AppError(
                "MAINTENANCE_OVERLAP",
                `Cannot check in group: Room ${b.room.number} is currently under maintenance (${activeMaintenance.reason}).`
              );
            }

            const activeOtherBooking = await tx.booking.findFirst({
              where: {
                roomId: b.roomId,
                id: { notIn: groupBookingIds },
                status: BookingStatus.CHECKED_IN,
                actualCheckOutAt: null,
              },
            });

            if (activeOtherBooking) {
              throw new AppError(
                "ROOM_OVERLAP",
                `Cannot check in group: Room ${b.room.number} is currently occupied by another guest (Booking ${activeOtherBooking.reference}).`
              );
            }
          }

          let currentUpdated = null;
          for (const b of reservedBookings) {
            const updated = await tx.booking.update({
              where: { id: b.id },
              data: {
                status: BookingStatus.CHECKED_IN,
                actualCheckInAt: now,
              },
              include: {
                room: { include: { type: true } },
                guests: true,
              },
            });

            if (updated.id === booking.id) {
              currentUpdated = updated;
            }

            const primaryGuest =
              updated.guests.find((g) => g.isPrimary) || updated.guests[0];

            await tx.auditLog.create({
              data: {
                actorId: actor.id,
                action: "booking.checkInGroup",
                entity: "Booking",
                entityId: updated.id,
                metadata: {
                  groupBookingId: booking.groupBookingId,
                  reference: updated.reference,
                  roomNumber: updated.room.number,
                  primaryGuest: primaryGuest?.name || "Guest",
                  actualCheckInAt: now.toISOString(),
                },
              },
            });
          }

          if (currentUpdated) {
            return currentUpdated;
          }

          return await tx.booking.findUniqueOrThrow({
            where: { id: booking.id },
            include: {
              room: { include: { type: true } },
              guests: true,
            },
          });
        }
      }

      // Normal single-room check-in
      if (booking.status === BookingStatus.CHECKED_IN) {
        throw new AppError("VALIDATION_ERROR", "Guest is already checked in.");
      }

      if (booking.status === BookingStatus.CHECKED_OUT) {
        throw new AppError(
          "VALIDATION_ERROR",
          "Cannot check in an already checked-out booking."
        );
      }

      if (booking.status === BookingStatus.CANCELLED) {
        throw new AppError(
          "VALIDATION_ERROR",
          "Cannot check in a cancelled reservation."
        );
      }

      const now = new Date();

      // Check if room is currently under maintenance
      const activeMaintenance = await tx.roomMaintenance.findFirst({
        where: {
          roomId: booking.roomId,
          startsAt: { lte: now },
          endsAt: { gte: now },
        },
      });

      if (activeMaintenance) {
        throw new AppError(
          "MAINTENANCE_OVERLAP",
          `Cannot check in: Room ${booking.room.number} is currently under maintenance (${activeMaintenance.reason}).`
        );
      }

      // Check if room is currently occupied by another active booking
      const activeOtherBooking = await tx.booking.findFirst({
        where: {
          roomId: booking.roomId,
          id: { not: booking.id },
          status: BookingStatus.CHECKED_IN,
          actualCheckOutAt: null,
        },
      });

      if (activeOtherBooking) {
        throw new AppError(
          "ROOM_OVERLAP",
          `Cannot check in: Room ${booking.room.number} is currently occupied by another guest (Booking ${activeOtherBooking.reference}).`
        );
      }

      const updated = await tx.booking.update({
        where: { id: booking.id },
        data: {
          status: BookingStatus.CHECKED_IN,
          actualCheckInAt: now,
        },
        include: {
          room: { include: { type: true } },
          guests: true,
        },
      });

      const primaryGuest =
        updated.guests.find((g) => g.isPrimary) || updated.guests[0];

      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          action: "booking.checkInReserved",
          entity: "Booking",
          entityId: updated.id,
          metadata: {
            reference: updated.reference,
            roomNumber: updated.room.number,
            primaryGuest: primaryGuest?.name || "Guest",
            actualCheckInAt: now.toISOString(),
          },
        },
      });

      return updated;
    });
  },

  /**
   * Cancels a booking (RESERVED or CHECKED_IN).
   * Checked-out bookings cannot be cancelled.
   */
  async cancelBooking(
    actor: Actor,
    data: { bookingId: string; reason?: string }
  ) {
    return await prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findUnique({
        where: { id: data.bookingId },
        include: {
          room: true,
          guests: true,
          payments: true,
        },
      });

      if (!booking) {
        throw new AppError("BOOKING_NOT_FOUND", "Booking not found.");
      }

      if (booking.status === BookingStatus.CHECKED_OUT) {
        throw new AppError(
          "VALIDATION_ERROR",
          "Cannot cancel an already checked-out stay."
        );
      }

      if (booking.status === BookingStatus.CANCELLED) {
        throw new AppError("VALIDATION_ERROR", "Booking is already cancelled.");
      }

      const updated = await tx.booking.update({
        where: { id: booking.id },
        data: {
          status: BookingStatus.CANCELLED,
        },
      });

      const primaryGuest =
        booking.guests.find((g) => g.isPrimary) || booking.guests[0];

      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          action: "booking.cancel",
          entity: "Booking",
          entityId: booking.id,
          metadata: {
            reference: booking.reference,
            roomNumber: booking.room.number,
            primaryGuest: primaryGuest?.name || "Guest",
            reason: data.reason?.trim() || "Cancelled by front desk staff",
            paymentsCount: booking.payments.length,
          },
        },
      });

      return updated;
    });
  },

  /**
   * Modifies the check-in and/or check-out dates of an active booking (RESERVED or CHECKED_IN).
   * Verifies that the room is available during the new duration (no collisions with other bookings or maintenance).
   */
  async updateBookingDates(
    actor: Actor,
    data: UpdateBookingDatesInput
  ) {
    const checkIn = new Date(data.checkInAt);
    const checkOut = new Date(data.checkOutAt);

    if (isNaN(checkIn.getTime()) || isNaN(checkOut.getTime())) {
      throw new AppError(
        "VALIDATION_ERROR",
        "Invalid check-in or check-out date."
      );
    }

    if (checkOut.getTime() <= checkIn.getTime()) {
      throw new AppError(
        "VALIDATION_ERROR",
        "Check-out time must be strictly after check-in time."
      );
    }

    return await prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findUnique({
        where: { id: data.bookingId },
        include: { room: true },
      });

      if (!booking) {
        throw new AppError(
          "BOOKING_NOT_FOUND",
          "The requested booking does not exist."
        );
      }

      if (booking.status === BookingStatus.CHECKED_OUT) {
        throw new AppError(
          "VALIDATION_ERROR",
          "Cannot modify dates for an already checked-out stay."
        );
      }

      if (booking.status === BookingStatus.CANCELLED) {
        throw new AppError(
          "VALIDATION_ERROR",
          "Cannot modify dates for a cancelled booking."
        );
      }

      // 1. Maintenance conflict check
      const maintenanceConflict = await tx.roomMaintenance.findFirst({
        where: {
          roomId: booking.roomId,
          startsAt: { lt: checkOut },
          endsAt: { gt: checkIn },
        },
      });

      if (maintenanceConflict) {
        throw new AppError(
          "MAINTENANCE_OVERLAP",
          `Room ${booking.room.number} has maintenance scheduled during these dates (${maintenanceConflict.reason}).`
        );
      }

      // 2. Booking collision check (excluding this booking)
      const bookingConflict = await tx.booking.findFirst({
        where: {
          id: { not: booking.id },
          roomId: booking.roomId,
          status: {
            in: [BookingStatus.RESERVED, BookingStatus.CHECKED_IN],
          },
          checkInAt: { lt: checkOut },
          checkOutAt: { gt: checkIn },
        },
      });

      if (bookingConflict) {
        throw new AppError(
          "ROOM_OVERLAP",
          `Room ${booking.room.number} is already booked or occupied by another guest during these dates.`
        );
      }

      const updated = await tx.booking.update({
        where: { id: booking.id },
        data: {
          checkInAt: checkIn,
          checkOutAt: checkOut,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          action: "booking.update_dates",
          entity: "Booking",
          entityId: booking.id,
          metadata: {
            reference: booking.reference,
            roomNumber: booking.room.number,
            oldCheckInAt: booking.checkInAt.toISOString(),
            oldCheckOutAt: booking.checkOutAt.toISOString(),
            newCheckInAt: checkIn.toISOString(),
            newCheckOutAt: checkOut.toISOString(),
          },
        },
      });

      return updated;
    });
  },
};
