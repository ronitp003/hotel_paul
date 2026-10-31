"use client";

import Link from "next/link";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatISTDateTime } from "@/lib/datetime";
import { formatINR } from "@/lib/money";
import {
  GuestIcon,
  RoomIcon,
  CalendarIcon,
  ChevronRightIcon,
} from "@/lib/icons";
import type { CalendarBookingEvent } from "@/server/services/calendar.service";

interface BookingDetailDialogProps {
  booking: CalendarBookingEvent | null;
  roomNumber?: string;
  roomTypeName?: string;
  isOpen: boolean;
  onClose: () => void;
}

export function BookingDetailDialog({
  booking,
  roomNumber,
  roomTypeName,
  isOpen,
  onClose,
}: BookingDetailDialogProps) {
  if (!booking) return null;

  const isCheckedIn = booking.status === "CHECKED_IN";
  const isReserved = booking.status === "RESERVED";

  const statusVariant = isCheckedIn
    ? "default"
    : isReserved
    ? "secondary"
    : "outline";

  const statusColorClass = isCheckedIn
    ? "bg-blue-600 hover:bg-blue-600 text-white"
    : isReserved
    ? "bg-amber-500 hover:bg-amber-500 text-white"
    : "bg-slate-500/10 text-muted-foreground border-border";

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="space-y-1">
          <div className="flex items-center justify-between gap-2 pr-6 flex-wrap">
            <span className="font-mono text-xs font-semibold text-muted-foreground tracking-wider">
              {booking.reference}
            </span>
            <div className="flex items-center gap-1.5">
              {booking.groupBookingId && (
                <Badge
                  variant="outline"
                  className="text-[10px] font-bold px-2 py-0.5 bg-primary/10 text-primary border-primary/30"
                >
                  Group
                </Badge>
              )}
              <Badge
                variant={statusVariant}
                className={`text-[11px] font-semibold px-2 py-0.5 ${statusColorClass}`}
              >
                {booking.status}
              </Badge>
            </div>
          </div>
          <DialogTitle className="text-lg font-bold flex items-center gap-2 text-foreground">
            <GuestIcon className="size-5 text-primary shrink-0" />
            <span className="truncate">{booking.primaryGuestName}</span>
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {booking.guestCount > 1
              ? `${booking.guestCount} guests`
              : "Single guest"}{" "}
            {booking.primaryGuestMobile ? `• ${booking.primaryGuestMobile}` : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3.5 py-1 text-sm">
          {/* Room info banner */}
          <div className="flex items-center justify-between p-2.5 rounded-lg border border-border bg-muted/40">
            <div className="flex items-center gap-2">
              <RoomIcon className="size-4 text-muted-foreground" />
              <div>
                <span className="font-bold text-foreground">
                  Room {roomNumber || "—"}
                </span>
                {roomTypeName && (
                  <span className="text-xs text-muted-foreground ml-1.5">
                    ({roomTypeName})
                  </span>
                )}
              </div>
            </div>
            <div className="text-right">
              <span className="text-xs text-muted-foreground">Rate: </span>
              <span className="font-mono font-semibold text-foreground">
                {formatINR(booking.rateApplied)}
              </span>
              <span className="text-[11px] text-muted-foreground">/night</span>
            </div>
          </div>

          {/* Group Rooms Badges (if group reservation) */}
          {booking.groupBookingId &&
            booking.groupRoomNumbers &&
            booking.groupRoomNumbers.length > 1 && (
              <div className="p-2.5 rounded-lg border border-primary/25 bg-primary/5 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-primary flex items-center gap-1.5">
                    <GuestIcon className="size-3.5 text-primary" />
                    All Group Rooms ({booking.groupRoomNumbers.length})
                  </span>
                  <span className="text-[11px] text-muted-foreground font-mono">
                    {booking.groupBookingId}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1 items-center pt-0.5">
                  {booking.groupRoomNumbers.map((rn) => {
                    const isCurrent = rn === (roomNumber || booking.roomId);
                    return (
                      <Badge
                        key={rn}
                        variant="outline"
                        className={`text-[10px] font-mono px-2 py-0.5 ${
                          isCurrent
                            ? "bg-primary text-primary-foreground font-bold border-primary shadow-xs"
                            : "bg-background text-foreground border-border"
                        }`}
                      >
                        Room {rn} {isCurrent ? "(this)" : ""}
                      </Badge>
                    );
                  })}
                </div>
              </div>
            )}

          {/* Timestamps */}
          <div className="grid grid-cols-2 gap-2.5 p-3 rounded-lg border border-border bg-card">
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <CalendarIcon className="size-3.5" />
                <span>Check-in</span>
              </div>
              <p className="font-mono text-xs font-semibold text-foreground">
                {formatISTDateTime(booking.checkInAt)}
              </p>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <CalendarIcon className="size-3.5" />
                <span>Check-out</span>
              </div>
              <p className="font-mono text-xs font-semibold text-foreground">
                {formatISTDateTime(booking.checkOutAt)}
              </p>
            </div>
          </div>

          {/* Financial summary */}
          <div className="p-3 rounded-lg border border-border bg-muted/20 space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Total Charges & Extras</span>
              <span className="font-mono font-medium text-foreground">
                {formatINR(booking.totalCharges)}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Paid so far</span>
              <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                {formatINR(booking.totalPaid)}
              </span>
            </div>
            <div className="pt-1.5 border-t border-border flex items-center justify-between text-xs font-semibold">
              <span className="text-foreground">Balance Due</span>
              <span
                className={`font-mono ${
                  booking.balanceDue > 0
                    ? "text-destructive font-bold"
                    : "text-emerald-600 dark:text-emerald-400"
                }`}
              >
                {formatINR(booking.balanceDue)}
              </span>
            </div>
          </div>

          {/* Corporate / Billing Details if present */}
          {booking.companyName && (
            <div className="p-2.5 rounded-lg border border-border/80 bg-background text-xs">
              <span className="text-muted-foreground">Company: </span>
              <span className="font-semibold text-foreground">
                {booking.companyName}
              </span>
            </div>
          )}
        </div>

        <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-between items-center pt-2">
          <Button variant="outline" size="sm" onClick={onClose} className="w-full sm:w-auto">
            Close
          </Button>
          <Link
            href={`/bookings/${booking.id}`}
            className={cn(buttonVariants({ variant: "default", size: "sm" }), "w-full sm:w-auto gap-1")}
          >
            <span>Manage Booking</span>
            <ChevronRightIcon className="size-4" />
          </Link>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
