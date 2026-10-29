"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/server/auth/permissions";
import { ROLES } from "@/lib/constants";
import { roomService } from "@/server/services/room.service";
import { roomSchema, bulkRoomsSchema } from "@/features/rooms/schemas";
import { AppError, type ActionResult, errorResult, successResult } from "@/lib/errors";
import { ZodError } from "zod";

export async function createRoomAction(input: unknown): Promise<ActionResult> {
  try {
    const actor = await requireRole([ROLES.OWNER]);
    const data = roomSchema.parse(input);
    const created = await roomService.createRoom(actor, data);
    revalidatePath("/rooms");
    revalidatePath("/dashboard");
    return successResult(created);
  } catch (err) {
    if (err instanceof AppError) {
      return errorResult(err.code, err.message);
    }
    if (err instanceof ZodError) {
      return errorResult("VALIDATION_ERROR", err.issues[0]?.message || "Validation failed");
    }
    console.error("createRoomAction error:", err);
    return errorResult("INTERNAL_ERROR");
  }
}

export async function bulkCreateRoomsAction(input: unknown): Promise<ActionResult> {
  try {
    const actor = await requireRole([ROLES.OWNER]);
    const data = bulkRoomsSchema.parse(input);
    const result = await roomService.bulkCreateRooms(actor, data);
    revalidatePath("/rooms");
    revalidatePath("/dashboard");
    return successResult(result);
  } catch (err) {
    if (err instanceof AppError) {
      return errorResult(err.code, err.message);
    }
    if (err instanceof ZodError) {
      return errorResult("VALIDATION_ERROR", err.issues[0]?.message || "Validation failed");
    }
    console.error("bulkCreateRoomsAction error:", err);
    return errorResult("INTERNAL_ERROR");
  }
}

export async function updateRoomAction(
  id: string,
  input: unknown
): Promise<ActionResult> {
  try {
    const actor = await requireRole([ROLES.OWNER]);
    const data = roomSchema.parse(input);
    const updated = await roomService.updateRoom(actor, id, data);
    revalidatePath("/rooms");
    revalidatePath("/dashboard");
    return successResult(updated);
  } catch (err) {
    if (err instanceof AppError) {
      return errorResult(err.code, err.message);
    }
    if (err instanceof ZodError) {
      return errorResult("VALIDATION_ERROR", err.issues[0]?.message || "Validation failed");
    }
    console.error("updateRoomAction error:", err);
    return errorResult("INTERNAL_ERROR");
  }
}

export async function toggleRoomActiveAction(
  id: string,
  isActive: boolean
): Promise<ActionResult> {
  try {
    const actor = await requireRole([ROLES.OWNER]);
    const updated = await roomService.toggleRoomActive(actor, id, isActive);
    revalidatePath("/rooms");
    revalidatePath("/dashboard");
    return successResult(updated);
  } catch (err) {
    if (err instanceof AppError) {
      return errorResult(err.code, err.message);
    }
    console.error("toggleRoomActiveAction error:", err);
    return errorResult("INTERNAL_ERROR");
  }
}
