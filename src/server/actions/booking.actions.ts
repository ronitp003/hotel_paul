"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/server/auth/permissions";
import { ROLES } from "@/lib/constants";
import { bookingService, type BookingResponse } from "@/server/services/booking.service";
import { newBookingSchema } from "@/features/bookings/schemas";
import { AppError, type ActionResult, errorResult, successResult } from "@/lib/errors";
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
      return errorResult("VALIDATION_ERROR", err.issues[0]?.message || "Validation failed");
    }
    console.error("createBookingAction error:", err);
    return errorResult("INTERNAL_ERROR");
  }
}
