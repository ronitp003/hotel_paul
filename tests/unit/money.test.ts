import { describe, it, expect } from "vitest";
import {
  Decimal,
  toDecimal,
  formatINR,
  formatINRPlain,
  amountInWords,
} from "@/lib/money";

describe("lib/money (Currency and Decimal Handling)", () => {
  it("converts numbers and strings to Decimal without floating point errors", () => {
    const a = toDecimal(0.1);
    const b = toDecimal(0.2);
    // In standard JS number: 0.1 + 0.2 = 0.30000000000000004
    const sum = a.plus(b);
    expect(sum.toString()).toBe("0.3");
  });

  it("formats currency in Indian numbering (INR)", () => {
    const amount = new Decimal("125450.50");
    const formatted = formatINR(amount);
    expect(formatted).toMatch(/1,25,450\.50/);
    expect(formatINRPlain(amount)).toBe("1,25,450.50");
  });

  it("converts zero into words", () => {
    expect(amountInWords(0)).toBe("Zero Rupees Only");
  });

  it("converts single digit and tens into words", () => {
    expect(amountInWords(1)).toBe("One Rupee Only");
    expect(amountInWords(15)).toBe("Fifteen Rupees Only");
    expect(amountInWords(75)).toBe("Seventy-Five Rupees Only");
  });

  it("converts hundreds and thousands into words", () => {
    expect(amountInWords(500)).toBe("Five Hundred Rupees Only");
    expect(amountInWords(2500)).toBe("Two Thousand Five Hundred Rupees Only");
    expect(amountInWords(7500)).toBe("Seven Thousand Five Hundred Rupees Only");
  });

  it("converts Lakhs into words accurately", () => {
    expect(amountInWords(100000)).toBe("One Lakh Rupees Only");
    expect(amountInWords(154250)).toBe(
      "One Lakh Fifty-Four Thousand Two Hundred and Fifty Rupees Only"
    );
  });

  it("converts Paise accurately", () => {
    expect(amountInWords("150.50")).toBe(
      "One Hundred and Fifty Rupees and Fifty Paise Only"
    );
    expect(amountInWords("0.75")).toBe("Seventy-Five Paise Only");
  });
});
