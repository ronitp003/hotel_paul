export type ErrorCode =
  | "ROOM_OVERLAP"
  | "MAINTENANCE_OVERLAP"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "ROOM_NOT_FOUND"
  | "BOOKING_NOT_FOUND"
  | "INVALID_STATUS_TRANSITION"
  | "INVOICE_ALREADY_ISSUED"
  | "INVOICE_NOT_FOUND"
  | "INSUFFICIENT_STOCK"
  | "VALIDATION_ERROR"
  | "INTERNAL_ERROR";

export const ERROR_MESSAGES: Record<ErrorCode, string> = {
  ROOM_OVERLAP:
    "This room is already booked or under maintenance during the selected time period.",
  MAINTENANCE_OVERLAP:
    "Cannot schedule maintenance because this room has an overlapping booking.",
  UNAUTHORIZED: "You must be logged in to perform this action.",
  FORBIDDEN: "You do not have permission to perform this action.",
  ROOM_NOT_FOUND: "The requested room was not found.",
  BOOKING_NOT_FOUND: "The requested booking was not found.",
  INVALID_STATUS_TRANSITION:
    "Cannot complete this action because the booking is in an invalid status.",
  INVOICE_ALREADY_ISSUED:
    "A tax invoice has already been issued for this booking.",
  INVOICE_NOT_FOUND: "The requested invoice was not found.",
  INSUFFICIENT_STOCK: "Insufficient inventory stock for this transfer.",
  VALIDATION_ERROR: "Invalid data provided. Please check the fields and try again.",
  INTERNAL_ERROR: "An unexpected system error occurred. Please try again.",
};

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly details?: unknown;

  constructor(code: ErrorCode, customMessage?: string, details?: unknown) {
    super(customMessage || ERROR_MESSAGES[code] || "An error occurred");
    this.name = "AppError";
    this.code = code;
    this.details = details;
  }
}

export interface ActionResult<T = unknown> {
  ok: boolean;
  data?: T;
  code?: ErrorCode;
  message?: string;
}

export function errorResult(code: ErrorCode, customMessage?: string): ActionResult<never> {
  return {
    ok: false,
    code,
    message: customMessage || ERROR_MESSAGES[code],
  };
}

export function successResult<T>(data: T): ActionResult<T> {
  return {
    ok: true,
    data,
  };
}
