"use client";

import Link from "next/link";
import { formatISTTime } from "@/lib/datetime";
import { MoneyText } from "@/components/shared/money-text";
import { StatusBadge } from "@/components/shared/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckInIcon, CheckOutIcon, ChevronRightIcon, RoomIcon, ClockIcon } from "@/lib/icons";
import { cn } from "@/lib/utils";
import type { TodayGuestMovement } from "@/features/dashboard/schemas";

interface MovementsProps {
  arrivingToday: TodayGuestMovement[];
  departingToday: TodayGuestMovement[];
}

/**
 * Departing Today panel designed for the right-column of the main operational section.
 * Has a fixed header and internal scrolling so the page height never expands.
 */
export function DepartingTodayCard({
  departures,
  className,
}: {
  departures: TodayGuestMovement[];
  className?: string;
}) {
  return (
    <Card className={cn("flex flex-col shadow-xs border-border/80 overflow-hidden", className)}>
      {/* Fixed Header */}
      <CardHeader className="p-3.5 sm:px-4 pb-3 flex flex-row items-center justify-between shrink-0 border-b border-border/60">
        <div className="space-y-0.5">
          <CardTitle className="text-base font-semibold flex items-center gap-2 text-foreground tracking-tight">
            <CheckOutIcon className="size-4 text-primary shrink-0" aria-hidden="true" />
            <span>Departing Today</span>
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            {departures.length} scheduled check-out{departures.length === 1 ? "" : "s"}
          </p>
        </div>
        <Link href="/bookings?status=CHECKED_IN">
          <Button
            variant="outline"
            size="sm"
            className="text-xs h-7 px-2.5 font-medium gap-1 text-muted-foreground hover:text-foreground hover:bg-muted"
          >
            <span>View all</span>
            <ChevronRightIcon className="size-3" aria-hidden="true" />
          </Button>
        </Link>
      </CardHeader>

      {/* Internally Scrollable Guest List with Subtle Scrollbar */}
      <CardContent className="p-0 flex-1 min-h-0 overflow-y-auto">
        {departures.length === 0 ? (
          <div className="p-6 text-center text-xs text-muted-foreground flex flex-col items-center justify-center h-full min-h-[220px]">
            No check-outs scheduled for today.
          </div>
        ) : (
          <div className="divide-y divide-border/60">
            {departures.map((booking) => (
              <div
                key={booking.id}
                className="p-3 px-3.5 sm:px-4 flex items-center justify-between gap-3 hover:bg-muted/40 transition-colors"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-xs sm:text-sm text-foreground truncate">
                      {booking.guestName}
                    </span>
                    <StatusBadge status={booking.status} className="text-[10px] py-0 px-1.5 shrink-0" />
                  </div>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1 font-medium text-foreground">
                      <RoomIcon className="size-3 text-primary shrink-0" aria-hidden="true" />
                      Room {booking.roomNumber}
                    </span>
                    <span className="hidden sm:inline opacity-40">•</span>
                    <span className="flex items-center gap-1">
                      <ClockIcon className="size-3 shrink-0 opacity-70" aria-hidden="true" />
                      <span>{formatISTTime(booking.time)}</span>
                    </span>
                    {booking.balanceDue > 0 && (
                      <>
                        <span className="opacity-40">•</span>
                        <span className="text-destructive font-semibold">
                          Due: <MoneyText amount={booking.balanceDue} />
                        </span>
                      </>
                    )}
                  </div>
                </div>

                <Link href={`/bookings/${booking.id}`} className="shrink-0">
                  <Button
                    variant={booking.status === "CHECKED_IN" ? "default" : "outline"}
                    size="sm"
                    className="text-xs h-7 px-2.5 font-semibold"
                  >
                    {booking.status === "CHECKED_IN" ? "Check Out" : "Invoice"}
                  </Button>
                </Link>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Full-width Arriving Today section positioned directly below Room Board & Departing Today.
 * Displays today's expected arrivals in a clean, compact row-based layout.
 */
export function ArrivingTodayCard({
  arrivals,
  className,
}: {
  arrivals: TodayGuestMovement[];
  className?: string;
}) {
  return (
    <Card className={cn("shadow-xs border-border/80 overflow-hidden w-full", className)}>
      <CardHeader className="p-2.5 sm:px-3 pb-2 flex flex-row items-center justify-between border-b border-border/60">
        <div className="space-y-0.5">
          <CardTitle className="text-base font-semibold flex items-center gap-2 text-foreground tracking-tight">
            <CheckInIcon className="size-4 text-primary shrink-0" aria-hidden="true" />
            <span>Arriving Today</span>
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            {arrivals.length} scheduled check-in{arrivals.length === 1 ? "" : "s"}
          </p>
        </div>
        <Link href="/bookings?status=RESERVED">
          <Button
            variant="outline"
            size="sm"
            className="text-xs h-6.5 px-2 font-medium gap-1 text-muted-foreground hover:text-foreground hover:bg-muted"
          >
            <span>View all</span>
            <ChevronRightIcon className="size-3" aria-hidden="true" />
          </Button>
        </Link>
      </CardHeader>

      <CardContent className="p-0">
        {arrivals.length === 0 ? (
          <div className="p-8 text-center text-xs text-muted-foreground flex flex-col items-center justify-center">
            No check-ins scheduled for today.
          </div>
        ) : (
          <div className="divide-y divide-border/60">
            {arrivals.map((booking) => (
              <div
                key={booking.id}
                className="p-2.5 sm:px-3 flex items-center justify-between gap-3 hover:bg-muted/40 transition-colors"
              >
                {/* Guest Details, Contact & Room Information */}
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                    <span className="font-semibold text-xs text-foreground truncate">
                      {booking.guestName}
                    </span>
                    <StatusBadge status={booking.status} className="text-[10px] py-0 px-1.5 shrink-0" />
                    {booking.guestMobile ? (
                      <span className="text-[11px] text-muted-foreground font-mono">
                        {booking.guestMobile}
                      </span>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1 font-medium text-foreground">
                      <RoomIcon className="size-3 text-primary shrink-0" aria-hidden="true" />
                      Room {booking.roomNumber}
                      {booking.roomTypeName ? (
                        <span className="text-[11px] text-muted-foreground font-normal">
                          ({booking.roomTypeName})
                        </span>
                      ) : null}
                    </span>
                    <span className="opacity-40">•</span>
                    <span className="flex items-center gap-1">
                      <ClockIcon className="size-3 shrink-0 opacity-70" aria-hidden="true" />
                      <span>Exp {formatISTTime(booking.time)}</span>
                    </span>
                  </div>
                </div>

                {/* Action Button */}
                <Link href={`/bookings/${booking.id}`} className="shrink-0">
                  <Button
                    variant={booking.status === "RESERVED" ? "default" : "outline"}
                    size="sm"
                    className="text-xs h-7 px-2.5 font-semibold"
                  >
                    {booking.status === "RESERVED" ? "Check In" : "Details"}
                  </Button>
                </Link>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function ArrivalsDeparturesTables({
  arrivingToday,
  departingToday,
}: MovementsProps) {
  return (
    <div className="space-y-6">
      <DepartingTodayCard departures={departingToday} />
      <ArrivingTodayCard arrivals={arrivingToday} />
    </div>
  );
}
