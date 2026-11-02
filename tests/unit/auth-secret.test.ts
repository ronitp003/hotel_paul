import { describe, it, expect } from "vitest";
import { resolveAuthSecret } from "@/server/auth/auth";

describe("SEC-02: resolveAuthSecret", () => {
  it("returns the configured secret when set in production", () => {
    const secret = resolveAuthSecret({
      BETTER_AUTH_SECRET: "custom-production-secret-with-at-least-32-chars",
      NODE_ENV: "production",
    });
    expect(secret).toBe("custom-production-secret-with-at-least-32-chars");
  });

  it("throws a fatal error in production when BETTER_AUTH_SECRET is missing", () => {
    expect(() =>
      resolveAuthSecret({
        BETTER_AUTH_SECRET: undefined,
        NODE_ENV: "production",
      })
    ).toThrowError(/strictly required in production runtime/);
  });

  it("throws a fatal error in production when BETTER_AUTH_SECRET uses the default fallback string", () => {
    expect(() =>
      resolveAuthSecret({
        BETTER_AUTH_SECRET: "default-secret-for-development-min-32-chars",
        NODE_ENV: "production",
      })
    ).toThrowError(/must not use the default development secret in production/);
  });

  it("allows the default secret in development mode", () => {
    const secret = resolveAuthSecret({
      BETTER_AUTH_SECRET: undefined,
      NODE_ENV: "development",
    });
    expect(secret).toBe("default-secret-for-development-min-32-chars");
  });

  it("allows the default secret in test mode", () => {
    const secret = resolveAuthSecret({
      BETTER_AUTH_SECRET: undefined,
      NODE_ENV: "test",
    });
    expect(secret).toBe("default-secret-for-development-min-32-chars");
  });

  it("permits build phase evaluation without secret", () => {
    const secret = resolveAuthSecret({
      BETTER_AUTH_SECRET: undefined,
      NODE_ENV: "production",
      NEXT_PHASE: "phase-production-build",
    });
    expect(secret).toBe("default-secret-for-development-min-32-chars");
  });
});
