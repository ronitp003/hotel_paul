import { z } from "zod";

export const PaymentModeEnum = z.enum(["CASH", "UPI", "CARD", "BANK_TRANSFER"]);

export const PaymentKindEnum = z.enum(["ADVANCE", "PAYMENT", "REFUND"]);

export const addChargeSchema = z.object({
  bookingId: z.string().min(1, "Booking ID is required"),
  description: z.string().trim().min(1, "Description is required").max(100),
  amount: z.number().positive("Charge amount must be positive"),
  isTaxable: z.boolean().default(false),
});

export const deleteChargeSchema = z.object({
  chargeId: z.string().min(1, "Charge ID is required"),
});

export const addPaymentSchema = z.object({
  bookingId: z.string().min(1, "Booking ID is required"),
  kind: z.enum(["ADVANCE", "PAYMENT"]).default("PAYMENT"),
  mode: PaymentModeEnum,
  amount: z.number().positive("Payment amount must be positive"),
  note: z.string().trim().max(255).optional().or(z.literal("")),
});

export const refundPaymentSchema = z.object({
  bookingId: z.string().min(1, "Booking ID is required"),
  mode: PaymentModeEnum,
  amount: z.number().positive("Refund amount must be positive"),
  note: z.string().trim().max(255).optional().or(z.literal("")),
});

export const checkoutSchema = z.object({
  bookingId: z.string().min(1, "Booking ID is required"),
  paymentAmount: z.number().min(0).optional(),
  paymentMode: PaymentModeEnum.optional(),
  paymentNote: z.string().trim().max(255).optional().or(z.literal("")),
  allowZeroPaymentWithBalance: z.boolean().default(false).optional(),
  isEarlyCheckout: z.boolean().default(false).optional(),
  refundAmount: z.number().min(0).optional(),
  refundMode: PaymentModeEnum.optional(),
  refundNote: z.string().trim().max(255).optional().or(z.literal("")),
  companyName: z.string().trim().max(200).optional().or(z.literal("")),
  companyGstin: z.string().trim().max(20).optional().or(z.literal("")),
  companyAddress: z.string().trim().max(500).optional().or(z.literal("")),
});

export const cancelInvoiceSchema = z.object({
  invoiceId: z.string().min(1, "Invoice ID is required"),
  reason: z.string().trim().min(5, "Reason is required (min 5 characters)"),
});

export type AddChargeInput = z.infer<typeof addChargeSchema>;
export type DeleteChargeInput = z.infer<typeof deleteChargeSchema>;
export type AddPaymentInput = z.infer<typeof addPaymentSchema>;
export type RefundPaymentInput = z.infer<typeof refundPaymentSchema>;
export type CheckoutInput = z.infer<typeof checkoutSchema>;
export type CancelInvoiceInput = z.infer<typeof cancelInvoiceSchema>;
