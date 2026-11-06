
"use client";

import Link from "next/link";

import { formatISTTime } from "@/lib/datetime";
import { MoneyText } from "@/components/shared/money-text";
import { StatusBadge } from "@/components/shared/status-badge";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { Button } from "@/components/ui/button";

import {
  CheckInIcon,
  CheckOutIcon,
  ChevronRightIcon,
  RoomIcon,
  ClockIcon,
} from "@/lib/icons";

import { cn } from "@/lib/utils";
import type { TodayGuestMovement } from "@/features/dashboard/schemas";

interface MovementsProps {
  arrivingToday: TodayGuestMovement[];
  departingToday: TodayGuestMovement[];
}

// ======================================================
// Shared styling
// ======================================================

const cardClass =
  "min-w-0 overflow-hidden border-border/70 shadow-xs";

const headerClass =
  "flex shrink-0 flex-row items-center justify-between gap-3 border-b border-border/60 p-4 sm:px-5";

const titleClass =
  "flex items-center gap-2 text-sm font-semibold tracking-tight text-foreground sm:text-base";

const subtitleClass =
  "text-xs text-muted-foreground";

const viewAllButtonClass =
  "h-8 shrink-0 gap-1 px-2.5 text-xs font-medium text-muted-foreground";

const rowClass =
  "flex flex-col gap-3 p-3.5 transition-colors hover:bg-muted/30 sm:flex-row sm:items-center sm:justify-between sm:px-5";

const detailsClass =
  "min-w-0 flex-1 space-y-1.5";

const metadataClass =
  "flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-muted-foreground";

const actionButtonClass =
  "h-8 w-full shrink-0 px-3 text-xs font-semibold sm:w-auto";

// ======================================================
// Shared card header
// ======================================================

function MovementHeader({
  type,
  count,
  href,
}: {
  type: "arriving" | "departing";
  count: number;
  href: string;
}) {
  const isArriving = type === "arriving";

  const title = isArriving ? "Arriving Today" : "Departing Today";

  const Icon = isArriving ? CheckInIcon : CheckOutIcon;

  const actionLabel = isArriving ? "check-in" : "check-out";

  return (
    <CardHeader className={headerClass}>
      <div className="min-w-0 space-y-1">
        <CardTitle className={titleClass}>
          <Icon
            className="size-4 shrink-0 text-primary"
            aria-hidden="true"
          />
          <span>{title}</span>
        </CardTitle>

        <p className={subtitleClass}>
          {count} scheduled {actionLabel}
          {count === 1 ? "" : "s"}
        </p>
      </div>

      <Link href={href} className="shrink-0">
        <Button
          variant="outline"
          size="sm"
          className={viewAllButtonClass}
        >
          View all
          <ChevronRightIcon
            className="size-3.5"
            aria-hidden="true"
          />
        </Button>
      </Link>
    </CardHeader>
  );
}

// ======================================================
// Shared empty state
// ======================================================

function EmptyMovementState({
  type,
}: {
  type: "arriving" | "departing";
}) {
  const isArriving = type === "arriving";

  return (
    <div className="flex min-h-[150px] flex-col items-center justify-center gap-2 px-4 py-8 text-center sm:min-h-[180px]">
      <div className="flex size-9 items-center justify-center rounded-full bg-muted">
        {isArriving ? (
          <CheckInIcon
            className="size-4 text-muted-foreground"
            aria-hidden="true"
          />
        ) : (
          <CheckOutIcon
            className="size-4 text-muted-foreground"
            aria-hidden="true"
          />
        )}
      </div>

      <p className="text-sm font-medium text-foreground">
        No {isArriving ? "arrivals" : "departures"} today
      </p>

      <p className="text-xs text-muted-foreground">
        No {isArriving ? "check-ins" : "check-outs"} scheduled for today.
      </p>
    </div>
  );
}

// ======================================================
// Shared room and time metadata
// ======================================================

function RoomTimeDetails({
  booking,
  showRoomType = false,
}: {
  booking: TodayGuestMovement;
  showRoomType?: boolean;
}) {
  return (
    <div className={metadataClass}>
      <span className="inline-flex items-center gap-1 font-medium text-foreground">
        <RoomIcon
          className="size-3.5 shrink-0 text-primary"
          aria-hidden="true"
        />

        <span>Room {booking.roomNumber}</span>

        {showRoomType && booking.roomTypeName && (
          <span className="font-normal text-muted-foreground">
            ({booking.roomTypeName})
          </span>
        )}
      </span>

      <span className="hidden text-border sm:inline" aria-hidden="true">
        |
      </span>

      <span className="inline-flex items-center gap-1">
        <ClockIcon
          className="size-3.5 shrink-0"
          aria-hidden="true"
        />

        <span>
          {showRoomType ? "Exp " : ""}
          {formatISTTime(booking.time)}
        </span>
      </span>
    </div>
  );
}

