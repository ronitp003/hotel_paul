"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/server/auth/permissions";
import { ROLES } from "@/lib/constants";
import { billingService } from "@/server/services/billing.service";
import {
  addChargeSchema,
  deleteChargeSchema,
  addPaymentSchema,
  refundPaymentSchema,
} from "@/features/payments/schemas";
import {
  AppError,
  type ActionResult,
  errorResult,
  successResult,
} from "@/lib/errors";
import { ZodError } from "zod";

export async function addChargeAction(
  input: unknown
): Promise<ActionResult<unknown>> {
  try {
    const actor = await requireRole([ROLES.OWNER, ROLES.RECEPTIONIST]);
    const data = addChargeSchema.parse(input);
    const result = await billingService.addCharge(actor, data);

    revalidatePath("/bookings");
    revalidatePath(`/bookings/${data.bookingId}`);
    revalidatePath("/payments");

    return successResult(result);
  } catch (err) {
    if (err instanceof AppError) return errorResult(err.code, err.message);
    if (err instanceof ZodError)
      return errorResult("VALIDATION_ERROR", err.issues[0]?.message);
    console.error("addChargeAction error:", err);
    return errorResult("INTERNAL_ERROR");
  }
}

export async function deleteChargeAction(
  input: unknown
): Promise<ActionResult<unknown>> {
  try {
    const actor = await requireRole([ROLES.OWNER, ROLES.RECEPTIONIST]);
    const { chargeId } = deleteChargeSchema.parse(input);
    const result = await billingService.deleteCharge(actor, chargeId);

    revalidatePath("/bookings");
    revalidatePath("/payments");

    return successResult(result);
  } catch (err) {
    if (err instanceof AppError) return errorResult(err.code, err.message);
    if (err instanceof ZodError)
      return errorResult("VALIDATION_ERROR", err.issues[0]?.message);
    console.error("deleteChargeAction error:", err);
    return errorResult("INTERNAL_ERROR");
  }
}

export async function addPaymentAction(
  input: unknown
): Promise<ActionResult<unknown>> {
  try {
    const actor = await requireRole([ROLES.OWNER, ROLES.RECEPTIONIST]);
    const data = addPaymentSchema.parse(input);
    const result = await billingService.addPayment(actor, data);

    revalidatePath("/bookings");
    revalidatePath(`/bookings/${data.bookingId}`);
    revalidatePath("/payments");

    return successResult(result);
  } catch (err) {
    if (err instanceof AppError) return errorResult(err.code, err.message);
    if (err instanceof ZodError)
      return errorResult("VALIDATION_ERROR", err.issues[0]?.message);
    console.error("addPaymentAction error:", err);
    return errorResult("INTERNAL_ERROR");
  }
}

export async function refundPaymentAction(
  input: unknown
): Promise<ActionResult<unknown>> {
  try {
    const actor = await requireRole([ROLES.OWNER, ROLES.RECEPTIONIST]);
    const data = refundPaymentSchema.parse(input);
    const result = await billingService.refundPayment(actor, data);

    revalidatePath("/bookings");
    revalidatePath(`/bookings/${data.bookingId}`);
    revalidatePath("/payments");

    return successResult(result);
  } catch (err) {
    if (err instanceof AppError) return errorResult(err.code, err.message);
    if (err instanceof ZodError)
      return errorResult("VALIDATION_ERROR", err.issues[0]?.message);
    console.error("refundPaymentAction error:", err);
    return errorResult("INTERNAL_ERROR");
  }
}

export async function getBookingBillAction(
  bookingId: string
): Promise<ActionResult<unknown>> {
  try {
    await requireRole([ROLES.OWNER, ROLES.RECEPTIONIST]);
    const result = await billingService.getBookingBill(bookingId);
    return successResult(result);
  } catch (err) {
    if (err instanceof AppError) return errorResult(err.code, err.message);
    console.error("getBookingBillAction error:", err);
    return errorResult("INTERNAL_ERROR");
  }
}
