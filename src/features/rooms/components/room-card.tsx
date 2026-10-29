"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatINR } from "@/lib/money";
import { formatISTDateTime, formatISTDate } from "@/lib/datetime";
import {
  GuestIcon,
  ClockIcon,
  ProblemIcon,
  MaintenanceIcon,
  EditIcon,
  ChevronRightIcon,
  RoomIcon,
} from "@/lib/icons";
import { cn } from "@/lib/utils";
import type { RoomWithStatus } from "@/server/services/room.service";
import type { Role } from "@/lib/constants";

interface RoomCardProps {
  room: RoomWithStatus;
  userRole?: Role;
  onEdit?: (room: RoomWithStatus) => void;
}

export function RoomCard({ room, userRole = "RECEPTIONIST", onEdit }: RoomCardProps) {
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  const isOwner = userRole === "OWNER";

  // Left border accent based on derived status
  const borderAccentClass = !room.isActive
    ? "border-l-4 border-l-muted-foreground/40 opacity-75"
    : room.status === "OCCUPIED"
    ? "border-l-4 border-l-status-occupied"
    : room.status === "MAINTENANCE"
    ? "border-l-4 border-l-status-maintenance"
    : "border-l-4 border-l-status-available";

  return (
    <>
      <Card
        onClick={() => {
          if (room.status === "OCCUPIED" || room.status === "MAINTENANCE" || room.hasProblem) {
            setIsDetailsOpen(true);
          }
        }}
        className={cn(
          "relative overflow-hidden transition-all hover:shadow-md cursor-pointer flex flex-col justify-between select-none group",
          borderAccentClass
        )}
      >
        <CardContent className="p-4 space-y-3">
          {/* Header Row: Room Number & Status */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-extrabold tracking-tight text-foreground font-mono">
                {room.number}
              </span>
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider truncate max-w-[90px]">
                {room.typeName}
              </span>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {room.hasProblem && (
                <span
                  title={`${room.openProblemsCount} unresolved problem(s)`}
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-status-problem/15 text-status-problem text-[11px] font-bold border border-status-problem/30"
                >
                  <ProblemIcon className="size-3" aria-hidden="true" />
                  <span>{room.openProblemsCount}</span>
                </span>
              )}
              <StatusBadge status={room.status} />
            </div>
          </div>

          {/* Pricing Row: Price / night */}
          <div className="flex items-baseline gap-1">
            <span className="text-xl font-bold text-foreground tabular-nums">
              {formatINR(room.pricePerNight)}
            </span>
            <span className="text-xs text-muted-foreground font-medium">/night</span>
          </div>

          {/* Contextual Banner based on state */}
          {room.status === "OCCUPIED" && room.currentBooking && (
            <div className="rounded-md bg-status-occupied/10 border border-status-occupied/20 p-2 space-y-1 text-xs">
              <div className="flex items-center gap-1.5 font-semibold text-status-occupied truncate">
                <GuestIcon className="size-3.5 shrink-0" aria-hidden="true" />
                <span className="truncate">{room.currentBooking.guestName}</span>
              </div>
              <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <ClockIcon className="size-3 shrink-0" aria-hidden="true" />
                <span>Until {formatISTDate(new Date(room.currentBooking.checkOutAt))}</span>
              </div>
            </div>
          )}

          {room.status === "MAINTENANCE" && (
            <div className="rounded-md bg-status-maintenance/10 border border-status-maintenance/20 p-2 space-y-0.5 text-xs">
              <div className="flex items-center gap-1.5 font-semibold text-status-maintenance">
                <MaintenanceIcon className="size-3.5 shrink-0" aria-hidden="true" />
                <span>Maintenance</span>
              </div>
              <p className="text-[11px] text-muted-foreground truncate">
                {room.maintenanceReason || "Scheduled repair work"}
              </p>
            </div>
          )}

          {!room.isActive && (
            <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              <Badge variant="secondary" className="text-[10px]">Disabled from bookings</Badge>
            </div>
          )}
        </CardContent>

        {/* Card Footer Actions */}
        <div className="px-4 py-2 border-t border-border bg-muted/20 flex items-center justify-between text-xs text-muted-foreground">
          <span className="text-[11px]">
            {room.status === "AVAILABLE" ? "Ready for guest" : "Click for details"}
          </span>

          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            {isOwner && onEdit && (
              <Button
                variant="ghost"
                size="icon-sm"
                title="Edit room settings"
                onClick={() => onEdit(room)}
              >
                <EditIcon className="size-3.5" aria-hidden="true" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon-sm"
              title="Open room info"
              onClick={() => setIsDetailsOpen(true)}
            >
              <ChevronRightIcon className="size-3.5" aria-hidden="true" />
            </Button>
          </div>
        </div>
      </Card>

      {/* Quick Summary Dialog */}
      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <div className="size-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <RoomIcon className="size-4" aria-hidden="true" />
              </div>
              <div>
                <DialogTitle className="text-lg">Room {room.number}</DialogTitle>
                <DialogDescription>
                  {room.typeName} • {formatINR(room.pricePerNight)} / night
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="flex items-center justify-between border-b border-border pb-2">
              <span className="text-xs font-medium text-muted-foreground">Current Status</span>
              <StatusBadge status={room.status} />
            </div>

            {room.status === "OCCUPIED" && room.currentBooking && (
              <div className="rounded-lg bg-status-occupied/5 border border-status-occupied/20 p-3 space-y-2 text-sm">
                <div className="flex items-center justify-between font-semibold">
                  <span className="text-xs text-muted-foreground">Primary Guest</span>
                  <span className="text-foreground">{room.currentBooking.guestName}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Booking Reference</span>
                  <span className="font-mono font-medium">{room.currentBooking.reference}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Checked In</span>
                  <span>{formatISTDateTime(new Date(room.currentBooking.checkInAt))}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Scheduled Departure</span>
                  <span>{formatISTDateTime(new Date(room.currentBooking.checkOutAt))}</span>
                </div>
              </div>
            )}

            {room.status === "MAINTENANCE" && (
              <div className="rounded-lg bg-status-maintenance/10 border border-status-maintenance/20 p-3 space-y-1 text-sm">
                <span className="text-xs font-semibold text-status-maintenance">Maintenance Details</span>
                <p className="text-xs text-foreground">
                  {room.maintenanceReason || "Routine maintenance in progress."}
                </p>
              </div>
            )}

            {room.hasProblem && (
              <div className="rounded-lg bg-status-problem/10 border border-status-problem/20 p-3 space-y-1 text-sm">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-status-problem">
                  <ProblemIcon className="size-4 shrink-0" aria-hidden="true" />
                  <span>{room.openProblemsCount} Unresolved Problem(s)</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Staff should inspect this room before assigning to a new walk-in guest.
                </p>
              </div>
            )}

            <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
              <span>Availability State</span>
              <span className="font-medium text-foreground">
                {room.isActive ? "Active (Available for booking)" : "Disabled (Archived/Inactive)"}
              </span>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            {room.status === "OCCUPIED" && room.currentBooking && (
              <Link
                href={`/bookings/${room.currentBooking.id}`}
                className={buttonVariants({ variant: "default", size: "sm" })}
              >
                View Full Stay Details
                <ChevronRightIcon className="size-3.5 ml-1.5" aria-hidden="true" />
              </Link>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsDetailsOpen(false)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
