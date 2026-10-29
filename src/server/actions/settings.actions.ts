"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/server/auth/permissions";
import { ROLES } from "@/lib/constants";
import { settingsService } from "@/server/services/settings.service";
import {
  hotelDetailsSchema,
  billingSettingsSchema,
  invoiceSettingsSchema,
  gstSlabItemSchema,
} from "@/features/settings/schemas";
import {
  AppError,
  type ActionResult,
  errorResult,
  successResult,
} from "@/lib/errors";
import { ZodError } from "zod";

export async function updateHotelDetailsAction(
  input: unknown
): Promise<ActionResult> {
  try {
    const actor = await requireRole([ROLES.OWNER]);
    const data = hotelDetailsSchema.parse(input);
    const updated = await settingsService.updateHotelDetails(actor, data);
    revalidatePath("/settings");
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
    console.error("updateHotelDetailsAction error:", err);
    return errorResult("INTERNAL_ERROR");
  }
}

export async function updateBillingSettingsAction(
  input: unknown
): Promise<ActionResult> {
  try {
    const actor = await requireRole([ROLES.OWNER]);
    const data = billingSettingsSchema.parse(input);
    const updated = await settingsService.updateBillingSettings(actor, data);
    revalidatePath("/settings");
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
    console.error("updateBillingSettingsAction error:", err);
    return errorResult("INTERNAL_ERROR");
  }
}

export async function updateInvoiceSettingsAction(
  input: unknown
): Promise<ActionResult> {
  try {
    const actor = await requireRole([ROLES.OWNER]);
    const data = invoiceSettingsSchema.parse(input);
    const updated = await settingsService.updateInvoiceSettings(actor, data);
    revalidatePath("/settings");
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
    console.error("updateInvoiceSettingsAction error:", err);
    return errorResult("INTERNAL_ERROR");
  }
}

export async function createGstSlabAction(
  input: unknown
): Promise<ActionResult> {
  try {
    const actor = await requireRole([ROLES.OWNER]);
    const data = gstSlabItemSchema.parse(input);
    const created = await settingsService.createGstSlab(actor, data);
    revalidatePath("/settings");
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
    console.error("createGstSlabAction error:", err);
    return errorResult("INTERNAL_ERROR");
  }
}

export async function updateGstSlabAction(
  id: string,
  input: unknown
): Promise<ActionResult> {
  try {
    const actor = await requireRole([ROLES.OWNER]);
    const data = gstSlabItemSchema.parse(input);
    const updated = await settingsService.updateGstSlab(actor, id, data);
    revalidatePath("/settings");
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
    console.error("updateGstSlabAction error:", err);
    return errorResult("INTERNAL_ERROR");
  }
}

export async function toggleGstSlabAction(
  id: string,
  isActive: boolean
): Promise<ActionResult> {
  try {
    const actor = await requireRole([ROLES.OWNER]);
    const updated = await settingsService.toggleGstSlab(actor, id, isActive);
    revalidatePath("/settings");
    return successResult(updated);
  } catch (err) {
    if (err instanceof AppError) {
      return errorResult(err.code, err.message);
    }
    console.error("toggleGstSlabAction error:", err);
    return errorResult("INTERNAL_ERROR");
  }
}

export async function deleteGstSlabAction(id: string): Promise<ActionResult> {
  try {
    const actor = await requireRole([ROLES.OWNER]);
    const result = await settingsService.deleteGstSlab(actor, id);
    revalidatePath("/settings");
    return successResult(result);
  } catch (err) {
    if (err instanceof AppError) {
      return errorResult(err.code, err.message);
    }
    console.error("deleteGstSlabAction error:", err);
    return errorResult("INTERNAL_ERROR");
  }
}
