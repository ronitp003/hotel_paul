import "server-only";
import { prisma } from "@/server/db";
import { AppError } from "@/lib/errors";
import { Decimal } from "decimal.js";
import { type Actor, settingsService } from "./settings.service";
import { calculateStay } from "@/lib/stay";
import {
  calculateBill,
  findGstSlab,
  validateGstSlabsContinuity,
  type GstSlabLike,
  type BillChargeInput,
  type BillPaymentInput,
  type CalculateBillInput,
  type BillCalculationResult,
} from "@/lib/billing";
import type {
  AddChargeInput,
  AddPaymentInput,
  RefundPaymentInput,
} from "@/features/payments/schemas";
import { BookingStatus, PaymentKind, PaymentMode } from "@prisma/client";

export {
  calculateBill,
  findGstSlab,
  validateGstSlabsContinuity,
  type GstSlabLike,
  type BillChargeInput,
  type BillPaymentInput,
  type CalculateBillInput,
  type BillCalculationResult,
};

export {
  calculateStay,
  doIntervalsOverlap,
  type StayCalculationResult,
} from "@/lib/stay";

export const billingService = {
  /**
   * Adds an additional charge (food, laundry, extra service, etc.) to a booking.
   * Charges cannot be added to cancelled or already checked-out stays.
   */
  async addCharge(actor: Actor, data: AddChargeInput) {
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
          "Cannot add charges to an already checked-out stay."
        );
      }

      if (booking.status === BookingStatus.CANCELLED) {
        throw new AppError(
          "VALIDATION_ERROR",
          "Cannot add charges to a cancelled booking."
        );
      }

      const charge = await tx.charge.create({
        data: {
          bookingId: booking.id,
          description: data.description.trim(),
          amount: new Decimal(data.amount),
          isTaxable: data.isTaxable ?? false,
          createdById: actor.id,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          action: "charge.add",
          entity: "Charge",
          entityId: charge.id,
          metadata: {
            bookingId: booking.id,
            bookingRef: booking.reference,
            roomNumber: booking.room.number,
            description: charge.description,
            amount: Number(charge.amount),
            isTaxable: charge.isTaxable,
          },
        },
      });

      return {
        id: charge.id,
        bookingId: charge.bookingId,
        description: charge.description,
        amount: Number(charge.amount),
        isTaxable: charge.isTaxable,
        createdAt: charge.createdAt,
      };
    });
  },

  /**
   * Deletes an additional charge from a booking.
   */
  async deleteCharge(actor: Actor, chargeId: string) {
    return await prisma.$transaction(async (tx) => {
      const charge = await tx.charge.findUnique({
        where: { id: chargeId },
        include: { booking: { include: { room: true } } },
      });

      if (!charge) {
        throw new AppError(
          "VALIDATION_ERROR",
          "The charge record does not exist."
        );
      }

      if (charge.booking.status === BookingStatus.CHECKED_OUT) {
        throw new AppError(
          "VALIDATION_ERROR",
          "Cannot delete charges from an already checked-out stay."
        );
      }

      await tx.charge.delete({
        where: { id: chargeId },
      });

      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          action: "charge.delete",
          entity: "Charge",
          entityId: chargeId,
          metadata: {
            bookingId: charge.bookingId,
            bookingRef: charge.booking.reference,
            description: charge.description,
            amount: Number(charge.amount),
          },
        },
      });

      return { success: true, chargeId };
    });
  },

  /**
   * Adds a payment (Advance or Stay Payment) to a booking.
   */
  async addPayment(actor: Actor, data: AddPaymentInput) {
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

      if (booking.status === BookingStatus.CANCELLED) {
        throw new AppError(
          "VALIDATION_ERROR",
          "Cannot record payment for a cancelled booking. Use refund if applicable."
        );
      }

      const payment = await tx.payment.create({
        data: {
          bookingId: booking.id,
          kind: data.kind as PaymentKind,
          mode: data.mode as PaymentMode,
          amount: new Decimal(data.amount),
          note: data.note?.trim() || null,
          createdById: actor.id,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          action: "payment.add",
          entity: "Payment",
          entityId: payment.id,
          metadata: {
            bookingId: booking.id,
            bookingRef: booking.reference,
            roomNumber: booking.room.number,
            kind: payment.kind,
            mode: payment.mode,
            amount: Number(payment.amount),
            note: payment.note,
          },
        },
      });

      return {
        id: payment.id,
        bookingId: payment.bookingId,
        kind: payment.kind,
        mode: payment.mode,
        amount: Number(payment.amount),
        note: payment.note,
        receivedAt: payment.receivedAt,
      };
    });
  },

  /**
   * Records a refund payment (e.g. for cancelled bookings or deposit returns).
   */
  async refundPayment(actor: Actor, data: RefundPaymentInput) {
    return await prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findUnique({
        where: { id: data.bookingId },
        include: { room: true, payments: true },
      });

      if (!booking) {
        throw new AppError(
          "BOOKING_NOT_FOUND",
          "The requested booking does not exist."
        );
      }

      const totalPaid = booking.payments
        .filter((p) => p.kind !== PaymentKind.REFUND)
        .reduce((acc, p) => acc.plus(new Decimal(p.amount)), new Decimal(0));

      const totalRefunded = booking.payments
        .filter((p) => p.kind === PaymentKind.REFUND)
        .reduce((acc, p) => acc.plus(new Decimal(p.amount)), new Decimal(0));

      const maxRefundable = totalPaid.minus(totalRefunded);
      const refundAmt = new Decimal(data.amount);

      if (refundAmt.greaterThan(maxRefundable)) {
        throw new AppError(
          "VALIDATION_ERROR",
          `Refund amount (₹${refundAmt.toString()}) cannot exceed total net payments received (₹${maxRefundable.toString()}).`
        );
      }

      const payment = await tx.payment.create({
        data: {
          bookingId: booking.id,
          kind: PaymentKind.REFUND,
          mode: data.mode as PaymentMode,
          amount: refundAmt,
          note: data.note?.trim() || "Refund issued",
          createdById: actor.id,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          action: "payment.refund",
          entity: "Payment",
          entityId: payment.id,
          metadata: {
            bookingId: booking.id,
            bookingRef: booking.reference,
            amount: Number(payment.amount),
            mode: payment.mode,
            note: payment.note,
          },
        },
      });

      return {
        id: payment.id,
        bookingId: payment.bookingId,
        kind: payment.kind,
        mode: payment.mode,
        amount: Number(payment.amount),
        note: payment.note,
        receivedAt: payment.receivedAt,
      };
    });
  },

  /**
   * Retrieves the comprehensive calculated bill for a booking at the current point in time.
   */
  async getBookingBill(
    bookingId: string,
    options?: { isEarlyCheckout?: boolean }
  ) {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        room: { include: { type: true } },
        guests: true,
        charges: { orderBy: { createdAt: "asc" } },
        payments: { orderBy: { receivedAt: "asc" } },
        invoice: true,
      },
    });

    if (!booking) {
      throw new AppError(
        "BOOKING_NOT_FOUND",
        "The requested booking does not exist."
      );
    }

    const settings = await settingsService.getSettings();
    const gstSlabs = settings.gstSlabs;

    // Determine actual or planned stay dates
    const isOverstay =
      booking.status === BookingStatus.CHECKED_IN && new Date() > booking.checkOutAt;
    const isEarly = Boolean(options?.isEarlyCheckout);
    const isCheckedOut =
      booking.status === BookingStatus.CHECKED_OUT && Boolean(booking.actualCheckOutAt);

    const checkIn = isCheckedOut
      ? (booking.actualCheckOutAt && booking.actualCheckOutAt > booking.checkOutAt
          ? (booking.actualCheckInAt || booking.checkInAt)
          : booking.checkInAt)
      : (isOverstay || isEarly)
        ? (booking.actualCheckInAt || booking.checkInAt)
        : booking.checkInAt;

    const checkOut = isCheckedOut
      ? (booking.actualCheckOutAt && booking.actualCheckOutAt > booking.checkOutAt
          ? booking.actualCheckOutAt!
          : booking.checkOutAt)
      : (isOverstay || isEarly)
        ? new Date()
        : booking.checkOutAt;

    const stay = calculateStay(checkIn, checkOut, settings.hotel.graceMinutes);

    const calculation = calculateBill({
      rateApplied: booking.rateApplied,
      days: stay.days,
      discount: booking.discount,
      gstPercentOverride: booking.gstPercentOverride,
      charges: booking.charges.map((c) => ({
        id: c.id,
        description: c.description,
        amount: c.amount,
        isTaxable: c.isTaxable,
      })),
      payments: booking.payments.map((p) => ({
        id: p.id,
        amount: p.amount,
        kind: p.kind as "ADVANCE" | "PAYMENT" | "REFUND",
      })),
      gstSlabs: gstSlabs.map((s) => ({
        id: s.id,
        minRate: s.minRate,
        maxRate: s.maxRate,
        percent: s.percent,
        isActive: s.isActive,
      })),
      roundBillToRupee: settings.hotel.roundBillToRupee,
      gstOnOtherCharges: settings.hotel.gstOnOtherCharges,
    });

    return {
      booking: {
        id: booking.id,
        reference: booking.reference,
        status: booking.status,
        roomNumber: booking.room.number,
        roomTypeName: booking.room.type.name,
        checkInAt: booking.checkInAt,
        checkOutAt: booking.checkOutAt,
        actualCheckInAt: booking.actualCheckInAt,
        actualCheckOutAt: booking.actualCheckOutAt,
        primaryGuest:
          booking.guests.find((g) => g.isPrimary) || booking.guests[0],
        allGuests: booking.guests,
        companyName: booking.companyName,
        companyGstin: booking.companyGstin,
        companyAddress: booking.companyAddress,
        invoice: booking.invoice
          ? {
              id: booking.invoice.id,
              number: booking.invoice.number,
              displayNo: booking.invoice.displayNo,
              status: booking.invoice.status,
              issuedAt: booking.invoice.issuedAt,
            }
          : null,
      },
      stay: {
        days: stay.days,
        hours: stay.hours,
        minutes: stay.minutes,
        graceMinutesApplied: stay.isGracePeriodApplied,
      },
      charges: booking.charges.map((c) => ({
        id: c.id,
        description: c.description,
        amount: Number(c.amount),
        isTaxable: c.isTaxable,
        createdAt: c.createdAt,
      })),
      payments: booking.payments.map((p) => ({
        id: p.id,
        kind: p.kind,
        mode: p.mode,
        amount: Number(p.amount),
        note: p.note,
        receivedAt: p.receivedAt,
      })),
      bill: {
        rateApplied: calculation.rateApplied.toNumber(),
        days: calculation.days,
        roomCharges: calculation.roomCharges.toNumber(),
        taxableChargesTotal: calculation.taxableChargesTotal.toNumber(),
        nonTaxableChargesTotal: calculation.nonTaxableChargesTotal.toNumber(),
        totalCharges: calculation.totalCharges.toNumber(),
        discount: calculation.discount.toNumber(),
        taxableAmount: calculation.taxableAmount.toNumber(),
        gstPercent: calculation.gstPercent.toNumber(),
        cgst: calculation.cgst.toNumber(),
        sgst: calculation.sgst.toNumber(),
        totalGst: calculation.totalGst.toNumber(),
        subtotalWithTax: calculation.subtotalWithTax.toNumber(),
        roundOff: calculation.roundOff.toNumber(),
        billAmount: calculation.billAmount.toNumber(),
        advancePaid: calculation.advancePaid.toNumber(),
        subsequentPaid: calculation.subsequentPaid.toNumber(),
        totalPaid: calculation.totalPaid.toNumber(),
        refundsTotal: calculation.refundsTotal.toNumber(),
        netPaid: calculation.netPaid.toNumber(),
        balanceDue: calculation.balanceDue.toNumber(),
      },
    };
  },
};
