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
