import { z } from "zod";

// Indian GSTIN standard format (15 characters) or empty string
export const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

// Phone: 10 digits with optional +91 or +91- or spaces
export const PHONE_REGEX = /^(?:\+91[\-\s]?)?[0-9]{10}$/;

export const hotelDetailsSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Hotel name is required")
    .max(100, "Hotel name cannot exceed 100 characters"),
  address: z
    .string()
    .trim()
    .min(1, "Hotel address is required")
    .max(500, "Address cannot exceed 500 characters"),
  phone: z
    .string()
    .trim()
    .min(1, "Phone number is required")
    .refine(
      (val) => PHONE_REGEX.test(val.replace(/\s+/g, "")),
      "Invalid phone number. Must be 10 digits (optional +91 prefix)"
    ),
  gstin: z
    .string()
    .trim()
    .transform((val) => val.toUpperCase())
    .refine(
      (val) => val === "" || GSTIN_REGEX.test(val),
      "Invalid GSTIN format. Expected 15-character alphanumeric format (e.g. 19AAAAA0000A1Z5), or leave blank."
    ),
});

export type HotelDetailsInput = z.infer<typeof hotelDetailsSchema>;

export const billingSettingsSchema = z.object({
  graceMinutes: z
    .number()
    .int("Grace minutes must be an integer")
    .min(0, "Grace minutes cannot be negative")
    .max(1440, "Grace minutes cannot exceed 24 hours (1440 minutes)"),
  roundBillToRupee: z.boolean(),
  gstOnOtherCharges: z.boolean(),
});

export type BillingSettingsInput = z.infer<typeof billingSettingsSchema>;

export const invoiceSettingsSchema = z.object({
  invoicePrefix: z
    .string()
    .trim()
    .max(20, "Prefix cannot exceed 20 characters"),
  invoiceNotes: z
    .string()
    .trim()
    .max(2000, "Invoice notes cannot exceed 2000 characters"),
  nextNo: z
    .number()
    .int("Next invoice number must be an integer")
    .min(1, "Next invoice number must be at least 1"),
});

export type InvoiceSettingsInput = z.infer<typeof invoiceSettingsSchema>;

export const gstSlabItemSchema = z
  .object({
    id: z.string().optional(),
    minRate: z
      .number()
      .min(0, "Min rate cannot be negative"),
    maxRate: z
      .number()
      .nullable()
      .optional(),
    percent: z
      .number()
      .min(0, "GST percent cannot be negative")
      .max(100, "GST percent cannot exceed 100%"),
    isActive: z.boolean().default(true),
  })
  .refine(
    (data) => {
      if (data.maxRate !== null && data.maxRate !== undefined) {
        return data.maxRate > data.minRate;
      }
      return true;
    },
    {
      message: "Max rate must be strictly greater than min rate",
      path: ["maxRate"],
    }
  );

export type GstSlabItemInput = z.infer<typeof gstSlabItemSchema>;
