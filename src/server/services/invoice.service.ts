import "server-only";
import { prisma } from "@/server/db";
import { AppError } from "@/lib/errors";
import { Decimal } from "decimal.js";
import { type Actor, settingsService } from "./settings.service";
import { calculateStay } from "@/lib/stay";
import { calculateBill } from "@/lib/billing";
import { amountInWords } from "@/lib/money";
import type {
  CheckoutInput,
  CancelInvoiceInput,
} from "@/features/payments/schemas";
import {
  BookingStatus,
  InvoiceStatus,
  PaymentKind,
  PaymentMode,
  Role,
} from "@prisma/client";

export interface InvoiceSnapshot {
  hotel: {
    name: string;
    address: string;
    phone: string;
    gstin: string;
    invoicePrefix: string;
    invoiceNotes: string;
  };
  invoice: {
    number: number;
    displayNo: string;
    issuedAt: string;
    issuedByName: string;
  };
  booking: {
    id: string;
    reference: string;
    source: string;
    roomNumber: string;
    roomTypeName: string;
    checkInAt: string;
    checkOutAt: string;
    actualCheckInAt: string;
    actualCheckOutAt: string;
    stayDays: number;
    rateApplied: number;
    discount: number;
    gstPercent: number;
    companyName: string | null;
    companyGstin: string | null;
    companyAddress: string | null;
  };
  guests: Array<{
    name: string;
    fatherName: string | null;
    age: number | null;
    sex: string | null;
    mobile: string | null;
    isPrimary: boolean;
  }>;
  charges: Array<{
    description: string;
    amount: number;
    isTaxable: boolean;
  }>;
  payments: Array<{
    kind: string;
    mode: string;
    amount: number;
    note: string | null;
    receivedAt: string;
  }>;
  totals: {
    roomCharges: number;
    taxableChargesTotal: number;
    nonTaxableChargesTotal: number;
    totalCharges: number;
    discount: number;
    taxableAmount: number;
    gstPercent: number;
    cgst: number;
    sgst: number;
    totalGst: number;
    roundOff: number;
    billAmount: number;
    advancePaid: number;
    subsequentPaid: number;
    totalPaid: number;
    refundsTotal: number;
    netPaid: number;
    balanceDue: number;
    amountInWords: string;
  };
}

