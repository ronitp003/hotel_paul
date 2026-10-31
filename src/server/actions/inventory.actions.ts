"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/server/auth/permissions";
import { ROLES } from "@/lib/constants";
import { inventoryService } from "@/server/services/inventory.service";
import {
  createInventoryItemSchema,
  updateInventoryItemSchema,
  toggleInventoryItemActiveSchema,
  updateStockSchema,
  moveStockSchema,
  getItemHistorySchema,
} from "@/features/inventory/schemas";
import {
  AppError,
  type ActionResult,
  errorResult,
  successResult,
} from "@/lib/errors";
import { ZodError } from "zod";

export async function createInventoryItemAction(
  input: unknown
): Promise<ActionResult> {
  try {
    const actor = await requireRole([ROLES.OWNER, ROLES.RECEPTIONIST]);
    const data = createInventoryItemSchema.parse(input);
    const item = await inventoryService.createItem(data, actor);

    revalidatePath("/inventory");
    revalidatePath("/dashboard");

    return successResult(item);
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
    console.error("createInventoryItemAction error:", err);
    return errorResult("INTERNAL_ERROR");
  }
}

export async function updateInventoryItemAction(
  input: unknown
): Promise<ActionResult> {
  try {
    const actor = await requireRole([ROLES.OWNER, ROLES.RECEPTIONIST]);
    const data = updateInventoryItemSchema.parse(input);
    const item = await inventoryService.updateItem(data, actor);

    revalidatePath("/inventory");
    revalidatePath("/dashboard");

    return successResult(item);
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
    console.error("updateInventoryItemAction error:", err);
    return errorResult("INTERNAL_ERROR");
  }
}

export async function toggleInventoryItemActiveAction(
  input: unknown
): Promise<ActionResult> {
  try {
    const actor = await requireRole([ROLES.OWNER, ROLES.RECEPTIONIST]);
    const data = toggleInventoryItemActiveSchema.parse(input);
    const item = await inventoryService.toggleActive(data.id, data.isActive, actor);

    revalidatePath("/inventory");
    revalidatePath("/dashboard");

    return successResult(item);
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
    console.error("toggleInventoryItemActiveAction error:", err);
    return errorResult("INTERNAL_ERROR");
  }
}

export async function moveStockAction(input: unknown): Promise<ActionResult> {
  try {
    const actor = await requireRole([ROLES.OWNER, ROLES.RECEPTIONIST]);
    const data = moveStockSchema.parse(input);
    const result = await inventoryService.moveStock(data, actor);

    revalidatePath("/inventory");
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
    console.error("moveStockAction error:", err);
    return errorResult("INTERNAL_ERROR");
  }
}

export async function updateStockAction(input: unknown): Promise<ActionResult> {
  try {
    const actor = await requireRole([ROLES.OWNER, ROLES.RECEPTIONIST]);
    const data = updateStockSchema.parse(input);
    const result = await inventoryService.updateStock(data, actor);

    revalidatePath("/inventory");
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
    console.error("updateStockAction error:", err);
    return errorResult("INTERNAL_ERROR");
  }
}

export async function getItemMovementsAction(
  input: unknown
): Promise<ActionResult> {
  try {
    await requireRole([ROLES.OWNER, ROLES.RECEPTIONIST]);
    const data = getItemHistorySchema.parse(input);
    const movements = await inventoryService.getItemMovements(data.itemId);

    return successResult(movements);
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
    console.error("getItemMovementsAction error:", err);
    return errorResult("INTERNAL_ERROR");
  }
}
