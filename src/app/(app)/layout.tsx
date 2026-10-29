import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/app-shell";

export default function AppLayout({ children }: { children: ReactNode }) {
  // In Phase 1, actor/session check will populate the user and role
  return <AppShell userRole="OWNER">{children}</AppShell>;
}
