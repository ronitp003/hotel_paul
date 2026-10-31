import { describe, it, expect } from "vitest";
import { renderToBuffer } from "@react-pdf/renderer";
import { InvoicePdfDocument } from "@/features/invoices/components/invoice-pdf";
import { formatISTDateTime, formatISTDate } from "@/lib/datetime";
import type { InvoiceSnapshot } from "@/server/services/invoice.service";

describe("Invoice PDF Generation", () => {
  const dummySnapshot: InvoiceSnapshot = {
    hotel: {
      name: "Hotel Paul",
      address: "123 Main Street, Kolkata, WB",
      phone: "+91 9876543210",
      gstin: "19ABCDE1234F1Z5",
      invoicePrefix: "HP-",
      invoiceNotes: "Thank you for staying with us.",
    },
    invoice: {
      number: 1001,
      displayNo: "HP-1001",
      issuedAt: "2026-10-31T06:30:00.000Z", // 12:00 PM IST
      issuedByName: "John Staff",
    },
    booking: {
      id: "bkg-123",
      reference: "BK-2026-0001",
      source: "WALK_IN",
      roomNumber: "101",
      roomTypeName: "Deluxe King",
      checkInAt: "2026-10-29T04:30:00.000Z", // 10:00 AM IST
      checkOutAt: "2026-10-31T05:30:00.000Z", // 11:00 AM IST
      actualCheckInAt: "2026-10-29T04:30:00.000Z",
      actualCheckOutAt: "2026-10-31T05:30:00.000Z",
      stayDays: 2,
      rateApplied: 2000,
      discount: 0,
      gstPercent: 5,
      companyName: null,
      companyGstin: null,
      companyAddress: null,
    },
    guests: [
      {
        name: "Arjun Das",
        fatherName: null,
        age: 30,
        sex: "MALE",
        mobile: "9876543210",
        isPrimary: true,
      },
    ],
    charges: [],
    payments: [
      {
        kind: "ADVANCE",
        mode: "UPI",
        amount: 1000,
        note: "Advance payment",
        receivedAt: "2026-10-29T04:30:00.000Z",
      },
      {
        kind: "PAYMENT",
        mode: "CASH",
        amount: 3200,
        note: "Settlement on check-out",
        receivedAt: "2026-10-31T05:30:00.000Z",
      },
    ],
    totals: {
      roomCharges: 4000,
      taxableChargesTotal: 0,
      nonTaxableChargesTotal: 0,
      totalCharges: 4000,
      discount: 0,
      taxableAmount: 4000,
      gstPercent: 5,
      cgst: 100,
      sgst: 100,
      totalGst: 200,
      roundOff: 0,
      billAmount: 4200,
      advancePaid: 1000,
      subsequentPaid: 3200,
      totalPaid: 4200,
      refundsTotal: 0,
      netPaid: 4200,
      balanceDue: 0,
      amountInWords: "Four Thousand Two Hundred Rupees Only",
    },
  };

  it("formats arrival and departure matching formatISTDateTime in Asia/Kolkata", () => {
    const expectedArrival = formatISTDateTime(dummySnapshot.booking.actualCheckInAt);
    const expectedDeparture = formatISTDateTime(dummySnapshot.booking.actualCheckOutAt);

    // 04:30 UTC -> 10:00 AM IST
    expect(expectedArrival).toBe("29 Oct 2026, 10:00 AM");
    // 05:30 UTC -> 11:00 AM IST
    expect(expectedDeparture).toBe("31 Oct 2026, 11:00 AM");
    expect(formatISTDate(dummySnapshot.invoice.issuedAt)).toBe("31 Oct 2026");
  });

  it("renders invoice PDF document without throwing errors", async () => {
    const doc = InvoicePdfDocument({ snapshot: dummySnapshot });
    const buffer = await renderToBuffer(doc);
    expect(buffer).toBeDefined();
    expect(buffer.length).toBeGreaterThan(0);
  });
});