// ======================================================
// Departing Today
// Fixed maximum height + internal scrolling
// ======================================================

export function DepartingTodayCard({
  departures,
  className,
}: {
  departures: TodayGuestMovement[];
  className?: string;
}) {
  return (
    <Card
      className={cn(
        "flex h-full min-h-0 flex-col overflow-hidden",
        cardClass,
        className
      )}
    >
      <MovementHeader
        type="departing"
        count={departures.length}
        href="/bookings?status=CHECKED_IN"
      />

      {/* Scrollable guest list */}

      <CardContent
        className="
    min-h-0 flex-1 overflow-y-auto overscroll-contain
    p-0 scrollbar-hidden
  "
      >
        {departures.length === 0 ? (
          <EmptyMovementState type="departing" />
        ) : (
          <div className="divide-y divide-border/60">
            {departures.map((booking) => (
              <div
                key={booking.id}
                className={rowClass}
              >
                {/* Guest information */}

                <div className={detailsClass}>
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <span className="max-w-full truncate text-sm font-semibold text-foreground">
                      {booking.guestName}
                    </span>

                    <StatusBadge
                      status={booking.status}
                      className="shrink-0 px-1.5 py-0 text-[10px]"
                    />
                  </div>

                  <RoomTimeDetails booking={booking} />

                  {booking.balanceDue > 0 && (
                    <p className="text-xs font-medium text-destructive">
                      Due:{" "}
                      <MoneyText amount={booking.balanceDue} />
                    </p>
                  )}
                </div>

                {/* Action */}

                <Link
                  href={`/bookings/${booking.id}`}
                  className="shrink-0 sm:w-auto"
                >
                  <Button
                    variant={
                      booking.status === "CHECKED_IN"
                        ? "default"
                        : "outline"
                    }
                    size="sm"
                    className={actionButtonClass}
                  >
                    {booking.status === "CHECKED_IN"
                      ? "Check Out"
                      : "Invoice"}
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

// ======================================================
// Arriving Today
// Naturally expandable list
// ======================================================

export function ArrivingTodayCard({
  arrivals,
  className,
}: {
  arrivals: TodayGuestMovement[];
  className?: string;
}) {
  return (
    <Card
      className={cn(
        "w-full min-w-0",
        cardClass,
        className
      )}
    >
      <MovementHeader
        type="arriving"
        count={arrivals.length}
        href="/bookings?status=RESERVED"
      />

      <CardContent className="p-0">
        {arrivals.length === 0 ? (
          <EmptyMovementState type="arriving" />
        ) : (
          <div className="divide-y divide-border/60">
            {arrivals.map((booking) => (
              <div
                key={booking.id}
                className={rowClass}
              >
                {/* Guest information */}

                <div className={detailsClass}>
                  <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1.5">
                    <span className="max-w-full truncate text-sm font-semibold text-foreground">
                      {booking.guestName}
                    </span>

                    <StatusBadge
                      status={booking.status}
                      className="shrink-0 px-1.5 py-0 text-[10px]"
                    />

                    {booking.guestMobile && (
                      <span className="break-all text-xs font-mono text-muted-foreground">
                        {booking.guestMobile}
                      </span>
                    )}
                  </div>

                  <RoomTimeDetails
                    booking={booking}
                    showRoomType
                  />
                </div>

                {/* Action */}

                <Link
                  href={`/bookings/${booking.id}`}
                  className="shrink-0 sm:w-auto"
                >
                  <Button
                    variant={
                      booking.status === "RESERVED"
                        ? "default"
                        : "outline"
                    }
                    size="sm"
                    className={actionButtonClass}
                  >
                    {booking.status === "RESERVED"
                      ? "Check In"
                      : "Details"}
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

// ======================================================
// Combined component
// ======================================================

export function ArrivalsDeparturesTables({
  arrivingToday,
  departingToday,
}: MovementsProps) {
  return (
    <div className="min-w-0 space-y-4 sm:space-y-5">
      <DepartingTodayCard departures={departingToday} />

      <ArrivingTodayCard arrivals={arrivingToday} />
    </div>
  );
}
