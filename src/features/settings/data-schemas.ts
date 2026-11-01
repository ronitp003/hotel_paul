import { z } from "zod";
import {
  BookingStatus,
  BookingSource,
  PaymentMode,
  PaymentKind,
  Severity,
  ProblemStatus,
  InvoiceStatus,
  Sex,
  StockLocation,
} from "@prisma/client";

export const exportBookingsFilterSchema = z.object({
  range: z
    .enum(["all", "7d", "30d", "month", "lastMonth", "currentFY", "custom"])
    .default("all"),
  from: z.string().optional(),
  to: z.string().optional(),
  status: z
    .union([z.nativeEnum(BookingStatus), z.literal("ALL")])
    .default("ALL"),
});

export type ExportBookingsFilter = z.infer<typeof exportBookingsFilterSchema>;

// ──────────────────────────────────────────────
// System Backup Schema Definition (schemaVersion: 1)
// ──────────────────────────────────────────────

export const backupMetadataSchema = z.object({
  schemaVersion: z.literal(1),
  exportedAt: z.string(),
  exportedBy: z.object({
    id: z.string(),
    name: z.string(),
    email: z.string(),
  }),
  hotel: z.object({
    name: z.string(),
    gstin: z.string(),
    phone: z.string(),
    address: z.string(),
  }),
  counts: z.object({
    roomTypes: z.number(),
    rooms: z.number(),
    bookings: z.number(),
    guests: z.number(),
    charges: z.number(),
    payments: z.number(),
    invoices: z.number(),
    inventoryItems: z.number(),
    inventoryMovements: z.number(),
    roomMaintenance: z.number(),
    roomProblems: z.number(),
  }),
});

export type BackupMetadata = z.infer<typeof backupMetadataSchema>;

export const backupHotelSettingsSchema = z.object({
  id: z.number(),
  name: z.string(),
  address: z.string(),
  phone: z.string(),
  gstin: z.string(),
  invoicePrefix: z.string(),
  invoiceNotes: z.string(),
  graceMinutes: z.number(),
  roundBillToRupee: z.boolean(),
  gstOnOtherCharges: z.boolean(),
  updatedAt: z.string(),
});

export const backupGstSlabSchema = z.object({
  id: z.string(),
  minRate: z.number(),
  maxRate: z.number().nullable(),
  percent: z.number(),
  isActive: z.boolean(),
});

export const backupInvoiceSequenceSchema = z.object({
  id: z.number(),
  nextNo: z.number(),
});

export const backupRoomTypeSchema = z.object({
  id: z.string(),
  name: z.string(),
});

export const backupRoomSchema = z.object({
  id: z.string(),
  number: z.string(),
  typeId: z.string(),
  pricePerNight: z.number(),
  isActive: z.boolean(),
  createdAt: z.string(),
});

export const backupBookingGuestSchema = z.object({
  id: z.string(),
  allocatedRoomId: z.string().nullable().optional(),
  isPrimary: z.boolean(),
  name: z.string(),
  fatherName: z.string().nullable(),
  age: z.number().nullable(),
  sex: z.nativeEnum(Sex).nullable(),
  mobile: z.string().nullable(),
});

export const backupChargeSchema = z.object({
  id: z.string(),
  description: z.string(),
  amount: z.number(),
  isTaxable: z.boolean(),
  createdById: z.string(),
  createdAt: z.string(),
});

export const backupPaymentSchema = z.object({
  id: z.string(),
  kind: z.nativeEnum(PaymentKind),
  mode: z.nativeEnum(PaymentMode),
  amount: z.number(),
  note: z.string().nullable(),
  receivedAt: z.string(),
  createdById: z.string(),
});

export const backupInvoiceCorrectionSchema = z.object({
  id: z.string(),
  action: z.string(),
  reason: z.string(),
  before: z.any(),
  after: z.any().nullable().optional(),
  doneById: z.string(),
  doneAt: z.string(),
});

export const backupInvoiceSchema = z.object({
  id: z.string(),
  number: z.number(),
  displayNo: z.string(),
  status: z.nativeEnum(InvoiceStatus),
  issuedAt: z.string(),
  issuedById: z.string(),
  taxableAmount: z.number(),
  cgst: z.number(),
  sgst: z.number(),
  billAmount: z.number(),
  advancePaid: z.number(),
  balance: z.number(),
  snapshot: z.any(),
  corrections: z.array(backupInvoiceCorrectionSchema).default([]),
});

