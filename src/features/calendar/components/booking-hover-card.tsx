"use client";

import * as React from "react";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import {
  GuestIcon,
  RoomIcon,
  CalendarIcon,
  CircleAlertIcon,
} from "@/lib/icons";
import { formatISTDateTime } from "@/lib/datetime";
import { formatINR } from "@/lib/money";
import type {
  CalendarBookingEvent,
  CalendarRoomItem,
} from "@/server/services/calendar.service";

interface BookingHoverCardProps {
  booking: CalendarBookingEvent;
  room?: CalendarRoomItem;
  children: React.ReactElement<React.HTMLAttributes<HTMLElement>>;
}

export function BookingHoverCard({
  booking,
  room,
  children,
}: BookingHoverCardProps) {
  const isCheckedIn = booking.status === "CHECKED_IN";
  const isReserved = booking.status === "RESERVED";

  const statusLabel = isCheckedIn
    ? "Checked In"
    : isReserved
    ? "Reserved"
    : "Checked Out";

  const statusBadgeClass = isCheckedIn
    ? "bg-blue-600 text-white"
    : isReserved
    ? "bg-amber-500 text-white"
    : "bg-slate-500/15 text-muted-foreground";

  return (
    <Tooltip>
      <TooltipTrigger delay={150} render={children} />
      <TooltipContent
        side="top"
        align="center"
        sideOffset={8}
        className="w-80 p-3.5 space-y-3 z-50 shadow-2xl bg-popover/95 backdrop-blur-md border border-border rounded-xl text-xs select-none"
      >
        {/* Header: Reference + Status */}
        <div className="flex items-center justify-between gap-2 border-b border-border/60 pb-2">
          <span className="font-mono text-[11px] font-semibold text-muted-foreground tracking-wide">
            {booking.reference}
          </span>
          <Badge
            variant="outline"
            className={`text-[10px] font-semibold px-2 py-0.5 border-transparent ${statusBadgeClass}`}
          >
            {statusLabel}
          </Badge>
        </div>

        {/* Guest Details */}
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <GuestIcon className="size-4 text-primary shrink-0" />
            <span className="font-bold text-sm text-foreground truncate">
              {booking.primaryGuestName}
            </span>
          </div>
          <div className="text-[11px] text-muted-foreground pl-6 flex flex-wrap items-center gap-x-2">
            <span>
              {booking.guestCount} {booking.guestCount === 1 ? "guest" : "guests"}
            </span>
            {booking.primaryGuestMobile && (
              <>
                <span>•</span>
                <span className="font-mono">{booking.primaryGuestMobile}</span>
              </>
            )}
          </div>
        </div>

        {/* Room Info */}
        <div className="flex items-center justify-between bg-muted/40 rounded-lg p-2 border border-border/50">
          <div className="flex items-center gap-2">
            <RoomIcon className="size-4 text-muted-foreground shrink-0" />
            <div>
              <span className="font-bold text-foreground">
                Room {room?.number || booking.roomId}
              </span>
              {room?.typeName && (
                <span className="text-muted-foreground ml-1.5">
                  ({room.typeName})
                </span>
              )}
            </div>
          </div>
          {room?.pricePerNight && (
            <span className="font-mono font-semibold text-foreground">
              {formatINR(room.pricePerNight)}/night
            </span>
          )}
        </div>

        {/* Open Problem Alert on Room */}
        {room?.hasOpenProblem && (
          <div className="flex items-center gap-2 p-2 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-[11px] font-medium">
            <CircleAlertIcon className="size-3.5 shrink-0 animate-pulse text-destructive" />
            <span>Problem reported on this room</span>
          </div>
        )}

        {/* Dates & Times */}
        <div className="space-y-1.5 text-[11px] bg-muted/20 rounded-lg p-2 border border-border/40">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <CalendarIcon className="size-3" /> Check-in:
            </span>
            <span className="font-medium text-foreground">
              {formatISTDateTime(booking.checkInAt)}
            </span>
          </div>
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <CalendarIcon className="size-3" /> Check-out:
            </span>
            <span className="font-medium text-foreground">
              {formatISTDateTime(booking.checkOutAt)}
            </span>
          </div>
        </div>

        {/* Financials & Balance */}
        <div className="flex items-center justify-between pt-1 border-t border-border/50 text-[11px]">
          <div className="text-muted-foreground">
            <span>Paid: </span>
            <span className="font-mono font-semibold text-foreground">
              {formatINR(booking.totalPaid)}
            </span>
          </div>
          <div>
            {booking.balanceDue > 0 ? (
              <span className="inline-flex items-center gap-1 font-mono font-bold text-red-600 dark:text-red-400 bg-red-500/10 px-2 py-0.5 rounded-md border border-red-500/20">
                Due {formatINR(booking.balanceDue)}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                Paid in Full
              </span>
            )}
          </div>
        </div>

        {/* Click hint */}
        <div className="text-[10px] text-center text-muted-foreground/80 pt-0.5 font-medium">
          Click booking to view details & actions
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
