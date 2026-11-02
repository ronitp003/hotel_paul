import { describe, it, expect } from "vitest";
import { escapeCsv } from "@/server/services/backup.service";

describe("SEC-04: escapeCsv", () => {
  it("neutralizes formula triggers (=, +, -, @, \\t, \\r) by prepending a single quote", () => {
    expect(escapeCsv("=cmd|' /C calc'!A0")).toBe("'=cmd|' /C calc'!A0");
    expect(escapeCsv("+91 98765 43210")).toBe("'+91 98765 43210");
    expect(escapeCsv("-10% Discount")).toBe("'-10% Discount");
    expect(escapeCsv("@SUM(A1:A10)")).toBe("'@SUM(A1:A10)");
    expect(escapeCsv("\tTabPrefixed")).toBe("'\tTabPrefixed");
  });

  it("escapes quotes, commas, and newlines per RFC 4180", () => {
    expect(escapeCsv('John "The Boss" Doe')).toBe('"John ""The Boss"" Doe"');
    expect(escapeCsv("Suite 101, Ground Floor")).toBe(
      '"Suite 101, Ground Floor"'
    );
    expect(escapeCsv("Line1\nLine2")).toBe('"Line1\nLine2"');
  });

  it("handles both formula trigger and quotes/commas simultaneously", () => {
    expect(escapeCsv('=HYPERLINK("http://evil.com", "Click")')).toBe(
      '"\'=HYPERLINK(""http://evil.com"", ""Click"")"'
    );
  });

  it("passes safe plain text and numbers without modification", () => {
    expect(escapeCsv("Suresh Roy")).toBe("Suresh Roy");
    expect(escapeCsv(2500)).toBe("2500");
    expect(escapeCsv(0)).toBe("0");
    expect(escapeCsv("")).toBe("");
    expect(escapeCsv(null)).toBe("");
    expect(escapeCsv(undefined)).toBe("");
  });
});
