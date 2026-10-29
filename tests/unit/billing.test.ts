import { describe, it, expect } from "vitest";
import { findGstSlab, validateGstSlabsContinuity } from "@/server/services/billing.service";

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
});
