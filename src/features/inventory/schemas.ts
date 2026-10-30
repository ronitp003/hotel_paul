import { z } from "zod";
import { StockLocation } from "@prisma/client";

export { StockLocation };

export const createInventoryItemSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Item name is required")
    .max(100, "Item name cannot exceed 100 characters"),
  unit: z
    .string()
    .trim()
    .min(1, "Unit is required")
    .max(20, "Unit cannot exceed 20 characters")
    .default("pcs"),
  reorderLevel: z.coerce
    .number()
    .int("Reorder level must be an integer")
    .min(0, "Reorder level cannot be negative")
    .default(0),
  initialQtyStore: z.coerce
    .number()
    .int("Store stock must be an integer")
    .min(0, "Store stock cannot be negative")
    .default(0),
});

export type CreateInventoryItemInput = z.infer<typeof createInventoryItemSchema>;

export const updateInventoryItemSchema = z.object({
  id: z.string().min(1, "Item ID is required"),
  name: z
    .string()
    .trim()
    .min(1, "Item name is required")
    .max(100, "Item name cannot exceed 100 characters"),
  unit: z
    .string()
    .trim()
    .min(1, "Unit is required")
    .max(20, "Unit cannot exceed 20 characters"),
  reorderLevel: z.coerce
    .number()
    .int("Reorder level must be an integer")
    .min(0, "Reorder level cannot be negative"),
  isActive: z.boolean().default(true),
});

export type UpdateInventoryItemInput = z.infer<typeof updateInventoryItemSchema>;

export const moveStockSchema = z
  .object({
    itemId: z.string().min(1, "Item is required"),
    from: z.nativeEnum(StockLocation).nullable().optional(),
    to: z.nativeEnum(StockLocation).nullable().optional(),
    quantity: z.coerce
      .number()
      .int("Quantity must be an integer")
      .positive("Quantity must be at least 1"),
    note: z
      .string()
      .trim()
      .max(255, "Note cannot exceed 255 characters")
      .optional()
      .nullable(),
  })
  .refine(
    (data) => data.from !== null || data.to !== null,
    {
      message: "At least one source or destination location must be specified.",
      path: ["to"],
    }
  )
  .refine(
    (data) => !data.from || !data.to || data.from !== data.to,
    {
      message: "Source and destination locations cannot be the same.",
      path: ["to"],
    }
  );

export type MoveStockInput = z.infer<typeof moveStockSchema>;

export const getItemHistorySchema = z.object({
  itemId: z.string().min(1, "Item ID is required"),
});

export type GetItemHistoryInput = z.infer<typeof getItemHistorySchema>;

export const toggleInventoryItemActiveSchema = z.object({
  id: z.string().min(1, "Item ID is required"),
  isActive: z.boolean(),
});

export type ToggleInventoryItemActiveInput = z.infer<
  typeof toggleInventoryItemActiveSchema
>;
