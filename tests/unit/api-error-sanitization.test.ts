import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET as calendarGet } from "@/app/api/calendar/route";
import { POST as restorePost } from "@/app/api/backup/restore/route";
import { calendarService } from "@/server/services/calendar.service";
import { backupService } from "@/server/services/backup.service";
import * as permissions from "@/server/auth/permissions";
import { AppError } from "@/lib/errors";
import type { Actor } from "@/server/auth/session";

const mockActor: Actor = {
  id: "user-1",
  name: "Owner User",
  email: "owner@hotelpaul.in",
  role: "OWNER",
  isActive: true,
};

vi.mock("@/server/auth/permissions", () => ({
  requireRole: vi.fn(),
}));

vi.mock("@/server/services/calendar.service", () => ({
  calendarService: {
    getTimelineData: vi.fn(),
  },
}));

vi.mock("@/server/services/backup.service", () => ({
  backupService: {
    executeBackupImport: vi.fn(),
  },
}));

describe("API Error Sanitization (SEC-06)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Calendar Route (GET /api/calendar)", () => {
    it("sanitizes unhandled database or system errors to generic 500 message", async () => {
      vi.mocked(permissions.requireRole).mockResolvedValue(mockActor);
      vi.mocked(calendarService.getTimelineData).mockRejectedValue(
        new Error('FATAL: relation "Booking" does not exist at postgres_neon_cluster:5432')
      );

      const req = new NextRequest(
        "http://localhost:3000/api/calendar?start=2026-11-01T00:00:00.000Z&end=2026-11-07T00:00:00.000Z"
      );

      const res = await calendarGet(req);
      expect(res.status).toBe(500);

      const json = await res.json();
      expect(json.ok).toBe(false);
      expect(json.error).toBe("Internal server error");
      expect(json.error).not.toContain("FATAL");
      expect(json.error).not.toContain("Booking");
      expect(json.error).not.toContain("postgres");
    });

    it("preserves AppError domain error responses and status codes", async () => {
      vi.mocked(permissions.requireRole).mockRejectedValue(
        new AppError("FORBIDDEN", "Forbidden: Insufficient permissions")
      );

      const req = new NextRequest(
        "http://localhost:3000/api/calendar?start=2026-11-01T00:00:00.000Z&end=2026-11-07T00:00:00.000Z"
      );

      const res = await calendarGet(req);
      expect(res.status).toBe(403);

      const json = await res.json();
      expect(json.ok).toBe(false);
      expect(json.code).toBe("FORBIDDEN");
      expect(json.error).toBe("Forbidden: Insufficient permissions");
    });
  });

  describe("Backup Restore Route (POST /api/backup/restore)", () => {
    it("sanitizes unhandled database or system errors during restore", async () => {
      vi.mocked(permissions.requireRole).mockResolvedValue(mockActor);
      vi.mocked(backupService.executeBackupImport).mockRejectedValue(
        new Error("Connection terminated unexpectedly: error while restoring HotelSettings table")
      );

      const req = new NextRequest("http://localhost:3000/api/backup/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          backupData: { version: 1 },
          confirmed: true,
        }),
      });

      const res = await restorePost(req);
      expect(res.status).toBe(500);

      const json = await res.json();
      expect(json.ok).toBe(false);
      expect(json.error).toBe("Internal server error during backup restore");
      expect(json.error).not.toContain("HotelSettings");
      expect(json.error).not.toContain("Connection terminated");
    });

    it("preserves AppError validation responses during restore", async () => {
      vi.mocked(permissions.requireRole).mockResolvedValue(mockActor);
      vi.mocked(backupService.executeBackupImport).mockRejectedValue(
        new AppError("VALIDATION_ERROR", "Unsupported backup schema version 99")
      );

      const req = new NextRequest("http://localhost:3000/api/backup/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          backupData: { version: 99 },
          confirmed: true,
        }),
      });

      const res = await restorePost(req);
      expect(res.status).toBe(400);

      const json = await res.json();
      expect(json.ok).toBe(false);
      expect(json.code).toBe("VALIDATION_ERROR");
      expect(json.error).toBe("Unsupported backup schema version 99");
    });
  });
});
