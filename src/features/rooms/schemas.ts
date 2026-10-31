import { z } from "zod";

export const roomTypeSchema = z.object({
  id: z.string().optional(),
  name: z
    .string()
    .trim()
    .min(1, "Room type name is required")
    .max(100, "Room type name cannot exceed 100 characters"),
});

export type RoomTypeInput = z.infer<typeof roomTypeSchema>;

export const roomSchema = z.object({
  id: z.string().optional(),
  number: z
    .string()
    .trim()
    .min(1, "Room number is required")
    .max(20, "Room number cannot exceed 20 characters"),
  typeId: z.string().min(1, "Room type is required"),
  pricePerNight: z.number().min(0, "Price per night must be at least ₹0"),
  isActive: z.boolean().default(true),
});

export type RoomInput = z.infer<typeof roomSchema>;

export const bulkRoomsSchema = z
  .object({
    prefix: z.string().trim().default(""),
    startNumber: z.number().int().min(1, "Start number must be positive"),
    endNumber: z.number().int().min(1, "End number must be positive"),
    typeId: z.string().min(1, "Room type is required"),
    pricePerNight: z.number().min(0, "Price per night must be at least ₹0"),
    isActive: z.boolean().default(true),
  })
  .refine((data) => data.endNumber >= data.startNumber, {
    message: "End number must be greater than or equal to start number",
    path: ["endNumber"],
  })
  .refine((data) => data.endNumber - data.startNumber + 1 <= 100, {
    message: "Cannot create more than 100 rooms in a single bulk batch",
    path: ["endNumber"],
  });

export type BulkRoomsInput = z.infer<typeof bulkRoomsSchema>;

export const logProblemSchema = z.object({
  roomId: z.string().min(1, "Room is required"),
  severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
  description: z
    .string()
    .trim()
    .min(3, "Description must be at least 3 characters")
    .max(500, "Description cannot exceed 500 characters"),
});

export type LogProblemInput = z.infer<typeof logProblemSchema>;

export const markProblemFixedSchema = z.object({
  problemId: z.string().min(1, "Problem ID is required"),
});

export type MarkProblemFixedInput = z.infer<typeof markProblemFixedSchema>;

export const createMaintenanceSchema = z
  .object({
    roomId: z.string().min(1, "Room is required"),
    startsAt: z.string().min(1, "Start date and time is required"),
    endsAt: z.string().min(1, "End date and time is required"),
    reason: z
      .string()
      .trim()
      .min(3, "Reason must be at least 3 characters")
      .max(500, "Reason cannot exceed 500 characters"),
    confirmOverlap: z.boolean().optional().default(false),
  })
  .refine(
    (data) => {
      const start = new Date(data.startsAt);
      const end = new Date(data.endsAt);
      return !isNaN(start.getTime()) && !isNaN(end.getTime()) && end.getTime() > start.getTime();
    },
    {
      message: "End time must be after start time",
      path: ["endsAt"],
    }
  );

export type CreateMaintenanceInput = z.infer<typeof createMaintenanceSchema>;

export const deleteMaintenanceSchema = z.object({
  maintenanceId: z.string().min(1, "Maintenance ID is required"),
});

export type DeleteMaintenanceInput = z.infer<typeof deleteMaintenanceSchema>;

export const closeMaintenanceSchema = z.object({
  maintenanceId: z.string().min(1, "Maintenance ID is required"),
  completionNote: z
    .string()
    .trim()
    .max(500, "Completion note cannot exceed 500 characters")
    .optional(),
});

export type CloseMaintenanceInput = z.infer<typeof closeMaintenanceSchema>;

