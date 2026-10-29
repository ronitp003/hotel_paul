import { describe, it, expect } from "vitest";
import {
  findGstSlab,
  validateGstSlabsContinuity,
  calculateBill,
} from "@/lib/billing";

describe("billing.service - findGstSlab & validateGstSlabsContinuity", () => {
  const standardSlabs = [
    {
      id: "slab-5",
      minRate: 0,
      maxRate: 7500,
      percent: 5,
      isActive: true,
    },
    {
      id: "slab-18",
      minRate: 7500,
      maxRate: null,
      percent: 18,
      isActive: true,
    },
  ];

  it("matches rate = 0 to 5% slab (boundary: 0 inclusive)", () => {
    const match = findGstSlab(standardSlabs, 0);
    expect(match?.id).toBe("slab-5");
    expect(Number(match?.percent)).toBe(5);
  });

  it("matches rate = 1 to 5% slab", () => {
    const match = findGstSlab(standardSlabs, 1);
    expect(match?.id).toBe("slab-5");
    expect(Number(match?.percent)).toBe(5);
  });

  it("matches rate = 7499.99 to 5% slab", () => {
    const match = findGstSlab(standardSlabs, 7499.99);
    expect(match?.id).toBe("slab-5");
    expect(Number(match?.percent)).toBe(5);
  });

  it("matches rate = 7500 to 5% slab (boundary: 7500.00 gets 5%)", () => {
    const match = findGstSlab(standardSlabs, 7500);
    expect(match?.id).toBe("slab-5");
    expect(Number(match?.percent)).toBe(5);
  });

  it("matches rate = 7500.01 to 18% slab (boundary: 7500.01 gets 18%)", () => {
    const match = findGstSlab(standardSlabs, 7500.01);
    expect(match?.id).toBe("slab-18");
    expect(Number(match?.percent)).toBe(18);
  });

  it("matches rate = 7500.50 to 18% slab", () => {
    const match = findGstSlab(standardSlabs, 7500.5);
    expect(match?.id).toBe("slab-18");
    expect(Number(match?.percent)).toBe(18);
  });

  it("matches rate = 10000 to 18% slab", () => {
    const match = findGstSlab(standardSlabs, 10000);
    expect(match?.id).toBe("slab-18");
    expect(Number(match?.percent)).toBe(18);
  });

  it("returns null for no match when rate is negative", () => {
    const match = findGstSlab(standardSlabs, -100);
    expect(match).toBeNull();
  });

  it("returns null for no match when rate exceeds bounded slabs", () => {
    const boundedSlabs = [
      {
        id: "slab-only-5",
        minRate: 0,
        maxRate: 5000,
        percent: 5,
        isActive: true,
      },
    ];
    const match = findGstSlab(boundedSlabs, 6000);
    expect(match).toBeNull();
  });

  it("ignores inactive slabs", () => {
    const withInactive = [
      {
        id: "inactive-slab",
        minRate: 0,
        maxRate: 5000,
        percent: 0,
        isActive: false,
      },
      ...standardSlabs,
    ];
    const match = findGstSlab(withInactive, 1000);
    expect(match?.id).toBe("slab-5");
  });

  describe("validateGstSlabsContinuity", () => {
    it("accepts valid continuous slabs", () => {
      expect(() => validateGstSlabsContinuity(standardSlabs)).not.toThrow();
    });

    it("rejects slabs not starting at 0", () => {
      const invalid = [
        { minRate: 500, maxRate: null, percent: 12, isActive: true },
      ];
      expect(() => validateGstSlabsContinuity(invalid)).toThrowError(
        /must start at ₹0/
      );
    });

    it("rejects overlapping slabs", () => {
      const overlapping = [
        { minRate: 0, maxRate: 5000, percent: 5, isActive: true },
        { minRate: 4000, maxRate: null, percent: 18, isActive: true },
      ];
      expect(() => validateGstSlabsContinuity(overlapping)).toThrowError(
        /Overlapping GST slabs/
      );
    });

    it("rejects gapped slabs", () => {
      const gapped = [
        { minRate: 0, maxRate: 5000, percent: 5, isActive: true },
        { minRate: 6000, maxRate: null, percent: 18, isActive: true },
      ];
      expect(() => validateGstSlabsContinuity(gapped)).toThrowError(
        /Gap detected in GST slabs/
      );
    });

    it("rejects open-ended slab that is not the highest", () => {
      const invalid = [
        { minRate: 0, maxRate: null, percent: 5, isActive: true },
        { minRate: 5000, maxRate: 10000, percent: 18, isActive: true },
      ];
      expect(() => validateGstSlabsContinuity(invalid)).toThrowError(
        /Only the highest GST slab can be open-ended/
      );
    });
  });

  describe("calculateBill", () => {
    it("calculates simple stay with room charges and 5% GST slab", () => {
      const result = calculateBill({
        rateApplied: 2000,
        days: 2,
        gstSlabs: standardSlabs,
      });

      expect(result.roomCharges.toNumber()).toBe(4000);
      expect(result.taxableAmount.toNumber()).toBe(4000);
      expect(result.gstPercent.toNumber()).toBe(5);
      expect(result.totalGst.toNumber()).toBe(200);
      expect(result.cgst.toNumber()).toBe(100);
      expect(result.sgst.toNumber()).toBe(100);
      expect(result.billAmount.toNumber()).toBe(4200);
      expect(result.balanceDue.toNumber()).toBe(4200);
    });

    it("calculates stay matching 18% GST slab for rates > 7500", () => {
      const result = calculateBill({
        rateApplied: 8000,
        days: 1,
        gstSlabs: standardSlabs,
      });

      expect(result.roomCharges.toNumber()).toBe(8000);
      expect(result.gstPercent.toNumber()).toBe(18);
      expect(result.totalGst.toNumber()).toBe(1440);
      expect(result.cgst.toNumber()).toBe(720);
      expect(result.sgst.toNumber()).toBe(720);
      expect(result.billAmount.toNumber()).toBe(9440);
    });

    it("respects gstPercentOverride when provided", () => {
      const result = calculateBill({
        rateApplied: 2000,
        days: 1,
        gstPercentOverride: 12,
        gstSlabs: standardSlabs,
      });

      expect(result.gstPercent.toNumber()).toBe(12);
      expect(result.totalGst.toNumber()).toBe(240);
      expect(result.cgst.toNumber()).toBe(120);
      expect(result.sgst.toNumber()).toBe(120);
      expect(result.billAmount.toNumber()).toBe(2240);
    });

    it("applies discounts and handles taxable vs non-taxable charges", () => {
      const result = calculateBill({
        rateApplied: 3000,
        days: 2, // 6000
        discount: 500, // 5500 taxable before charges
        charges: [
          { description: "Restaurant Dinner", amount: 1000, isTaxable: true }, // 1000 taxable
          { description: "Laundry", amount: 300, isTaxable: false }, // 300 non-taxable
        ],
        gstSlabs: standardSlabs, // 5% slab for 3000
      });

      // roomCharges = 6000
      // taxableCharges = 1000
      // discount = 500
      // taxableAmount = 6000 + 1000 - 500 = 6500
      // GST 5% on 6500 = 325 (CGST = 162.50, SGST = 162.50)
      // subtotalWithTax = 6500 + 300 (non-taxable) + 325 = 7125
      expect(result.roomCharges.toNumber()).toBe(6000);
      expect(result.taxableChargesTotal.toNumber()).toBe(1000);
      expect(result.nonTaxableChargesTotal.toNumber()).toBe(300);
      expect(result.taxableAmount.toNumber()).toBe(6500);
      expect(result.totalGst.toNumber()).toBe(325);
      expect(result.cgst.toNumber()).toBe(162.5);
      expect(result.sgst.toNumber()).toBe(162.5);
      expect(result.billAmount.toNumber()).toBe(7125);
    });

    it("correctly rounds bill when roundBillToRupee is enabled", () => {
      const result = calculateBill({
        rateApplied: 2505,
        days: 1,
        gstPercentOverride: 5,
        roundBillToRupee: true,
        gstSlabs: standardSlabs,
      });

      // 2505 * 0.05 = 125.25 tax
      // subtotalWithTax = 2505 + 125.25 = 2630.25
      // roundBillToRupee -> 2630.00
      // roundOff -> -0.25
      expect(result.totalGst.toNumber()).toBe(125.25);
      expect(result.billAmount.toNumber()).toBe(2630);
      expect(result.roundOff.toNumber()).toBe(-0.25);
    });

    it("calculates payments, advances, and balance due", () => {
      const result = calculateBill({
        rateApplied: 3000,
        days: 1,
        gstSlabs: standardSlabs, // 5% -> bill = 3150
        payments: [
          { amount: 1000, kind: "ADVANCE" },
          { amount: 1500, kind: "PAYMENT" },
          { amount: 200, kind: "REFUND" },
        ],
      });

      expect(result.billAmount.toNumber()).toBe(3150);
      expect(result.advancePaid.toNumber()).toBe(1000);
      expect(result.subsequentPaid.toNumber()).toBe(1500);
      expect(result.refundsTotal.toNumber()).toBe(200);
      expect(result.totalPaid.toNumber()).toBe(2500);
      expect(result.netPaid.toNumber()).toBe(2300);
      expect(result.balanceDue.toNumber()).toBe(850);
    });
  });
});
