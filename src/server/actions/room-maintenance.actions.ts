"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/server/auth/permissions";
import { ROLES } from "@/lib/constants";
import { roomMaintenanceService } from "@/server/services/room-maintenance.service";
import {
  logProblemSchema,
  markProblemFixedSchema,
  createMaintenanceSchema,
  deleteMaintenanceSchema,
  closeMaintenanceSchema,
} from "@/features/rooms/schemas";
import {
  AppError,
  type ActionResult,
  errorResult,
  successResult,
} from "@/lib/errors";
import { ZodError } from "zod";

export async function logProblemAction(input: unknown): Promise<ActionResult> {
  try {
    const actor = await requireRole([ROLES.OWNER, ROLES.RECEPTIONIST]);
    const data = logProblemSchema.parse(input);
    const problem = await roomMaintenanceService.logProblem(data, actor);

    revalidatePath("/rooms");
    revalidatePath(`/rooms/${data.roomId}`);
    revalidatePath("/calendar");
    revalidatePath("/dashboard");

    return successResult(problem);
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
    console.error("logProblemAction error:", err);
    return errorResult("INTERNAL_ERROR");
  }
}

export async function markProblemFixedAction(input: unknown): Promise<ActionResult> {
  try {
    const actor = await requireRole([ROLES.OWNER, ROLES.RECEPTIONIST]);
    const data = markProblemFixedSchema.parse(input);
    const problem = await roomMaintenanceService.markProblemFixed(data, actor);

    revalidatePath("/rooms");
    revalidatePath(`/rooms/${problem.roomId}`);
    revalidatePath("/calendar");
    revalidatePath("/dashboard");

    return successResult(problem);
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
    console.error("markProblemFixedAction error:", err);
    return errorResult("INTERNAL_ERROR");
  }
}

export async function checkMaintenanceConflictsAction(input: {
  roomId: string;
  startsAt: string;
  endsAt: string;
}): Promise<ActionResult> {
  try {
    await requireRole([ROLES.OWNER, ROLES.RECEPTIONIST]);
    const startsAt = new Date(input.startsAt);
    const endsAt = new Date(input.endsAt);

    if (isNaN(startsAt.getTime()) || isNaN(endsAt.getTime()) || endsAt <= startsAt) {
      return errorResult(
        "VALIDATION_ERROR",
        "End time must be after start time."
      );
    }

    const conflicts = await roomMaintenanceService.checkMaintenanceConflicts(
      input.roomId,
      startsAt,
      endsAt
    );

    return successResult(conflicts);
  } catch (err) {
    if (err instanceof AppError) {
      return errorResult(err.code, err.message);
    }
    console.error("checkMaintenanceConflictsAction error:", err);
    return errorResult("INTERNAL_ERROR");
  }
}

export async function createMaintenanceAction(input: unknown): Promise<ActionResult> {
  try {
    const actor = await requireRole([ROLES.OWNER, ROLES.RECEPTIONIST]);
    const data = createMaintenanceSchema.parse(input);
    const maintenance = await roomMaintenanceService.createMaintenance(data, actor);

    revalidatePath("/rooms");
    revalidatePath(`/rooms/${data.roomId}`);
    revalidatePath("/calendar");
    revalidatePath("/dashboard");

    return successResult(maintenance);
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
    if (
      err &&
      typeof err === "object" &&
      String((err as { message?: string }).message).includes("maintenance_no_overlap")
    ) {
      return errorResult(
        "MAINTENANCE_OVERLAP",
        "A maintenance period is already scheduled for this room during this time."
      );
    }
    console.error("createMaintenanceAction error:", err);
    return errorResult("INTERNAL_ERROR");
  }
}

export async function deleteMaintenanceAction(input: unknown): Promise<ActionResult> {
  try {
    const actor = await requireRole([ROLES.OWNER, ROLES.RECEPTIONIST]);
    const data = deleteMaintenanceSchema.parse(input);
    const result = await roomMaintenanceService.deleteMaintenance(
      data.maintenanceId,
      actor
    );

    revalidatePath("/rooms");
    if (result.roomId) {
      revalidatePath(`/rooms/${result.roomId}`);
    }
    revalidatePath("/calendar");
    revalidatePath("/dashboard");

    return successResult(result);
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
    console.error("deleteMaintenanceAction error:", err);
    return errorResult("INTERNAL_ERROR");
  }
}

export async function closeMaintenanceAction(input: unknown): Promise<ActionResult> {
  try {
    const actor = await requireRole([ROLES.OWNER, ROLES.RECEPTIONIST]);
    const data = closeMaintenanceSchema.parse(input);
    const result = await roomMaintenanceService.closeMaintenance(data, actor);

    revalidatePath("/rooms");
    if (result.roomId) {
      revalidatePath(`/rooms/${result.roomId}`);
    }
    revalidatePath("/calendar");
    revalidatePath("/dashboard");

    return successResult(result);
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
    console.error("closeMaintenanceAction error:", err);
    return errorResult("INTERNAL_ERROR");
  }
}

