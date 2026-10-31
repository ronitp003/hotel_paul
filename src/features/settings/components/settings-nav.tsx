"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { SettingsIcon, RoomIcon, GuestIcon } from "@/lib/icons";

interface NavTab {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

const SETTINGS_TABS: NavTab[] = [
  {
    label: "General & Invoicing",
    href: "/settings",
    icon: SettingsIcon,
  },
  {
    label: "Room Types",
    href: "/settings/room-types",
    icon: RoomIcon,
  },
  {
    label: "Users",
    href: "/settings/users",
    icon: GuestIcon,
  },
];

export function SettingsNav() {
  const pathname = usePathname();

  return (
    <div className="flex border-b border-border space-x-1 overflow-x-auto pb-px">
      {SETTINGS_TABS.map((tab) => {
        const Icon = tab.icon;
        const isActive =
          tab.href === "/settings"
            ? pathname === "/settings"
            : pathname.startsWith(tab.href);

        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
              isActive
                ? "border-primary text-foreground font-semibold"
                : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30"
            )}
          >
            <Icon className="h-4 w-4" />
            <span>{tab.label}</span>
          </Link>
        );
      })}
    </div>
  );
}
