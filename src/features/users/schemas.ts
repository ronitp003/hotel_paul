import { z } from "zod";
import { ROLES } from "@/lib/constants";

export const createStaffSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(100),
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: z.enum([ROLES.OWNER, ROLES.RECEPTIONIST]).default(ROLES.RECEPTIONIST),
});

export type CreateStaffInput = z.infer<typeof createStaffSchema>;

export const resetPasswordSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
  newPassword: z.string().min(8, "Password must be at least 8 characters"),
});

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export const toggleActiveSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
  isActive: z.boolean(),
});

export type ToggleActiveInput = z.infer<typeof toggleActiveSchema>;
