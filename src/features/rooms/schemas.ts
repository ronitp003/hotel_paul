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
