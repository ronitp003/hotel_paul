import { describe, it, expect } from "vitest";
import nextConfig from "../../next.config";

describe("Security Headers Configuration (SEC-05)", () => {
  it("defines HTTP security headers for all routes (/:path*)", async () => {
    expect(nextConfig.headers).toBeDefined();
    if (!nextConfig.headers) return;

    const routeHeaders = await nextConfig.headers();
    expect(routeHeaders).toBeInstanceOf(Array);

    const catchAllRule = routeHeaders.find((r) => r.source === "/:path*");
    expect(catchAllRule).toBeDefined();

    const headersMap = new Map(catchAllRule?.headers.map((h) => [h.key, h.value]));

    // Clickjacking defense
    expect(headersMap.get("X-Frame-Options")).toBe("DENY");
    expect(headersMap.get("Content-Security-Policy")).toContain("frame-ancestors 'none'");

    // MIME sniffing defense
    expect(headersMap.get("X-Content-Type-Options")).toBe("nosniff");

    // Referrer policy
    expect(headersMap.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");

    // Permissions policy
    expect(headersMap.get("Permissions-Policy")).toBe("camera=(), microphone=(), geolocation=()");

    // HSTS
    expect(headersMap.get("Strict-Transport-Security")).toContain("max-age=63072000");
  });
});
