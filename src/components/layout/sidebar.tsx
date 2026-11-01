"use client";

import { Suspense } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "./nav-items";
import type { Role } from "@/lib/constants";
import { RoomIcon, SpinnerIcon } from "@/lib/icons";
import { useNavigationState } from "@/providers/navigation-provider";

interface SidebarProps {
  userRole?: Role;
}

export function isNavItemActive(
  pathname: string,
  itemHref: string,
  currentQuery?: string | URLSearchParams | null
): boolean {
  let actualPathname = pathname;
  let searchParamsObj: URLSearchParams;

  if (pathname.includes("?")) {
    const [p, q] = pathname.split("?");
    actualPathname = p;
    searchParamsObj = new URLSearchParams(q);
  } else if (typeof currentQuery === "string") {
    searchParamsObj = new URLSearchParams(currentQuery);
  } else if (currentQuery && typeof (currentQuery as URLSearchParams).get === "function") {
    searchParamsObj = currentQuery as URLSearchParams;
  } else {
    searchParamsObj = new URLSearchParams();
  }

  const [baseHref, itemQueryStr] = itemHref.split("?");

  if (baseHref === "/dashboard") {
    return actualPathname === "/dashboard" || actualPathname === "/";
  }

  // Bookings list route must not match /bookings/new
  if (baseHref === "/bookings" && actualPathname.startsWith("/bookings/new")) {
    return false;
  }

  // Exact base route match
  if (actualPathname === baseHref) {
    if (itemQueryStr) {
      const itemParams = new URLSearchParams(itemQueryStr);
      for (const [key, val] of itemParams.entries()) {
        if (searchParamsObj.get(key) !== val) {
          return false;
        }
      }
      return true;
    }

    // Item has NO query string (e.g. /register)
    // If the current query has a tab parameter pointing to another item (like tab=analytics), do not match
    if (searchParamsObj.get("tab") === "analytics") {
      return false;
    }

    return true;
  }

  // Match nested subroutes (e.g. /settings/room-types matches /settings)
  if (actualPathname.startsWith(`${baseHref}/`)) {
    return true;
  }

  return false;
}

function SidebarNavList({ userRole }: { userRole: Role }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { isNavigating, targetPath } = useNavigationState();

  const filteredItems = NAV_ITEMS.filter((item) =>
    item.roles.includes(userRole)
  );

  return (
    <nav
      className="flex-1 overflow-y-auto p-2 lg:p-3 space-y-1.5"
      aria-label="Main Navigation"
    >
      {filteredItems.map((item) => {
        const Icon = item.icon;
        const isActive = isNavItemActive(pathname, item.href, searchParams);
        const isPending =
          isNavigating &&
          targetPath !== null &&
          isNavItemActive(targetPath, item.href) &&
          !isActive;

        return (
          <Link
            key={item.href}
            href={item.href}
            title={item.title}
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors justify-center lg:justify-start relative",
              isActive
                ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                : isPending
                ? "bg-primary/15 text-primary font-semibold border border-primary/30"
                : item.highlight
                ? "bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20"
                : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
            )}
          >
            <Icon
              className={cn(
                "size-5 shrink-0 transition-colors",
                isActive
                  ? "text-primary-foreground"
                  : isPending
                  ? "text-primary animate-pulse"
                  : item.highlight
                  ? "text-primary"
                  : "text-muted-foreground"
              )}
              aria-hidden="true"
            />
            <span className="hidden lg:inline truncate">{item.title}</span>

            {/* Subtle spinner indicator on pending transition */}
            {isPending && (
              <SpinnerIcon className="size-3.5 text-primary animate-spin shrink-0 hidden lg:inline ml-auto" />
            )}
          </Link>
        );
      })}
    </nav>
  );
}

export function Sidebar({ userRole = "OWNER" }: SidebarProps) {
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

      {/* Nav List with Suspense for safe query param reading */}
      <Suspense fallback={<div className="flex-1 p-2 lg:p-3" />}>
        <SidebarNavList userRole={userRole} />
      </Suspense>

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
