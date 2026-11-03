import "server-only";
import { prisma } from "@/server/db";
import { hashPassword, verifyPassword } from "better-auth/crypto";
import { AppError } from "@/lib/errors";
import type { Actor } from "@/server/auth/session";
import type {
  CreateStaffInput,
  ResetPasswordInput,
  ToggleActiveInput,
  UpdateProfileInput,
  ChangePasswordInput,
} from "@/features/users/schemas";

export const userService = {
  /**
   * Lists all staff user accounts.
   */
  async listStaff() {
    return prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });
  },

  /**
   * Creates a new staff member account and credentials.
   */
  async createStaff(actor: Actor, data: CreateStaffInput) {
    const existing = await prisma.user.findUnique({
      where: { email: data.email.toLowerCase().trim() },
    });

    if (existing) {
      throw new AppError(
        "VALIDATION_ERROR",
        `An account with email ${data.email} already exists.`
      );
    }

    const hashedPassword = await hashPassword(data.password);
    const email = data.email.toLowerCase().trim();

    const user = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          name: data.name.trim(),
          email,
          role: data.role,
          isActive: true,
          emailVerified: true,
        },
      });

      await tx.account.create({
        data: {
          userId: newUser.id,
          accountId: newUser.id,
          providerId: "credential",
          password: hashedPassword,
        },
      });

      return newUser;
    });

    // Write audit log
    await prisma.auditLog.create({
      data: {
        actorId: actor.id,
        action: "users.create",
        entity: "User",
        entityId: user.id,
        metadata: {
          createdEmail: user.email,
          role: user.role,
        },
      },
    });

    return user;
  },

  /**
   * Toggles the active status of a staff member.
   */
  async toggleStaffActive(actor: Actor, data: ToggleActiveInput) {
    if (actor.id === data.userId) {
      throw new AppError(
        "VALIDATION_ERROR",
        "You cannot deactivate your own account."
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: data.userId },
    });

    if (!user) {
      throw new AppError("VALIDATION_ERROR", "User account not found.");
    }

    const updated = await prisma.user.update({
      where: { id: data.userId },
      data: { isActive: data.isActive },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
      },
    });

    // If deactivating, invalidate any active sessions
    if (!data.isActive) {
      await prisma.session.deleteMany({
        where: { userId: data.userId },
      });
    }

    // Write audit log
    await prisma.auditLog.create({
      data: {
        actorId: actor.id,
        action: data.isActive ? "users.activate" : "users.deactivate",
        entity: "User",
        entityId: updated.id,
        metadata: {
          targetEmail: updated.email,
          isActive: updated.isActive,
        },
      },
    });

    return updated;
  },

  /**
   * Resets a staff member's password and revokes all active sessions.
   */
  async resetPassword(actor: Actor, data: ResetPasswordInput) {
    const user = await prisma.user.findUnique({
      where: { id: data.userId },
    });

    if (!user) {
      throw new AppError("VALIDATION_ERROR", "User account not found.");
    }

    const hashedPassword = await hashPassword(data.newPassword);

    await prisma.account.updateMany({
      where: {
        userId: data.userId,
        providerId: "credential",
      },
      data: {
        password: hashedPassword,
      },
    });

    // Invalidate old sessions so the user must sign in with new password
    await prisma.session.deleteMany({
      where: { userId: data.userId },
    });

    // Write audit log
    await prisma.auditLog.create({
      data: {
        actorId: actor.id,
        action: "users.resetPassword",
        entity: "User",
        entityId: user.id,
        metadata: {
          targetEmail: user.email,
        },
      },
    });

    return { success: true };
  },

  /**
   * Updates the authenticated user's own profile (display name).
   */
  async updateProfile(actor: Actor, data: UpdateProfileInput) {
    const trimmedName = data.name.trim();

    const updated = await prisma.user.update({
      where: { id: actor.id },
      data: { name: trimmedName },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
      },
    });

    // Write audit log
    await prisma.auditLog.create({
      data: {
        actorId: actor.id,
        action: "users.updateProfile",
        entity: "User",
        entityId: updated.id,
        metadata: {
          previousName: actor.name,
          newName: updated.name,
        },
      },
    });

    return updated;
  },

  /**
   * Changes the authenticated user's own password after verifying their current password.
   */
  async changePassword(actor: Actor, data: ChangePasswordInput) {
    const account = await prisma.account.findFirst({
      where: {
        userId: actor.id,
        providerId: "credential",
      },
    });

    if (!account || !account.password) {
      throw new AppError(
        "VALIDATION_ERROR",
        "Password authentication is not configured for this account."
      );
    }

    const isMatch = await verifyPassword({
      password: data.currentPassword,
      hash: account.password,
    });

    if (!isMatch) {
      throw new AppError("VALIDATION_ERROR", "Current password is incorrect.");
    }

    if (data.currentPassword === data.newPassword) {
      throw new AppError(
        "VALIDATION_ERROR",
        "New password cannot be the same as your current password."
      );
    }

    const hashedPassword = await hashPassword(data.newPassword);

    await prisma.account.update({
      where: { id: account.id },
      data: {
        password: hashedPassword,
      },
    });

    // Write audit log
    await prisma.auditLog.create({
      data: {
        actorId: actor.id,
        action: "users.changePassword",
        entity: "User",
        entityId: actor.id,
        metadata: {
          email: actor.email,
        },
      },
    });

    return { success: true };
  },
};
