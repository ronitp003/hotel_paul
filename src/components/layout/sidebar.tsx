"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "./nav-items";
import type { Role } from "@/lib/constants";
import { RoomIcon } from "@/lib/icons";

interface SidebarProps {
  userRole?: Role;
}

export function Sidebar({ userRole = "OWNER" }: SidebarProps) {
  const pathname = usePathname();

  const filteredItems = NAV_ITEMS.filter((item) =>
    item.roles.includes(userRole)
  );

  return (
    <aside className="hidden md:flex flex-col w-16 lg:w-64 border-r border-border bg-card shrink-0 transition-all duration-200">
      {/* Brand Header */}
      <div className="h-16 flex items-center gap-3 px-4 lg:px-6 border-b border-border">
        <div className="size-9 rounded-lg bg-primary text-primary-foreground flex items-center justify-center shrink-0 shadow-xs">
          <RoomIcon className="size-5" aria-hidden="true" />
        </div>
        <div className="hidden lg:flex flex-col min-w-0">
          <span className="font-semibold text-base tracking-tight truncate text-foreground">
            Hotel Desk
          </span>
          <span className="text-[11px] text-muted-foreground truncate">
            Front Desk Operations
          </span>
        </div>
      </div>

      {/* Nav List */}
      <nav className="flex-1 overflow-y-auto p-2 lg:p-3 space-y-1.5" aria-label="Main Navigation">
        {filteredItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname.startsWith(item.href));

          if (item.highlight) {
            return (
              <Link
                key={item.href}
                href={item.href}
                title={item.title}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors shadow-xs justify-center lg:justify-start",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20"
                )}
              >
                <Icon className="size-5 shrink-0" aria-hidden="true" />
                <span className="hidden lg:inline">{item.title}</span>
              </Link>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              title={item.title}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors justify-center lg:justify-start",
                isActive
                  ? "bg-muted text-foreground font-semibold"
                  : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
              )}
            >
              <Icon
                className={cn(
                  "size-5 shrink-0 transition-colors",
                  isActive ? "text-primary" : "text-muted-foreground"
                )}
                aria-hidden="true"
              />
              <span className="hidden lg:inline truncate">{item.title}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer / Property Badge */}
      <div className="p-3 border-t border-border hidden lg:block">
        <div className="px-3 py-2 rounded-lg bg-muted/50 border border-border text-xs text-muted-foreground flex flex-col gap-0.5">
          <span className="font-medium text-foreground">Hotel Paul</span>
          <span>Single Property • Staff Desk</span>
        </div>
      </div>
    </aside>
  );
}