export const invoiceService = {
  /**
   * Completes guest check-out and issues an immutable Tax Invoice in one atomic DB transaction:
   * 1. Records optional settlement payment if supplied.
   * 2. Recalculates exact stay and GST bill breakdown.
   * 3. Allocates the next gapless invoice number using PostgreSQL row locking (`FOR UPDATE`).
   * 4. Persists the complete immutable InvoiceSnapshot JSON and headline metrics.
   * 5. Updates booking status to CHECKED_OUT and sets actualCheckOutAt.
   * 6. Writes comprehensive audit logs.
   */
  async checkoutAndIssueInvoice(actor: Actor, data: CheckoutInput) {
    const bookingPre = await prisma.booking.findUnique({
      where: { id: data.bookingId },
      include: {
        room: { include: { type: true } },
        guests: true,
        charges: true,
        payments: true,
        invoice: true,
      },
    });

    if (!bookingPre) {
      throw new AppError(
        "BOOKING_NOT_FOUND",
        "The requested booking does not exist."
      );
    }

    if (bookingPre.status === BookingStatus.CHECKED_OUT && bookingPre.invoice) {
      throw new AppError(
        "INVOICE_ALREADY_ISSUED",
        `Booking ${bookingPre.reference} is already checked out (Invoice ${bookingPre.invoice.displayNo}).`
      );
    }

    if (bookingPre.status === BookingStatus.CANCELLED) {
      throw new AppError(
        "VALIDATION_ERROR",
        "Cannot check out a cancelled reservation."
      );
    }

    const settings = await settingsService.getSettings();
    const gstSlabs = settings.gstSlabs;

    const actualCheckIn = bookingPre.actualCheckInAt || bookingPre.checkInAt;
    const actualCheckOut = new Date();

    // Check if the guest has overstayed beyond the scheduled check-out time or requested early departure.
    // If early checkout is requested or overstaying, the stay extends up to actual departure time.
    // Otherwise, the billable stay corresponds to the scheduled booking reservation.
    const isOverstay = actualCheckOut > bookingPre.checkOutAt;
    const isEarly = Boolean(data.isEarlyCheckout);
    const effectiveCheckIn = (isOverstay || isEarly) ? actualCheckIn : bookingPre.checkInAt;
    const effectiveCheckOut = (isOverstay || isEarly) ? actualCheckOut : bookingPre.checkOutAt;

    const stay = calculateStay(
      effectiveCheckIn,
      effectiveCheckOut,
      settings.hotel.graceMinutes
    );

    // Prepare payments list including optional final settlement payment or refund
    const paymentItems = bookingPre.payments.map((p) => ({
      amount: p.amount,
      kind: p.kind as "ADVANCE" | "PAYMENT" | "REFUND",
    }));

    if (data.refundAmount && data.refundAmount > 0) {
      if (!data.refundMode) {
        throw new AppError(
          "VALIDATION_ERROR",
          "Refund mode is required when issuing an early check-out refund."
        );
      }
      paymentItems.push({
        amount: new Decimal(data.refundAmount),
        kind: "REFUND",
      });
    }

    if (data.paymentAmount && data.paymentAmount > 0) {
      if (!data.paymentMode) {
        throw new AppError(
          "VALIDATION_ERROR",
          "Payment mode is required when recording a checkout payment."
        );
      }
      paymentItems.push({
        amount: new Decimal(data.paymentAmount),
        kind: "PAYMENT",
      });
    }

    const calculation = calculateBill({
      rateApplied: bookingPre.rateApplied,
      days: stay.days,
      discount: bookingPre.discount,
      gstPercentOverride: bookingPre.gstPercentOverride,
      charges: bookingPre.charges.map((c) => ({
        amount: c.amount,
        isTaxable: c.isTaxable,
        description: c.description,
      })),
      payments: paymentItems,
      gstSlabs: gstSlabs.map((s) => ({
        minRate: s.minRate,
        maxRate: s.maxRate,
        percent: s.percent,
        isActive: s.isActive,
      })),
      roundBillToRupee: settings.hotel.roundBillToRupee,
      gstOnOtherCharges: settings.hotel.gstOnOtherCharges,
    });

    if (
      calculation.balanceDue.greaterThan(0) &&
      !data.allowZeroPaymentWithBalance
    ) {
      throw new AppError(
        "VALIDATION_ERROR",
        `Balance of ₹${calculation.balanceDue.toString()} is due. Please settle the payment or confirm checkout with pending balance.`
      );
    }

    if (data.paymentAmount && data.paymentAmount > 0) {
      const priorBalance = calculation.balanceDue.plus(data.paymentAmount);
      if (new Decimal(data.paymentAmount).greaterThan(priorBalance)) {
        throw new AppError(
          "VALIDATION_ERROR",
          `Payment amount exceeds remaining balance due. Maximum allowed payment is ₹${priorBalance.toString()}.`
        );
      }
    }

    const finalCompanyName =
      data.companyName !== undefined
        ? data.companyName.trim() || null
        : bookingPre.companyName;
    const finalCompanyGstin =
      data.companyGstin !== undefined
        ? data.companyGstin.trim().toUpperCase() || null
        : bookingPre.companyGstin;
    const finalCompanyAddress =
      data.companyAddress !== undefined
        ? data.companyAddress.trim() || null
        : bookingPre.companyAddress;

    return await prisma.$transaction(async (tx) => {
      // 1. Record final settlement payment or refund in DB if provided
      let finalPaymentId: string | null = null;
      if (data.paymentAmount && data.paymentAmount > 0 && data.paymentMode) {
        const finalPmt = await tx.payment.create({
          data: {
            bookingId: bookingPre.id,
            kind: PaymentKind.PAYMENT,
            mode: data.paymentMode as PaymentMode,
            amount: new Decimal(data.paymentAmount),
            note: data.paymentNote?.trim() || "Settlement on check-out",
            createdById: actor.id,
          },
        });
        finalPaymentId = finalPmt.id;
      }

      if (data.refundAmount && data.refundAmount > 0 && data.refundMode) {
        await tx.payment.create({
          data: {
            bookingId: bookingPre.id,
            kind: PaymentKind.REFUND,
            mode: data.refundMode as PaymentMode,
            amount: new Decimal(data.refundAmount),
            note: data.refundNote?.trim() || "Early check-out refund",
            createdById: actor.id,
          },
        });
      }

      // 2. Gapless Sequential Number allocation with PostgreSQL row lock
      const seqRows = await tx.$queryRaw<Array<{ nextNo: number }>>`
        SELECT "nextNo" FROM "InvoiceSequence" WHERE id = 1 FOR UPDATE
      `;
      const nextNo = seqRows[0]?.nextNo ?? 1001;

      await tx.$executeRaw`
        UPDATE "InvoiceSequence" SET "nextNo" = "nextNo" + 1 WHERE id = 1
      `;

      const prefix = settings.hotel.invoicePrefix?.trim() || "INV-";
      const displayNo = `${prefix}${String(nextNo).padStart(4, "0")}`;

      // Refetch all payments including the newly added one
      const allPayments = await tx.payment.findMany({
        where: { bookingId: bookingPre.id },
        orderBy: { receivedAt: "asc" },
      });

      const words = amountInWords(calculation.billAmount);

      // 3. Build full immutable snapshot
      const snapshot: InvoiceSnapshot = {
        hotel: {
          name: settings.hotel.name,
          address: settings.hotel.address,
          phone: settings.hotel.phone,
          gstin: settings.hotel.gstin,
          invoicePrefix: settings.hotel.invoicePrefix,
          invoiceNotes: settings.hotel.invoiceNotes,
        },
        invoice: {
          number: nextNo,
          displayNo,
          issuedAt: actualCheckOut.toISOString(),
          issuedByName: actor.name,
        },
        booking: {
          id: bookingPre.id,
          reference: bookingPre.reference,
          source: bookingPre.source,
          roomNumber: bookingPre.room.number,
          roomTypeName: bookingPre.room.type.name,
          checkInAt: bookingPre.checkInAt.toISOString(),
          checkOutAt: bookingPre.checkOutAt.toISOString(),
          actualCheckInAt: actualCheckIn.toISOString(),
          actualCheckOutAt: actualCheckOut.toISOString(),
          stayDays: stay.days,
          rateApplied: Number(bookingPre.rateApplied),
          discount: Number(bookingPre.discount),
          gstPercent: calculation.gstPercent.toNumber(),
          companyName: finalCompanyName,
          companyGstin: finalCompanyGstin,
          companyAddress: finalCompanyAddress,
        },
        guests: bookingPre.guests.map((g) => ({
          name: g.name,
          fatherName: g.fatherName,
          age: g.age,
          sex: g.sex,
          mobile: g.mobile,
          isPrimary: g.isPrimary,
        })),
        charges: bookingPre.charges.map((c) => ({
          description: c.description,
          amount: Number(c.amount),
          isTaxable: c.isTaxable,
        })),
        payments: allPayments.map((p) => ({
          kind: p.kind,
          mode: p.mode,
          amount: Number(p.amount),
          note: p.note,
          receivedAt: p.receivedAt.toISOString(),
        })),
        totals: {
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
          roundOff: calculation.roundOff.toNumber(),
          billAmount: calculation.billAmount.toNumber(),
          advancePaid: calculation.advancePaid.toNumber(),
          subsequentPaid: calculation.subsequentPaid.toNumber(),
          totalPaid: calculation.totalPaid.toNumber(),
          refundsTotal: calculation.refundsTotal.toNumber(),
          netPaid: calculation.netPaid.toNumber(),
          balanceDue: calculation.balanceDue.toNumber(),
          amountInWords: words,
        },
      };

      // 4. Create immutable Invoice record
      const invoice = await tx.invoice.create({
        data: {
          number: nextNo,
          displayNo,
          bookingId: bookingPre.id,
          status: InvoiceStatus.ISSUED,
          issuedAt: actualCheckOut,
          issuedById: actor.id,
          taxableAmount: calculation.taxableAmount,
          cgst: calculation.cgst,
          sgst: calculation.sgst,
          billAmount: calculation.billAmount,
          advancePaid: calculation.advancePaid,
          balance: calculation.balanceDue,
          snapshot: snapshot as unknown as object,
        },
      });

      // 5. Update Booking status to CHECKED_OUT
      await tx.booking.update({
        where: { id: bookingPre.id },
        data: {
          status: BookingStatus.CHECKED_OUT,
          checkOutAt: data.isEarlyCheckout ? actualCheckOut : bookingPre.checkOutAt,
          actualCheckInAt: actualCheckIn,
          actualCheckOutAt: actualCheckOut,
          companyName: finalCompanyName,
          companyGstin: finalCompanyGstin,
          companyAddress: finalCompanyAddress,
        },
      });

      // 6. Record Audit Logs
      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          action: "invoice.issue",
          entity: "Invoice",
          entityId: invoice.id,
          metadata: {
            displayNo,
            bookingRef: bookingPre.reference,
            roomNumber: bookingPre.room.number,
            billAmount: Number(invoice.billAmount),
            balance: Number(invoice.balance),
            finalPaymentId,
          },
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          action: "booking.checkOut",
          entity: "Booking",
          entityId: bookingPre.id,
          metadata: {
            reference: bookingPre.reference,
            roomNumber: bookingPre.room.number,
            invoiceDisplayNo: displayNo,
            actualCheckOutAt: actualCheckOut.toISOString(),
          },
        },
      });

      return {
        success: true,
        invoiceId: invoice.id,
        displayNo: invoice.displayNo,
        billAmount: Number(invoice.billAmount),
        balanceDue: Number(invoice.balance),
        bookingId: bookingPre.id,
      };
    });
  },

  /**
   * Owner-only action to cancel an issued invoice with reason and audit history.
   */
  async cancelInvoice(actor: Actor, data: CancelInvoiceInput) {
    if (actor.role !== Role.OWNER) {
      throw new AppError(
        "FORBIDDEN",
        "Only owners can cancel or correct issued invoices."
      );
    }

    return await prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.findUnique({
        where: { id: data.invoiceId },
        include: { booking: true },
      });

      if (!invoice) {
        throw new AppError("INVOICE_NOT_FOUND", "The invoice was not found.");
      }

      if (invoice.status === InvoiceStatus.CANCELLED) {
        throw new AppError("VALIDATION_ERROR", "Invoice is already cancelled.");
      }

      const updated = await tx.invoice.update({
        where: { id: invoice.id },
        data: { status: InvoiceStatus.CANCELLED },
      });

      await tx.invoiceCorrection.create({
        data: {
          invoiceId: invoice.id,
          action: "CANCEL",
          reason: data.reason.trim(),
          before: invoice.snapshot as object,
          doneById: actor.id,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          action: "invoice.cancel",
          entity: "Invoice",
          entityId: invoice.id,
          metadata: {
            displayNo: invoice.displayNo,
            reason: data.reason,
            bookingRef: invoice.booking.reference,
          },
        },
      });

      return { success: true, invoiceId: updated.id, status: updated.status };
    });
  },

  /**
   * Fetches an invoice with its full snapshot and corrections.
   */
  async getInvoice(invoiceId: string) {
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        booking: {
          include: {
            room: { include: { type: true } },
            guests: true,
          },
        },
        corrections: { orderBy: { doneAt: "desc" } },
      },
    });

    if (!invoice) {
      throw new AppError(
        "INVOICE_NOT_FOUND",
        "The requested invoice does not exist."
      );
    }

    return {
      id: invoice.id,
      number: invoice.number,
      displayNo: invoice.displayNo,
      status: invoice.status,
      issuedAt: invoice.issuedAt,
      issuedById: invoice.issuedById,
      taxableAmount: Number(invoice.taxableAmount),
      cgst: Number(invoice.cgst),
      sgst: Number(invoice.sgst),
      billAmount: Number(invoice.billAmount),
      advancePaid: Number(invoice.advancePaid),
      balance: Number(invoice.balance),
      snapshot: invoice.snapshot as unknown as InvoiceSnapshot,
      corrections: invoice.corrections.map((c) => ({
        id: c.id,
        action: c.action,
        reason: c.reason,
        doneAt: c.doneAt,
      })),
    };
  },

  /**
   * Lists invoices with pagination and search.
   */
  async listInvoices(options?: {
    limit?: number;
    search?: string;
    status?: InvoiceStatus;
  }) {
    const limit = options?.limit ?? 100;
    const where: Record<string, unknown> = {};

    if (options?.status) {
      where.status = options.status;
    }

    if (options?.search?.trim()) {
      const q = options.search.trim();
      where.OR = [
        { displayNo: { contains: q, mode: "insensitive" } },
        { booking: { reference: { contains: q, mode: "insensitive" } } },
        { booking: { room: { number: { contains: q, mode: "insensitive" } } } },
        {
          booking: {
            guests: { some: { name: { contains: q, mode: "insensitive" } } },
          },
        },
      ];
    }

    const [invoices, total] = await Promise.all([
      prisma.invoice.findMany({
        where,
        take: limit,
        orderBy: { issuedAt: "desc" },
        include: {
          booking: {
            include: {
              room: { include: { type: true } },
              guests: { where: { isPrimary: true } },
            },
          },
        },
      }),
      prisma.invoice.count({ where }),
    ]);

    return {
      invoices: invoices.map((inv) => ({
        id: inv.id,
        number: inv.number,
        displayNo: inv.displayNo,
        status: inv.status,
        issuedAt: inv.issuedAt,
        billAmount: Number(inv.billAmount),
        balance: Number(inv.balance),
        bookingId: inv.bookingId,
        bookingRef: inv.booking.reference,
        roomNumber: inv.booking.room.number,
        roomTypeName: inv.booking.room.type.name,
        guestName: inv.booking.guests[0]?.name || "Guest",
      })),
      total,
    };
  },

  /**
   * Lists all payments with booking, guest, and room details.
   */
  async listPayments(options?: {
    limit?: number;
    search?: string;
    kind?: PaymentKind;
    mode?: PaymentMode;
  }) {
    const limit = options?.limit ?? 100;
    const where: Record<string, unknown> = {};

    if (options?.kind) where.kind = options.kind;
    if (options?.mode) where.mode = options.mode;

    if (options?.search?.trim()) {
      const q = options.search.trim();
      where.OR = [
        { booking: { reference: { contains: q, mode: "insensitive" } } },
        { booking: { room: { number: { contains: q, mode: "insensitive" } } } },
        {
          booking: {
            guests: { some: { name: { contains: q, mode: "insensitive" } } },
          },
        },
      ];
    }

    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        take: limit,
        orderBy: { receivedAt: "desc" },
        include: {
          booking: {
            include: {
              room: { include: { type: true } },
              guests: { where: { isPrimary: true } },
              invoice: { select: { id: true, displayNo: true, status: true } },
            },
          },
        },
      }),
      prisma.payment.count({ where }),
    ]);

    return {
      payments: payments.map((p) => ({
        id: p.id,
        kind: p.kind,
        mode: p.mode,
        amount: Number(p.amount),
        note: p.note,
        receivedAt: p.receivedAt,
        bookingId: p.bookingId,
        bookingRef: p.booking.reference,
        roomNumber: p.booking.room.number,
        guestName: p.booking.guests[0]?.name || "Guest",
        invoiceDisplayNo: p.booking.invoice?.displayNo || null,
        invoiceId: p.booking.invoice?.id || null,
      })),
      total,
    };
  },
};
