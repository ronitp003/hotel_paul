import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { getSession } from "@/server/auth/session";
import { redirect } from "next/navigation";
import type { Role } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await getSession();

  if (!session || !session.user) {
    redirect("/login");
  }

  const user = session.user as typeof session.user & {
    role?: Role;
    isActive?: boolean;
  };

  if (user.isActive === false) {
    redirect("/login?error=deactivated");
  }

  const currentUser = {
    name: user.name || "Staff",
    email: user.email || "",
    role: (user.role as Role) || "RECEPTIONIST",
  };

  return <AppShell user={currentUser}>{children}</AppShell>;
}
