import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, Role, BookingStatus, InvoiceStatus } from "@prisma/client";
import * as sessionModule from "@/server/auth/session";
import { ROLES } from "@/lib/constants";
import { billingService } from "@/server/services/billing.service";
import { invoiceService } from "@/server/services/invoice.service";
import { bookingService } from "@/server/services/booking.service";
import { checkoutAction } from "@/server/actions/invoice.actions";
import { addChargeAction } from "@/server/actions/billing.actions";

const connectionString = process.env.DATABASE_URL_TEST || process.env.DATABASE_URL;

describe("Phase 1.6: Check-out, Payments & GST Billing (Integration)", () => {
  let pool: Pool;
  let prisma: PrismaClient;
  let testTypeId: string;
  let roomId: string;

  const receptionistActor = {
    id: "rec-checkout-test-id",
    name: "Staff Checkout Test",
    email: "checkout-staff@hotelpaul.in",
    role: ROLES.RECEPTIONIST,
    isActive: true,
  };

  const ownerActor = {
    id: "owner-checkout-test-id",
    name: "Owner Checkout Test",
    email: "checkout-owner@hotelpaul.in",
    role: ROLES.OWNER,
    isActive: true,
  };

  beforeAll(async () => {
    if (!connectionString) {
      throw new Error("No database connection string for tests");
    }
    pool = new Pool({ connectionString });
    const adapter = new PrismaPg(pool);
    prisma = new PrismaClient({ adapter });

    // 1. Staff and Owner test users
    const staff = await prisma.user.upsert({
      where: { email: "checkout-staff@hotelpaul.in" },
      update: {},
      create: {
        name: "Checkout Staff",
        email: "checkout-staff@hotelpaul.in",
        role: Role.RECEPTIONIST,
      },
    });
    receptionistActor.id = staff.id;

    const owner = await prisma.user.upsert({
      where: { email: "checkout-owner@hotelpaul.in" },
      update: {},
      create: {
        name: "Checkout Owner",
        email: "checkout-owner@hotelpaul.in",
        role: Role.OWNER,
      },
    });
    ownerActor.id = owner.id;

    // 2. Room Type & Room
    const type = await prisma.roomType.create({
      data: { name: `BillingSuite_${Date.now()}` },
    });
    testTypeId = type.id;

    const room = await prisma.room.create({
      data: {
        number: `301_${Date.now()}`,
        typeId: testTypeId,
        pricePerNight: 2000,
        isActive: true,
      },
    });
    roomId = room.id;
  });

  afterAll(async () => {
    if (prisma) {
      // Clean up test data
      await prisma.invoiceCorrection.deleteMany({
        where: { invoice: { booking: { roomId } } },
      });
      await prisma.invoice.deleteMany({
        where: { booking: { roomId } },
      });
      await prisma.charge.deleteMany({
        where: { booking: { roomId } },
      });
      await prisma.payment.deleteMany({
        where: { booking: { roomId } },
      });
      await prisma.bookingGuest.deleteMany({
        where: { booking: { roomId } },
      });
      await prisma.booking.deleteMany({
        where: { roomId },
      });
      await prisma.room.deleteMany({
        where: { id: roomId },
      });
      if (testTypeId) {
        await prisma.roomType.delete({ where: { id: testTypeId } });
      }
      await prisma.$disconnect();
    }
    if (pool) {
      await pool.end();
    }
  });

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("adds and deletes charges on an active stay and records audit logs", async () => {
    // 1. Create a checked-in booking
    const checkIn = new Date("2026-12-10T10:00:00.000Z");
    const checkOut = new Date("2026-12-12T10:00:00.000Z"); // 2 days

    const booking = await bookingService.createBooking(receptionistActor, {
      roomId,
      checkInAt: checkIn,
      checkOutAt: checkOut,
      action: "CHECK_IN",
      rateApplied: 2000,
      guests: [{ name: "Suresh Roy", mobile: "9876543210", isPrimary: true }],
    });

    // 2. Add taxable charge
    const charge1 = await billingService.addCharge(receptionistActor, {
      bookingId: booking.id,
      description: "Restaurant Dinner",
      amount: 850,
      isTaxable: true,
    });
    expect(charge1.description).toBe("Restaurant Dinner");
    expect(charge1.amount).toBe(850);
    expect(charge1.isTaxable).toBe(true);

    // 3. Add non-taxable charge
    const charge2 = await billingService.addCharge(receptionistActor, {
      bookingId: booking.id,
      description: "Express Laundry",
      amount: 250,
      isTaxable: false,
    });
    expect(charge2.description).toBe("Express Laundry");
    expect(charge2.isTaxable).toBe(false);

    // 4. Verify audit log for charge
    const audit = await prisma.auditLog.findFirst({
      where: { entity: "Charge", entityId: charge1.id, action: "charge.add" },
    });
    expect(audit).not.toBeNull();
    expect(audit?.actorId).toBe(receptionistActor.id);

    // 5. Delete charge2
    const delRes = await billingService.deleteCharge(receptionistActor, charge2.id);
    expect(delRes.success).toBe(true);

    const checkDel = await prisma.charge.findUnique({ where: { id: charge2.id } });
    expect(checkDel).toBeNull();
  });

  it("records stay payments, deposits, and refunds with validation guards", async () => {
    const checkIn = new Date("2026-12-20T10:00:00.000Z");
    const checkOut = new Date("2026-12-21T10:00:00.000Z");

    const booking = await bookingService.createBooking(receptionistActor, {
      roomId,
      checkInAt: checkIn,
      checkOutAt: checkOut,
      action: "CHECK_IN",
      rateApplied: 2000,
      advanceAmount: 1000,
      advanceMode: "UPI",
      guests: [{ name: "Ananya Sen", mobile: "9830098300", isPrimary: true }],
    });

    // 1. Add interim payment
    const payment = await billingService.addPayment(receptionistActor, {
      bookingId: booking.id,
      kind: "PAYMENT",
      mode: "CASH",
      amount: 500,
      note: "Cash payment at reception",
    });
    expect(payment.amount).toBe(500);
    expect(payment.kind).toBe("PAYMENT");
    expect(payment.mode).toBe("CASH");

    // 2. Issue partial refund
    const refund = await billingService.refundPayment(receptionistActor, {
      bookingId: booking.id,
      mode: "CASH",
      amount: 300,
      note: "Security deposit refund",
    });
    expect(refund.amount).toBe(300);
    expect(refund.kind).toBe("REFUND");

    // 3. Attempting refund exceeding net payments (1000 advance + 500 payment - 300 refund = 1200 refundable)
    await expect(
      billingService.refundPayment(receptionistActor, {
        bookingId: booking.id,
        mode: "CASH",
        amount: 2000, // exceeds 1200
      })
    ).rejects.toThrowError(/cannot exceed total net payments/);
  });

  it("computes accurate bill with stay days, taxes, discount, and balance due", async () => {
    const now = new Date();
    const checkIn = now;
    const checkOut = new Date(now.getTime() + 2 * 24 * 3600 * 1000); // 2 days

    const booking = await bookingService.createBooking(receptionistActor, {
      roomId,
      checkInAt: checkIn,
      checkOutAt: checkOut,
      action: "CHECK_IN",
      rateApplied: 2000, // 5% slab
      discount: 200,
      advanceAmount: 1000,
      advanceMode: "UPI",
      guests: [{ name: "Priya Sharma", isPrimary: true }],
    });

    await billingService.addCharge(receptionistActor, {
      bookingId: booking.id,
      description: "Breakfast Buffet",
      amount: 600,
      isTaxable: true,
    });

    const bill = await billingService.getBookingBill(booking.id);

    // Calculation verification:
    // roomCharges = 2000 * 2 = 4000
    // taxableCharges = 600
    // discount = 200
    // taxableAmount = 4000 + 600 - 200 = 4400
    // GST 5% on 4400 = 220 (CGST 110, SGST 110)
    // billAmount = 4400 + 220 = 4620
    // advancePaid = 1000
    // balanceDue = 4620 - 1000 = 3620
    expect(bill.bill.roomCharges).toBe(4000);
    expect(bill.bill.taxableChargesTotal).toBe(600);
    expect(bill.bill.discount).toBe(200);
    expect(bill.bill.taxableAmount).toBe(4400);
    expect(bill.bill.totalGst).toBe(220);
    expect(bill.bill.cgst).toBe(110);
    expect(bill.bill.sgst).toBe(110);
    expect(bill.bill.billAmount).toBe(4620);
    expect(bill.bill.advancePaid).toBe(1000);
    expect(bill.bill.balanceDue).toBe(3620);
  });

  it("checks out stay, issues gapless Tax Invoice, generates immutable snapshot, and marks booking CHECKED_OUT", async () => {
    const checkIn = new Date("2026-12-28T10:00:00.000Z");
    const checkOut = new Date("2026-12-29T10:00:00.000Z"); // 1 day

    const booking = await bookingService.createBooking(receptionistActor, {
      roomId,
      checkInAt: checkIn,
      checkOutAt: checkOut,
      action: "CHECK_IN",
      rateApplied: 2000,
      advanceAmount: 1000,
      advanceMode: "UPI",
      guests: [
        { name: "Rahul Verma", mobile: "9811122233", isPrimary: true },
        { name: "Sneha Verma", isPrimary: false },
      ],
    });

    // Settle the remaining balance (Bill = 2000 + 5% = 2100. Advance = 1000. Balance = 1100)
    const checkoutResult = await invoiceService.checkoutAndIssueInvoice(receptionistActor, {
      bookingId: booking.id,
      paymentAmount: 1100,
      paymentMode: "CASH",
      paymentNote: "Final cash settlement at desk",
    });

    expect(checkoutResult.success).toBe(true);
    expect(checkoutResult.displayNo).toMatch(/^HP-\d+|^INV-\d+/);
    expect(checkoutResult.billAmount).toBe(2100);
    expect(checkoutResult.balanceDue).toBe(0);

    // 1. Verify booking is CHECKED_OUT and has actualCheckOutAt
    const updatedBooking = await prisma.booking.findUnique({
      where: { id: booking.id },
      include: { invoice: true },
    });
    expect(updatedBooking?.status).toBe(BookingStatus.CHECKED_OUT);
    expect(updatedBooking?.actualCheckOutAt).not.toBeNull();
    expect(updatedBooking?.invoice).not.toBeNull();

    // 2. Verify immutable invoice snapshot
    const invoice = await invoiceService.getInvoice(checkoutResult.invoiceId);
    expect(invoice.displayNo).toBe(checkoutResult.displayNo);
    expect(invoice.status).toBe("ISSUED");
    expect(invoice.snapshot.totals.billAmount).toBe(2100);
    expect(invoice.snapshot.totals.advancePaid).toBe(1000);
    expect(invoice.snapshot.totals.subsequentPaid).toBe(1100);
    expect(invoice.snapshot.totals.amountInWords).toContain("Two Thousand One Hundred Rupees Only");
    expect(invoice.snapshot.guests).toHaveLength(2);
    expect(invoice.snapshot.guests[0].name).toBe("Rahul Verma");

    // 3. Verify duplicate checkout is prevented
    await expect(
      invoiceService.checkoutAndIssueInvoice(receptionistActor, {
        bookingId: booking.id,
      })
    ).rejects.toThrowError(/already checked out/);
  });

  it("enforces owner-only permission to cancel an issued invoice with audit trail", async () => {
    const checkIn = new Date("2026-12-30T10:00:00.000Z");
    const checkOut = new Date("2026-12-31T10:00:00.000Z");

    const booking = await bookingService.createBooking(receptionistActor, {
      roomId,
      checkInAt: checkIn,
      checkOutAt: checkOut,
      action: "CHECK_IN",
      rateApplied: 2000,
      advanceAmount: 2100,
      advanceMode: "UPI",
      guests: [{ name: "Tanmoy Das", isPrimary: true }],
    });

    const checkout = await invoiceService.checkoutAndIssueInvoice(receptionistActor, {
      bookingId: booking.id,
    });

    // 1. Receptionist attempting to cancel invoice is rejected
    await expect(
      invoiceService.cancelInvoice(receptionistActor, {
        invoiceId: checkout.invoiceId,
        reason: "Customer dispute regarding tariff",
      })
    ).rejects.toThrowError(/Only owners can cancel/);

    // 2. Owner cancels invoice successfully
    const cancelRes = await invoiceService.cancelInvoice(ownerActor, {
      invoiceId: checkout.invoiceId,
      reason: "Correcting stay dates and reissuing",
    });
    expect(cancelRes.success).toBe(true);
    expect(cancelRes.status).toBe(InvoiceStatus.CANCELLED);

    // 3. Verify InvoiceCorrection record created
    const correction = await prisma.invoiceCorrection.findFirst({
      where: { invoiceId: checkout.invoiceId },
    });
    expect(correction).not.toBeNull();
    expect(correction?.action).toBe("CANCEL");
    expect(correction?.reason).toBe("Correcting stay dates and reissuing");
    expect(correction?.doneById).toBe(ownerActor.id);
  });

  it("executes checkoutAction and addChargeAction successfully with receptionist session", async () => {
    vi.spyOn(sessionModule, "requireSession").mockResolvedValue({
      actor: receptionistActor,
    });

    const checkIn = new Date("2027-01-01T10:00:00.000Z");
    const checkOut = new Date("2027-01-02T10:00:00.000Z");

    const booking = await bookingService.createBooking(receptionistActor, {
      roomId,
      checkInAt: checkIn,
      checkOutAt: checkOut,
      action: "CHECK_IN",
      rateApplied: 2000,
      advanceAmount: 2000,
      advanceMode: "UPI",
      guests: [{ name: "Server Action Guest", isPrimary: true }],
    });

    // Call addChargeAction
    const chargeRes = await addChargeAction({
      bookingId: booking.id,
      description: "Mineral Water Bottle",
      amount: 50,
      isTaxable: false,
    });
    expect(chargeRes.ok).toBe(true);

    // Call checkoutAction with settlement
    const checkoutRes = await checkoutAction({
      bookingId: booking.id,
      paymentAmount: 150, // 2000 tariff + 100 GST (5%) + 50 charge = 2150. Advance = 2000. Balance = 150.
      paymentMode: "CASH",
      paymentNote: "Paid at desk",
    });
    expect(checkoutRes.ok).toBe(true);
    expect(checkoutRes.data?.displayNo).toBeDefined();
  });
});
