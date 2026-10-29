import "server-only";
import { headers } from "next/headers";
import { auth } from "./auth";
import { AppError } from "@/lib/errors";
import type { Role } from "@/lib/constants";

export interface Actor {
  id: string;
  name: string;
  email: string;
  role: Role;
  isActive: boolean;
}

export async function getSession() {
  const reqHeaders = await headers();
  return auth.api.getSession({
    headers: reqHeaders,
  });
}

export async function requireSession(): Promise<{ actor: Actor }> {
  const session = await getSession();

  if (!session || !session.user) {
    throw new AppError(
      "UNAUTHORIZED",
      "You must be logged in to perform this action"
    );
  }

  const user = session.user as typeof session.user & {
    role?: string;
    isActive?: boolean;
  };

  const role = (user.role as Role) || "RECEPTIONIST";
  const isActive = user.isActive !== false;

  if (!isActive) {
    throw new AppError("FORBIDDEN", "Your staff account has been deactivated");
  }

  return {
    actor: {
      id: user.id,
      name: user.name,
      email: user.email,
      role,
      isActive,
    },
  };
}
