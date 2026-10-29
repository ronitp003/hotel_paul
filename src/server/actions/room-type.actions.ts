"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/server/auth/permissions";
import { ROLES } from "@/lib/constants";
import { roomTypeService } from "@/server/services/room-type.service";
import { roomTypeSchema } from "@/features/rooms/schemas";
import {
  AppError,
  type ActionResult,
  errorResult,
  successResult,
} from "@/lib/errors";
import { ZodError } from "zod";

export async function createRoomTypeAction(
  input: unknown
): Promise<ActionResult> {
  try {
    const actor = await requireRole([ROLES.OWNER]);
    const data = roomTypeSchema.parse(input);
    const created = await roomTypeService.createRoomType(actor, data);
    revalidatePath("/settings/room-types");
    return successResult(created);
  } catch (err) {
    if (err instanceof AppError) {
      return errorResult(err.code, err.message);
    }
    if (err instanceof ZodError) {
      return errorResult(
        "VALIDATION_ERROR",
        err.issues[0]?.message || "Validation failed"
      );
    }
    console.error("createRoomTypeAction error:", err);
    return errorResult("INTERNAL_ERROR");
  }
}

export async function updateRoomTypeAction(
  id: string,
  input: unknown
): Promise<ActionResult> {
  try {
    const actor = await requireRole([ROLES.OWNER]);
    const data = roomTypeSchema.parse(input);
    const updated = await roomTypeService.updateRoomType(actor, id, data);
    revalidatePath("/settings/room-types");
    return successResult(updated);
  } catch (err) {
    if (err instanceof AppError) {
      return errorResult(err.code, err.message);
    }
    if (err instanceof ZodError) {
      return errorResult(
        "VALIDATION_ERROR",
        err.issues[0]?.message || "Validation failed"
      );
    }
    console.error("updateRoomTypeAction error:", err);
    return errorResult("INTERNAL_ERROR");
  }
}

export async function deleteRoomTypeAction(id: string): Promise<ActionResult> {
  try {
    const actor = await requireRole([ROLES.OWNER]);
    const result = await roomTypeService.deleteRoomType(actor, id);
    revalidatePath("/settings/room-types");
    return successResult(result);
  } catch (err) {
    if (err instanceof AppError) {
      return errorResult(err.code, err.message);
    }
    console.error("deleteRoomTypeAction error:", err);
    return errorResult("INTERNAL_ERROR");
  }
}
