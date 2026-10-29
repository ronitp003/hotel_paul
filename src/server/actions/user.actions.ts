"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/server/auth/permissions";
import { ROLES } from "@/lib/constants";
import { userService } from "@/server/services/user.service";
import {
  createStaffSchema,
  resetPasswordSchema,
  toggleActiveSchema,
} from "@/features/users/schemas";
import { AppError, type ActionResult, errorResult, successResult } from "@/lib/errors";
import { ZodError } from "zod";

export async function createStaffAction(input: unknown): Promise<ActionResult> {
  try {
    const actor = await requireRole([ROLES.OWNER]);
    const data = createStaffSchema.parse(input);
    const user = await userService.createStaff(actor, data);
    revalidatePath("/settings/users");
    return successResult(user);
  } catch (err) {
    if (err instanceof AppError) {
      return errorResult(err.code, err.message);
    }
    if (err instanceof ZodError) {
      return errorResult("VALIDATION_ERROR", err.issues[0]?.message || "Validation failed");
    }
    console.error("createStaffAction error:", err);
    return errorResult("INTERNAL_ERROR");
  }
}

export async function toggleStaffActiveAction(input: unknown): Promise<ActionResult> {
  try {
    const actor = await requireRole([ROLES.OWNER]);
    const data = toggleActiveSchema.parse(input);
    const updated = await userService.toggleStaffActive(actor, data);
    revalidatePath("/settings/users");
    return successResult(updated);
  } catch (err) {
    if (err instanceof AppError) {
      return errorResult(err.code, err.message);
    }
    if (err instanceof ZodError) {
      return errorResult("VALIDATION_ERROR", err.issues[0]?.message || "Validation failed");
    }
    console.error("toggleStaffActiveAction error:", err);
    return errorResult("INTERNAL_ERROR");
  }
}

export async function resetPasswordAction(input: unknown): Promise<ActionResult> {
  try {
    const actor = await requireRole([ROLES.OWNER]);
    const data = resetPasswordSchema.parse(input);
    const result = await userService.resetPassword(actor, data);
    revalidatePath("/settings/users");
    return successResult(result);
  } catch (err) {
    if (err instanceof AppError) {
      return errorResult(err.code, err.message);
    }
    if (err instanceof ZodError) {
      return errorResult("VALIDATION_ERROR", err.issues[0]?.message || "Validation failed");
    }
    console.error("resetPasswordAction error:", err);
    return errorResult("INTERNAL_ERROR");
  }
}
