import { describe, it, expect } from "vitest";
import { getSafeRedirectUrl } from "@/lib/utils";

describe("SEC-03: getSafeRedirectUrl", () => {
  it("allows safe internal relative paths", () => {
    expect(getSafeRedirectUrl("/dashboard")).toBe("/dashboard");
    expect(getSafeRedirectUrl("/bookings")).toBe("/bookings");
    expect(getSafeRedirectUrl("/bookings/new?date=2026-11-02")).toBe(
      "/bookings/new?date=2026-11-02"
    );
    expect(getSafeRedirectUrl("/settings/users")).toBe("/settings/users");
  });

  it("defaults to /dashboard when redirect is empty, null, or undefined", () => {
    expect(getSafeRedirectUrl(null)).toBe("/dashboard");
    expect(getSafeRedirectUrl(undefined)).toBe("/dashboard");
    expect(getSafeRedirectUrl("")).toBe("/dashboard");
    expect(getSafeRedirectUrl("   ")).toBe("/dashboard");
  });

  it("rejects absolute external URLs", () => {
    expect(getSafeRedirectUrl("https://evil.com")).toBe("/dashboard");
    expect(getSafeRedirectUrl("http://evil.com/phishing")).toBe("/dashboard");
    expect(getSafeRedirectUrl("ftp://evil.com")).toBe("/dashboard");
  });

  it("rejects protocol-relative URLs", () => {
    expect(getSafeRedirectUrl("//evil.com")).toBe("/dashboard");
    expect(getSafeRedirectUrl("//evil.com/login")).toBe("/dashboard");
  });

  it("rejects backslash evasion techniques", () => {
    expect(getSafeRedirectUrl("/\\evil.com")).toBe("/dashboard");
    expect(getSafeRedirectUrl("/\\\\evil.com")).toBe("/dashboard");
  });

  it("rejects pseudo-protocol URLs", () => {
    expect(getSafeRedirectUrl("javascript:alert(1)")).toBe("/dashboard");
    expect(getSafeRedirectUrl("data:text/html,<script>alert(1)</script>")).toBe(
      "/dashboard"
    );
  });

  it("rejects URLs containing carriage return or newline characters", () => {
    expect(getSafeRedirectUrl("/dashboard\r\nLocation: https://evil.com")).toBe(
      "/dashboard"
    );
  });
});
