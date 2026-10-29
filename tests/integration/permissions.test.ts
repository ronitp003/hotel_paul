import { describe, it, expect, vi } from "vitest";
import { can, requireRole, requirePermission } from "@/server/auth/permissions";
import { ROLES } from "@/lib/constants";
import { AppError } from "@/lib/errors";
import * as sessionModule from "@/server/auth/session";

describe("server/auth/permissions (Role-Based Access Control)", () => {
  it("allows OWNER to perform all owner-only actions", () => {
    expect(can(ROLES.OWNER, "users.create")).toBe(true);
    expect(can(ROLES.OWNER, "users.deactivate")).toBe(true);
    expect(can(ROLES.OWNER, "settings.update")).toBe(true);
    expect(can(ROLES.OWNER, "invoice.cancel")).toBe(true);
    expect(can(ROLES.OWNER, "data.export")).toBe(true);
    expect(can(ROLES.OWNER, "booking.checkIn")).toBe(true);
  });

  it("strictly forbids RECEPTIONIST from performing owner-only actions", () => {
    expect(can(ROLES.RECEPTIONIST, "users.create")).toBe(false);
    expect(can(ROLES.RECEPTIONIST, "users.deactivate")).toBe(false);
    expect(can(ROLES.RECEPTIONIST, "settings.update")).toBe(false);
    expect(can(ROLES.RECEPTIONIST, "invoice.cancel")).toBe(false);
    expect(can(ROLES.RECEPTIONIST, "invoice.correct")).toBe(false);
    expect(can(ROLES.RECEPTIONIST, "room.create")).toBe(false);
    expect(can(ROLES.RECEPTIONIST, "data.import")).toBe(false);
  });

  it("allows RECEPTIONIST to perform standard front-desk operations", () => {
    expect(can(ROLES.RECEPTIONIST, "booking.create")).toBe(true);
    expect(can(ROLES.RECEPTIONIST, "booking.checkIn")).toBe(true);
    expect(can(ROLES.RECEPTIONIST, "booking.checkOut")).toBe(true);
    expect(can(ROLES.RECEPTIONIST, "payment.add")).toBe(true);
    expect(can(ROLES.RECEPTIONIST, "invoice.view")).toBe(true);
    expect(can(ROLES.RECEPTIONIST, "room.problem")).toBe(true);
    expect(can(ROLES.RECEPTIONIST, "inventory.move")).toBe(true);
  });

  it("rejects unauthenticated requests in requireRole", async () => {
    vi.spyOn(sessionModule, "requireSession").mockRejectedValueOnce(
      new AppError("UNAUTHORIZED", "You must be logged in to perform this action")
    );

    await expect(requireRole([ROLES.OWNER])).rejects.toThrowError("You must be logged in");
  });

  it("blocks RECEPTIONIST when requireRole requires OWNER", async () => {
    vi.spyOn(sessionModule, "requireSession").mockResolvedValueOnce({
      actor: {
        id: "receptionist-1",
        name: "Staff",
        email: "staff@hotelpaul.in",
        role: ROLES.RECEPTIONIST,
        isActive: true,
      },
    });

    await expect(requireRole([ROLES.OWNER])).rejects.toThrowError(/Access denied.*Required role: OWNER/);
  });

  it("succeeds when actor role matches allowed roles", async () => {
    vi.spyOn(sessionModule, "requireSession").mockResolvedValueOnce({
      actor: {
        id: "owner-1",
        name: "Owner",
        email: "owner@hotelpaul.in",
        role: ROLES.OWNER,
        isActive: true,
      },
    });

    const actor = await requireRole([ROLES.OWNER]);
    expect(actor.role).toBe(ROLES.OWNER);
  });

  it("enforces requirePermission strictly", async () => {
    vi.spyOn(sessionModule, "requireSession").mockResolvedValueOnce({
      actor: {
        id: "receptionist-2",
        name: "Staff 2",
        email: "staff2@hotelpaul.in",
        role: ROLES.RECEPTIONIST,
        isActive: true,
      },
    });

    await expect(requirePermission("users.create")).rejects.toThrowError(/Access denied/);
  });
});
