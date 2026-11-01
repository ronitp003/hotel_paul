import { z } from "zod";

export const StockLocation = {
  STORE: "STORE",
  ROOMS: "ROOMS",
  LAUNDRY: "LAUNDRY",
  DAMAGED: "DAMAGED",
  DISCONTINUED: "DISCONTINUED",
} as const;

export type StockLocation = (typeof StockLocation)[keyof typeof StockLocation];

export const stockLocationEnum = z.enum([
  "STORE",
  "ROOMS",
  "LAUNDRY",
  "DAMAGED",
  "DISCONTINUED",
]);

export const StockActionType = {
  ADD_STOCK: "ADD_STOCK",
  USE_STOCK: "USE_STOCK",
  MARK_DAMAGED: "MARK_DAMAGED",
  MARK_DISCONTINUED: "MARK_DISCONTINUED",
  RETURN_AVAILABLE: "RETURN_AVAILABLE",
} as const;

export type StockActionType =
  (typeof StockActionType)[keyof typeof StockActionType];

export const createInventoryItemSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Item name is required")
    .max(100, "Item name cannot exceed 100 characters"),
  unit: z
    .string()
    .trim()
    .min(1, "Unit of measure is required")
    .max(20, "Unit cannot exceed 20 characters")
    .default("pcs"),
  reorderLevel: z.coerce
    .number()
    .int("Low stock alert level must be an integer")
    .min(0, "Low stock alert level cannot be negative")
    .optional()
    .default(0),
  initialAvailableStock: z.coerce
    .number()
    .int("Initial available stock must be an integer")
    .min(0, "Initial available stock cannot be negative")
    .optional(),
  initialQtyStore: z.coerce
    .number()
    .int("Store stock must be an integer")
    .min(0, "Store stock cannot be negative")
    .optional(),
});

export type CreateInventoryItemInput = z.infer<typeof createInventoryItemSchema>;

export const updateStockSchema = z.object({
  itemId: z.string().min(1, "Item is required"),
  actionType: z.enum([
    "ADD_STOCK",
    "USE_STOCK",
    "MARK_DAMAGED",
    "MARK_DISCONTINUED",
    "RETURN_AVAILABLE",
  ]),
  quantity: z.coerce
    .number()
    .int("Quantity must be a whole number")
    .positive("Quantity must be at least 1"),
  note: z
    .string()
    .trim()
    .max(255, "Note cannot exceed 255 characters")
    .optional()
    .nullable(),
});

export type UpdateStockInput = z.infer<typeof updateStockSchema>;

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
    from: stockLocationEnum.nullable().optional(),
    to: stockLocationEnum.nullable().optional(),
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