export const backupBookingSchema = z.object({
  id: z.string(),
  reference: z.string(),
  groupBookingId: z.string().nullable().optional(),
  isGroupMaster: z.boolean(),
  roomId: z.string(),
  status: z.nativeEnum(BookingStatus),
  source: z.nativeEnum(BookingSource),
  checkInAt: z.string(),
  checkOutAt: z.string(),
  actualCheckInAt: z.string().nullable(),
  actualCheckOutAt: z.string().nullable(),
  arrivingFrom: z.string().nullable(),
  purposeOfVisit: z.string().nullable(),
  companyName: z.string().nullable(),
  companyGstin: z.string().nullable(),
  companyAddress: z.string().nullable(),
  rateApplied: z.number(),
  discount: z.number(),
  gstPercentOverride: z.number().nullable(),
  createdById: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  guests: z.array(backupBookingGuestSchema).default([]),
  charges: z.array(backupChargeSchema).default([]),
  payments: z.array(backupPaymentSchema).default([]),
  invoice: backupInvoiceSchema.nullable().optional(),
});

export const backupInventoryItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  unit: z.string(),
  reorderLevel: z.number(),
  qtyStore: z.number(),
  qtyRooms: z.number(),
  qtyLaundry: z.number(),
  qtyDamaged: z.number(),
  qtyDiscontinued: z.number(),
  isActive: z.boolean(),
});

export const backupInventoryMovementSchema = z.object({
  id: z.string(),
  itemId: z.string(),
  actionType: z.string().nullable().optional(),
  from: z.nativeEnum(StockLocation).nullable().optional(),
  to: z.nativeEnum(StockLocation).nullable().optional(),
  quantity: z.number(),
  previousQty: z.number().nullable().optional(),
  updatedQty: z.number().nullable().optional(),
  note: z.string().nullable().optional(),
  doneById: z.string(),
  doneAt: z.string(),
});

export const backupRoomMaintenanceSchema = z.object({
  id: z.string(),
  roomId: z.string(),
  startsAt: z.string(),
  endsAt: z.string(),
  reason: z.string(),
  createdById: z.string(),
  createdAt: z.string(),
});

export const backupRoomProblemSchema = z.object({
  id: z.string(),
  roomId: z.string(),
  description: z.string(),
  severity: z.nativeEnum(Severity),
  status: z.nativeEnum(ProblemStatus),
  reportedById: z.string(),
  reportedAt: z.string(),
  fixedById: z.string().nullable().optional(),
  fixedAt: z.string().nullable().optional(),
});

export const backupDataSchema = z.object({
  metadata: backupMetadataSchema,
  settings: z.object({
    hotelSettings: backupHotelSettingsSchema.nullable().optional(),
    gstSlabs: z.array(backupGstSlabSchema).default([]),
    invoiceSequence: backupInvoiceSequenceSchema.nullable().optional(),
  }),
  catalog: z.object({
    roomTypes: z.array(backupRoomTypeSchema).default([]),
    rooms: z.array(backupRoomSchema).default([]),
  }),
  bookings: z.array(backupBookingSchema).default([]),
  inventory: z.object({
    items: z.array(backupInventoryItemSchema).default([]),
    movements: z.array(backupInventoryMovementSchema).default([]),
  }),
  maintenance: z.object({
    records: z.array(backupRoomMaintenanceSchema).default([]),
    problems: z.array(backupRoomProblemSchema).default([]),
  }),
});

export type BackupData = z.infer<typeof backupDataSchema>;

// ──────────────────────────────────────────────
// Conflict & Diff Analysis Result Types (Step 2)
// ──────────────────────────────────────────────

export type ConflictType =
  | "INVOICE_NUMBER_COLLISION"
  | "ROOM_STAY_OVERLAP"
  | "ROOM_NUMBER_TYPE_MISMATCH"
  | "DUPLICATE_BOOKING_REFERENCE";

export interface ConflictItem {
  type: ConflictType;
  severity: "ERROR" | "WARNING";
  description: string;
  entityId: string;
  reference?: string;
}

export interface BackupDiffSummary {
  canProceed: boolean;
  totalNewRecords: number;
  totalDuplicateRecords: number;
  conflicts: ConflictItem[];
  diffs: {
    roomTypes: { new: number; existing: number };
    rooms: { new: number; existing: number };
    bookings: { new: number; existing: number };
    payments: { new: number; existing: number };
    invoices: { new: number; existing: number };
    inventoryItems: { new: number; existing: number };
    maintenance: { new: number; existing: number };
    problems: { new: number; existing: number };
  };
}
