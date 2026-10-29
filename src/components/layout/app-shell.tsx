"use client";

import { useState, type ReactNode } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { MobileNav } from "@/components/layout/mobile-nav";
import type { Role } from "@/lib/constants";

interface AppShellProps {
  children: ReactNode;
  userRole?: Role;
}

export function AppShell({ children, userRole = "OWNER" }: AppShellProps) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      {/* Desktop & Tablet Sidebar */}
      <Sidebar userRole={userRole} />

      {/* Main Column */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* Topbar */}
        <Topbar
          onMobileMenuOpen={() => setMobileNavOpen(true)}
          user={{
            name: "Front Desk Staff",
            email: "staff@hotelpaul.in",
            role: userRole,
          }}
        />

        {/* Content View */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <div className="max-w-screen-2xl w-full mx-auto space-y-6">
            {children}
          </div>
        </main>
      </div>

      {/* Mobile Nav Drawer & FAB */}
      <MobileNav
        open={mobileNavOpen}
        onOpenChange={setMobileNavOpen}
        userRole={userRole}
      />
    </div>
  );
}
