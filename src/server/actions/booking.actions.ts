"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/server/auth/permissions";
import { ROLES } from "@/lib/constants";
import {
  bookingService,
  type BookingResponse,
} from "@/server/services/booking.service";
import {
  newBookingSchema,
  checkInBookingSchema,
  cancelBookingSchema,
} from "@/features/bookings/schemas";
import {
  AppError,
  type ActionResult,
  errorResult,
  successResult,
} from "@/lib/errors";
import { ZodError } from "zod";

export async function createBookingAction(
  input: unknown
): Promise<ActionResult<BookingResponse>> {
  try {
    const actor = await requireRole([ROLES.OWNER, ROLES.RECEPTIONIST]);
    const data = newBookingSchema.parse(input);
    const result = await bookingService.createBooking(actor, data);

    revalidatePath("/bookings");
    revalidatePath("/bookings/new");
    revalidatePath("/rooms");
    revalidatePath("/dashboard");
    revalidatePath("/calendar");

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
    console.error("createBookingAction error:", err);
    return errorResult("INTERNAL_ERROR");
  }
}

export async function checkInReservedBookingAction(
  input: unknown
): Promise<ActionResult<{ id: string; reference: string; status: string }>> {
  try {
    const actor = await requireRole([ROLES.OWNER, ROLES.RECEPTIONIST]);
    const { bookingId } = checkInBookingSchema.parse(input);
    const result = await bookingService.checkInReserved(actor, bookingId);

    revalidatePath("/bookings");
    revalidatePath(`/bookings/${bookingId}`);
    revalidatePath("/rooms");
    revalidatePath("/dashboard");
    revalidatePath("/calendar");

    return successResult({
      id: result.id,
      reference: result.reference,
      status: result.status,
    });
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
    console.error("checkInReservedBookingAction error:", err);
    return errorResult("INTERNAL_ERROR");
  }
}

export async function cancelBookingAction(
  input: unknown
): Promise<ActionResult<{ id: string; reference: string; status: string }>> {
  try {
    const actor = await requireRole([ROLES.OWNER, ROLES.RECEPTIONIST]);
    const { bookingId, reason } = cancelBookingSchema.parse(input);
    const result = await bookingService.cancelBooking(actor, {
      bookingId,
      reason,
    });

    revalidatePath("/bookings");
    revalidatePath(`/bookings/${bookingId}`);
    revalidatePath("/rooms");
    revalidatePath("/dashboard");
    revalidatePath("/calendar");

    return successResult({
      id: result.id,
      reference: result.reference,
      status: result.status,
    });
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
    console.error("cancelBookingAction error:", err);
    return errorResult("INTERNAL_ERROR");
  }
}
