"use client";

import { Suspense } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "./nav-items";
import type { Role } from "@/lib/constants";
import { RoomIcon, NewBookingIcon, SpinnerIcon } from "@/lib/icons";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

import { isNavItemActive } from "./sidebar";
import { useNavigationState } from "@/providers/navigation-provider";

interface MobileNavProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userRole?: Role;
}

function MobileNavList({
  userRole,
  onClose,
}: {
  userRole: Role;
  onClose: () => void;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { isNavigating, targetPath } = useNavigationState();

  const filteredItems = NAV_ITEMS.filter((item) =>
    item.roles.includes(userRole)
  );

  return (
    <nav
      className="flex-1 overflow-y-auto p-3 space-y-1"
      aria-label="Mobile Navigation"
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
            onClick={onClose}
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
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
            <span className="flex-1 truncate">{item.title}</span>
            {isPending && (
              <SpinnerIcon className="size-3.5 text-primary animate-spin shrink-0 ml-auto" />
            )}
          </Link>
        );
      })}
    </nav>
  );
}

export function MobileNav({
  open,
  onOpenChange,
  userRole = "OWNER",
}: MobileNavProps) {
  return (
    <>
      {/* Mobile Drawer (Sheet) */}
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="left" className="w-72 p-0 flex flex-col">
          <SheetHeader className="p-4 border-b border-border flex flex-row items-center gap-3">
            <div className="size-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center shrink-0">
              <RoomIcon className="size-4" aria-hidden="true" />
            </div>
            <SheetTitle className="text-base font-semibold">
              Hotel Desk
            </SheetTitle>
          </SheetHeader>

          <Suspense fallback={<div className="flex-1 p-3" />}>
            <MobileNavList
              userRole={userRole}
              onClose={() => onOpenChange(false)}
            />
          </Suspense>
        </SheetContent>
      </Sheet>

      {/* Floating Action Button (FAB) on phone (<768px) */}
      <div className="md:hidden fixed bottom-5 right-5 z-40">
        <Link
          href="/bookings/new"
          className="size-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:bg-primary/90 active:scale-95 transition-transform"
          aria-label="New Booking"
        >
          <NewBookingIcon className="size-6" aria-hidden="true" />
        </Link>
      </div>
    </>
  );
}
