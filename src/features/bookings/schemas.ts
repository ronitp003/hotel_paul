import { z } from "zod";

export const BookingSourceEnum = z.enum([
  "WALK_IN",
  "PHONE",
  "ONLINE",
  "CORPORATE",
  "OTHER",
]);

export const SexEnum = z.enum(["MALE", "FEMALE", "OTHER"]);

export const guestSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1, "Guest name is required"),
  fatherName: z.string().trim().optional().or(z.literal("")),
  age: z
    .number()
    .int()
    .min(0, "Age cannot be negative")
    .max(125, "Please enter a valid age")
    .optional()
    .nullable(),
  sex: SexEnum.optional().nullable(),
  mobile: z
    .string()
    .trim()
    .regex(/^[0-9+ -]{0,15}$/, "Please enter a valid phone number")
    .optional()
    .or(z.literal("")),
  isPrimary: z.boolean().default(false),
});

export const newBookingSchema = z
  .object({
    roomId: z.string().min(1, "Please select a room"),
    checkInAt: z.coerce.date(),
    checkOutAt: z.coerce.date(),
    action: z.enum(["RESERVE", "CHECK_IN"]).default("RESERVE").optional(),
    source: BookingSourceEnum.default("WALK_IN").optional(),

    // Primary & Additional Guests
    guests: z
      .array(guestSchema)
      .min(1, "At least one guest is required")
      .refine((guests) => guests.some((g) => g.isPrimary), {
        message: "At least one primary guest is required",
      }),

    // Visit details
    arrivingFrom: z.string().trim().optional().or(z.literal("")),
    purposeOfVisit: z.string().trim().optional().or(z.literal("")),

    // Corporate details (optional)
    companyName: z.string().trim().optional().or(z.literal("")),
    companyGstin: z.string().trim().optional().or(z.literal("")),
    companyAddress: z.string().trim().optional().or(z.literal("")),

    // Financials
    rateApplied: z.number().min(0, "Room rate cannot be negative"),
    discount: z
      .number()
      .min(0, "Discount cannot be negative")
      .default(0)
      .optional(),
    gstPercentOverride: z
      .number()
      .min(0, "GST % cannot be negative")
      .max(100, "GST % cannot exceed 100")
      .optional()
      .nullable(),

    // Advance payment
    advanceAmount: z
      .number()
      .min(0, "Advance payment cannot be negative")
      .default(0)
      .optional(),
    advanceMode: z
      .enum(["CASH", "UPI", "CARD", "BANK_TRANSFER"])
      .optional()
      .nullable(),
  })
  .refine((data) => data.checkOutAt.getTime() > data.checkInAt.getTime(), {
    message: "Check-out time must be strictly after check-in time",
    path: ["checkOutAt"],
  })
  .refine(
    (data) => {
      if (data.advanceAmount && data.advanceAmount > 0) {
        return !!data.advanceMode;
      }
      return true;
    },
    {
      message: "Please select payment mode for advance payment",
      path: ["advanceMode"],
    }
  );

export type GuestInput = z.infer<typeof guestSchema>;
export type NewBookingInput = z.infer<typeof newBookingSchema>;

export const checkInBookingSchema = z.object({
  bookingId: z.string().min(1, "Booking ID is required"),
});

export type CheckInBookingInput = z.infer<typeof checkInBookingSchema>;

export const cancelBookingSchema = z.object({
  bookingId: z.string().min(1, "Booking ID is required"),
  reason: z.string().trim().optional(),
});

export type CancelBookingInput = z.infer<typeof cancelBookingSchema>;
