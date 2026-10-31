"use client";

import Link from "next/link";
import { formatISTTime } from "@/lib/datetime";
import { MoneyText } from "@/components/shared/money-text";
import { StatusBadge } from "@/components/shared/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckInIcon, CheckOutIcon, ChevronRightIcon, RoomIcon } from "@/lib/icons";
import { cn } from "@/lib/utils";
import type { TodayGuestMovement } from "@/features/dashboard/schemas";

interface MovementsProps {
  arrivingToday: TodayGuestMovement[];
  departingToday: TodayGuestMovement[];
}

export function DepartingTodayCard({
  departures,
  className,
}: {
  departures: TodayGuestMovement[];
  className?: string;
}) {
  return (
    <Card className={cn("flex flex-col shadow-xs border-border/80 overflow-hidden", className)}>
      <CardHeader className="flex flex-row items-center justify-between pb-3 shrink-0 border-b border-border/50">
        <div className="space-y-0.5">
          <CardTitle className="text-base font-semibold flex items-center gap-2 text-foreground">
            <CheckOutIcon className="size-4 text-primary" aria-hidden="true" />
            <span>Departing Today</span>
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            {departures.length} scheduled check-out{departures.length === 1 ? "" : "s"}
          </p>
        </div>
        <Link href="/bookings?status=CHECKED_IN">
          <Button variant="ghost" size="sm" className="text-xs gap-1 h-8">
            <span>View all</span>
            <ChevronRightIcon className="size-3.5" aria-hidden="true" />
          </Button>
        </Link>
      </CardHeader>
      <CardContent className="p-0 flex-1 min-h-0 overflow-y-auto">
        {departures.length === 0 ? (
          <div className="p-6 text-center text-xs text-muted-foreground flex flex-col items-center justify-center h-full min-h-[180px]">
            No check-outs scheduled for today.
          </div>
        ) : (
          <div className="divide-y divide-border/60">
            {departures.map((booking) => (
              <div
                key={booking.id}
                className="p-3 px-4 flex items-center justify-between gap-3 hover:bg-muted/40 transition-colors"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-xs sm:text-sm text-foreground truncate">
                      {booking.guestName}
                    </span>
                    <StatusBadge status={booking.status} className="text-[10px] py-0 px-1.5" />
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1 font-medium">
                      <RoomIcon className="size-3 text-primary" aria-hidden="true" />
                      Room {booking.roomNumber}
                    </span>
                    <span>•</span>
                    <span>Scheduled {formatISTTime(booking.time)}</span>
                    {booking.balanceDue > 0 && (
                      <>
                        <span>•</span>
                        <span className="text-destructive font-medium">
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

export function ArrivingTodayCard({
  arrivals,
  className,
}: {
  arrivals: TodayGuestMovement[];
  className?: string;
}) {
  return (
    <Card className={cn("shadow-xs border-border/80 overflow-hidden", className)}>
      <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-border/50">
        <div className="space-y-0.5">
          <CardTitle className="text-base font-semibold flex items-center gap-2 text-foreground">
            <CheckInIcon className="size-4 text-primary" aria-hidden="true" />
            <span>Arriving Today</span>
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            {arrivals.length} scheduled check-in{arrivals.length === 1 ? "" : "s"}
          </p>
        </div>
        <Link href="/bookings?status=RESERVED">
          <Button variant="ghost" size="sm" className="text-xs gap-1 h-8">
            <span>View all</span>
            <ChevronRightIcon className="size-3.5" aria-hidden="true" />
          </Button>
        </Link>
      </CardHeader>
      <CardContent className="p-0">
        {arrivals.length === 0 ? (
          <div className="p-6 text-center text-xs text-muted-foreground">
            No check-ins scheduled for today.
          </div>
        ) : (
          <div className="divide-y divide-border/60">
            {arrivals.map((booking) => (
              <div
                key={booking.id}
                className="p-3 px-4 flex items-center justify-between gap-3 hover:bg-muted/40 transition-colors"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-xs sm:text-sm text-foreground truncate">
                      {booking.guestName}
                    </span>
                    <StatusBadge status={booking.status} className="text-[10px] py-0 px-1.5" />
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1 font-medium">
                      <RoomIcon className="size-3 text-primary" aria-hidden="true" />
                      Room {booking.roomNumber}
                    </span>
                    <span>•</span>
                    <span>Scheduled {formatISTTime(booking.time)}</span>
                  </div>
                </div>

                <Link href={`/bookings/${booking.id}`} className="shrink-0">
                  <Button variant="outline" size="sm" className="text-xs h-7 px-2.5">
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
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <ArrivingTodayCard arrivals={arrivingToday} />
      <DepartingTodayCard departures={departingToday} />
    </div>
  );
}
