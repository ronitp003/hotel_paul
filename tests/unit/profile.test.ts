import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  updateProfileSchema,
  changePasswordSchema,
} from "@/features/users/schemas";
import {
  updateProfileAction,
  changePasswordAction,
} from "@/server/actions/user.actions";
import { userService } from "@/server/services/user.service";
import * as sessionModule from "@/server/auth/session";
import { AppError } from "@/lib/errors";

vi.mock("@/server/services/user.service", () => ({
  userService: {
    createStaff: vi.fn(),
    toggleStaffActive: vi.fn(),
    resetPassword: vi.fn(),
    updateProfile: vi.fn(),
    changePassword: vi.fn(),
  },
}));

vi.mock("@/server/auth/session", () => ({
  requireSession: vi.fn(),
  getSession: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

describe("Profile Feature (SEC & UX)", () => {
  const mockActor = {
    id: "user-123",
    name: "Soyab Staff",
    email: "staff@hotelpaul.in",
    role: "RECEPTIONIST" as const,
    isActive: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("updateProfileSchema", () => {
    it("validates and trims valid display names", () => {
      const parsed = updateProfileSchema.safeParse({ name: "  Soyab Aktar  " });
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.name).toBe("Soyab Aktar");
      }
    });

    it("rejects names shorter than 2 characters", () => {
      const parsed = updateProfileSchema.safeParse({ name: "A" });
      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        expect(parsed.error.issues[0]?.message).toContain("at least 2 characters");
      }
    });

    it("rejects names exceeding 60 characters", () => {
      const parsed = updateProfileSchema.safeParse({ name: "A".repeat(61) });
      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        expect(parsed.error.issues[0]?.message).toContain("under 60 characters");
      }
    });
  });

  describe("changePasswordSchema", () => {
    it("validates matching new passwords of 8+ characters", () => {
      const parsed = changePasswordSchema.safeParse({
        currentPassword: "OldPassword123!",
        newPassword: "NewSecurePassword2026",
        confirmPassword: "NewSecurePassword2026",
      });
      expect(parsed.success).toBe(true);
    });

    it("rejects passwords shorter than 8 characters", () => {
      const parsed = changePasswordSchema.safeParse({
        currentPassword: "OldPassword123!",
        newPassword: "short",
        confirmPassword: "short",
      });
      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        expect(parsed.error.issues[0]?.message).toContain("at least 8 characters");
      }
    });

    it("rejects when new password and confirm password do not match", () => {
      const parsed = changePasswordSchema.safeParse({
        currentPassword: "OldPassword123!",
        newPassword: "Password12345",
        confirmPassword: "PasswordMismatched",
      });
      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        expect(parsed.error.issues[0]?.message).toContain("do not match");
      }
    });
  });

  describe("updateProfileAction", () => {
    it("updates display name successfully for authenticated user", async () => {
      vi.mocked(sessionModule.requireSession).mockResolvedValue({
        actor: mockActor,
      });

      vi.mocked(userService.updateProfile).mockResolvedValue({
        id: "user-123",
        name: "Soyab Updated",
        email: "staff@hotelpaul.in",
        role: "RECEPTIONIST",
        isActive: true,
      });

      const res = await updateProfileAction({ name: "Soyab Updated" });
      expect(res.ok).toBe(true);
      expect(userService.updateProfile).toHaveBeenCalledWith(mockActor, {
        name: "Soyab Updated",
      });
    });

    it("returns validation error when name is invalid", async () => {
      vi.mocked(sessionModule.requireSession).mockResolvedValue({
        actor: mockActor,
      });

      const res = await updateProfileAction({ name: "" });
      expect(res.ok).toBe(false);
      expect(res.code).toBe("VALIDATION_ERROR");
    });
  });

  describe("changePasswordAction", () => {
    it("changes password successfully when current password and inputs are valid", async () => {
      vi.mocked(sessionModule.requireSession).mockResolvedValue({
        actor: mockActor,
      });

      vi.mocked(userService.changePassword).mockResolvedValue({
        success: true,
      });

      const res = await changePasswordAction({
        currentPassword: "CurrentPassword123!",
        newPassword: "NewPassword123456!",
        confirmPassword: "NewPassword123456!",
      });

      expect(res.ok).toBe(true);
      expect(userService.changePassword).toHaveBeenCalledWith(
        mockActor,
        expect.objectContaining({
          currentPassword: "CurrentPassword123!",
          newPassword: "NewPassword123456!",
        })
      );
    });

    it("returns error result when current password verification fails", async () => {
      vi.mocked(sessionModule.requireSession).mockResolvedValue({
        actor: mockActor,
      });

      vi.mocked(userService.changePassword).mockRejectedValue(
        new AppError("VALIDATION_ERROR", "Current password is incorrect.")
      );

      const res = await changePasswordAction({
        currentPassword: "WrongCurrentPassword",
        newPassword: "NewPassword123456!",
        confirmPassword: "NewPassword123456!",
      });

      expect(res.ok).toBe(false);
      expect(res.code).toBe("VALIDATION_ERROR");
      expect(res.message).toBe("Current password is incorrect.");
    });
  });
});
