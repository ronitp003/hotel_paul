"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "./nav-items";
import type { Role } from "@/lib/constants";
import { RoomIcon, NewBookingIcon } from "@/lib/icons";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

import { isNavItemActive } from "./sidebar";

interface MobileNavProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userRole?: Role;
}

export function MobileNav({
  open,
  onOpenChange,
  userRole = "OWNER",
}: MobileNavProps) {
  const pathname = usePathname();

  const filteredItems = NAV_ITEMS.filter((item) =>
    item.roles.includes(userRole)
  );

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

          <nav
            className="flex-1 overflow-y-auto p-3 space-y-1"
            aria-label="Mobile Navigation"
          >
            {filteredItems.map((item) => {
              const Icon = item.icon;
              const isActive = isNavItemActive(pathname, item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => onOpenChange(false)}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground font-semibold shadow-xs"
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
                        : item.highlight
                          ? "text-primary"
                          : "text-muted-foreground"
                    )}
                    aria-hidden="true"
                  />
                  <span>{item.title}</span>
                </Link>
              );
            })}
          </nav>
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
