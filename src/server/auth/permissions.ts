import "server-only";
import { requireSession, type Actor } from "./session";
import { AppError } from "@/lib/errors";
import { ROLES, type Role } from "@/lib/constants";

export type PermissionAction =
  | "booking.create"
  | "booking.checkIn"
  | "booking.checkOut"
  | "booking.cancel"
  | "booking.view"
  | "payment.add"
  | "payment.refund"
  | "payment.view"
  | "invoice.view"
  | "invoice.download"
  | "invoice.cancel"
  | "invoice.correct"
  | "room.problem"
  | "room.maintenance"
  | "room.create"
  | "room.edit"
  | "room.bulkAdd"
  | "inventory.view"
  | "inventory.move"
  | "inventory.manage"
  | "settings.view"
  | "settings.update"
  | "users.view"
  | "users.create"
  | "users.deactivate"
  | "users.resetPassword"
  | "register.view"
  | "analytics.view"
  | "data.export"
  | "data.import"
  | "data.backup";

/**
 * Single source of truth permission matrix per PROJECT_STRUCTURE.md §5
 */
const PERMISSION_MATRIX: Record<PermissionAction, Role[]> = {
  // Bookings & Front Desk
  "booking.create": [ROLES.OWNER, ROLES.RECEPTIONIST],
  "booking.checkIn": [ROLES.OWNER, ROLES.RECEPTIONIST],
  "booking.checkOut": [ROLES.OWNER, ROLES.RECEPTIONIST],
  "booking.cancel": [ROLES.OWNER, ROLES.RECEPTIONIST],
  "booking.view": [ROLES.OWNER, ROLES.RECEPTIONIST],

  // Payments & Invoices
  "payment.add": [ROLES.OWNER, ROLES.RECEPTIONIST],
  "payment.refund": [ROLES.OWNER, ROLES.RECEPTIONIST],
  "payment.view": [ROLES.OWNER, ROLES.RECEPTIONIST],
  "invoice.view": [ROLES.OWNER, ROLES.RECEPTIONIST],
  "invoice.download": [ROLES.OWNER, ROLES.RECEPTIONIST],
  "invoice.cancel": [ROLES.OWNER],
  "invoice.correct": [ROLES.OWNER],

  // Rooms, Maintenance & Problems
  "room.problem": [ROLES.OWNER, ROLES.RECEPTIONIST],
  "room.maintenance": [ROLES.OWNER, ROLES.RECEPTIONIST],
  "room.create": [ROLES.OWNER],
  "room.edit": [ROLES.OWNER],
  "room.bulkAdd": [ROLES.OWNER],

  // Inventory
  "inventory.view": [ROLES.OWNER, ROLES.RECEPTIONIST],
  "inventory.move": [ROLES.OWNER, ROLES.RECEPTIONIST],
  "inventory.manage": [ROLES.OWNER, ROLES.RECEPTIONIST],

  // Settings & Users (OWNER only)
  "settings.view": [ROLES.OWNER],
  "settings.update": [ROLES.OWNER],
  "users.view": [ROLES.OWNER],
  "users.create": [ROLES.OWNER],
  "users.deactivate": [ROLES.OWNER],
  "users.resetPassword": [ROLES.OWNER],

  // Register, Analytics & Data (OWNER only)
  "register.view": [ROLES.OWNER],
  "analytics.view": [ROLES.OWNER],
  "data.export": [ROLES.OWNER],
  "data.import": [ROLES.OWNER],
  "data.backup": [ROLES.OWNER],
};

/**
 * Pure authorization check function for role and action.
 */
export function can(role: Role, action: PermissionAction): boolean {
  const allowed = PERMISSION_MATRIX[action];
  if (!allowed) return false;
  return allowed.includes(role);
}

/**
 * Server-side guard: Verifies active session and checks allowed roles.
 * Throws AppError("UNAUTHORIZED") if not logged in, or AppError("FORBIDDEN") if not allowed.
 */
export async function requireRole(allowedRoles: Role[]): Promise<Actor> {
  const { actor } = await requireSession();

  if (!allowedRoles.includes(actor.role)) {
    throw new AppError(
      "FORBIDDEN",
      `Access denied. Required role: ${allowedRoles.join(" or ")}, but your role is ${actor.role}.`
    );
  }

  return actor;
}

/**
 * Server-side guard: Verifies active session and checks action permission.
 */
export async function requirePermission(
  action: PermissionAction
): Promise<Actor> {
  const { actor } = await requireSession();

  if (!can(actor.role, action)) {
    throw new AppError(
      "FORBIDDEN",
      `Access denied. You do not have permission to perform '${action}'.`
    );
  }

  return actor;
}
