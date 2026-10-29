export const ROLES = {
  OWNER: "OWNER",
  RECEPTIONIST: "RECEPTIONIST",
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

export const BOOKING_STATUSES = {
  RESERVED: "RESERVED",
  CHECKED_IN: "CHECKED_IN",
  CHECKED_OUT: "CHECKED_OUT",
  CANCELLED: "CANCELLED",
  NO_SHOW: "NO_SHOW",
} as const;

export type BookingStatus =
  (typeof BOOKING_STATUSES)[keyof typeof BOOKING_STATUSES];

export const PAYMENT_MODES = {
  CASH: "CASH",
  UPI: "UPI",
  CARD: "CARD",
  BANK_TRANSFER: "BANK_TRANSFER",
} as const;

export type PaymentMode = (typeof PAYMENT_MODES)[keyof typeof PAYMENT_MODES];

export const PAYMENT_KINDS = {
  ADVANCE: "ADVANCE",
  PAYMENT: "PAYMENT",
  REFUND: "REFUND",
} as const;

export type PaymentKind = (typeof PAYMENT_KINDS)[keyof typeof PAYMENT_KINDS];

export const SEVERITIES = {
  LOW: "LOW",
  MEDIUM: "MEDIUM",
  HIGH: "HIGH",
  CRITICAL: "CRITICAL",
} as const;

export type Severity = (typeof SEVERITIES)[keyof typeof SEVERITIES];

export const PROBLEM_STATUSES = {
  OPEN: "OPEN",
  FIXED: "FIXED",
} as const;

export type ProblemStatus =
  (typeof PROBLEM_STATUSES)[keyof typeof PROBLEM_STATUSES];
