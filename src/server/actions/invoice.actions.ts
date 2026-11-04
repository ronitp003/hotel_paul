"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/server/auth/permissions";
import { ROLES } from "@/lib/constants";
import { invoiceService } from "@/server/services/invoice.service";
import {
  checkoutSchema,
  cancelInvoiceSchema,
} from "@/features/payments/schemas";
import {
  AppError,
  type ActionResult,
  errorResult,
  successResult,
} from "@/lib/errors";
import { ZodError } from "zod";

export async function checkoutAction(
  input: unknown
): Promise<
  ActionResult<
    Awaited<ReturnType<typeof invoiceService.checkoutAndIssueInvoice>>
  >
> {
  try {
    const actor = await requireRole([ROLES.OWNER, ROLES.RECEPTIONIST]);
    const data = checkoutSchema.parse(input);
    const result = await invoiceService.checkoutAndIssueInvoice(actor, data);

    revalidatePath("/bookings");
    revalidatePath(`/bookings/${data.bookingId}`);
    revalidatePath("/rooms");
    revalidatePath("/dashboard");
    revalidatePath("/payments");

    return successResult(result);
  } catch (err) {
    if (err instanceof AppError) return errorResult(err.code, err.message);
    if (err instanceof ZodError)
      return errorResult("VALIDATION_ERROR", err.issues[0]?.message);
    console.error("checkoutAction error:", err);
    return errorResult("INTERNAL_ERROR");
  }
}

export async function cancelInvoiceAction(
  input: unknown
): Promise<
  ActionResult<Awaited<ReturnType<typeof invoiceService.cancelInvoice>>>
> {
  try {
    const actor = await requireRole([ROLES.OWNER]);
    const data = cancelInvoiceSchema.parse(input);
    const result = await invoiceService.cancelInvoice(actor, data);

    revalidatePath("/bookings");
    revalidatePath("/payments");

    return successResult(result);
  } catch (err) {
    if (err instanceof AppError) return errorResult(err.code, err.message);
    if (err instanceof ZodError)
      return errorResult("VALIDATION_ERROR", err.issues[0]?.message);
    console.error("cancelInvoiceAction error:", err);
    return errorResult("INTERNAL_ERROR");
  }
}

export async function getInvoiceAction(
  invoiceId: string
): Promise<
  ActionResult<Awaited<ReturnType<typeof invoiceService.getInvoice>>>
> {
  try {
    await requireRole([ROLES.OWNER, ROLES.RECEPTIONIST]);
    const result = await invoiceService.getInvoice(invoiceId);
    return successResult(result);
  } catch (err) {
    if (err instanceof AppError) return errorResult(err.code, err.message);
    console.error("getInvoiceAction error:", err);
    return errorResult("INTERNAL_ERROR");
  }
}

export async function getBookingInvoiceAction(
  bookingId: string
): Promise<
  ActionResult<Awaited<ReturnType<typeof invoiceService.getInvoiceByBooking>>>
> {
  try {
    await requireRole([ROLES.OWNER, ROLES.RECEPTIONIST]);
    const result = await invoiceService.getInvoiceByBooking(bookingId);
    return successResult(result);
  } catch (err) {
    if (err instanceof AppError) return errorResult(err.code, err.message);
    console.error("getBookingInvoiceAction error:", err);
    return errorResult("INTERNAL_ERROR");
  }
}
