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
    ? "border-l-4 border-l-muted-foreground/40 opacity-80"
    : room.status === "OCCUPIED"
    ? "border-l-4 border-l-status-occupied"
    : room.status === "RESERVED"
    ? "border-l-4 border-l-status-reserved"
    : room.status === "MAINTENANCE"
    ? "border-l-4 border-l-status-maintenance"
    : "border-l-4 border-l-status-available";

  return (
    <>
      <Card
        onClick={() => {
          if (room.status === "OCCUPIED" || room.status === "RESERVED" || room.status === "MAINTENANCE" || room.hasProblem) {
            setIsDetailsOpen(true);
          }
        }}
        className={cn(
          "relative overflow-hidden transition-all duration-150 ease-out cursor-pointer flex flex-col justify-between select-none group border rounded-xl hover:shadow-md hover:border-border/80 motion-reduce:transition-none bg-card py-0 gap-0",
          borderAccentClass
        )}
      >
        <CardContent className="p-4 space-y-3 flex-1 flex flex-col">
          {/* Header Row: Room Number & Status Badge */}
          <div className="flex items-center justify-between gap-2">
            <span className="text-2xl font-black tracking-tight text-foreground font-mono leading-none">
              {room.number}
            </span>

            <div className="shrink-0">
              <StatusBadge
                status={room.status}
                label={room.status === "MAINTENANCE" ? "Maintenance" : undefined}
              />
            </div>
          </div>

          {/* Subheader Row: Category & Problem Alert */}
          <div className="flex items-center justify-between gap-2 min-w-0">
            <span
              className="text-xs font-semibold text-muted-foreground tracking-wide uppercase truncate"
              title={room.typeName}
            >
              {room.typeName}
            </span>

            {room.hasProblem && (
              <span
                title={`${room.openProblemsCount} unresolved problem(s)`}
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-status-problem/15 text-status-problem text-[11px] font-bold border border-status-problem/30 shrink-0"
              >
                <ProblemIcon className="size-3" aria-hidden="true" />
                <span>{room.openProblemsCount} {room.openProblemsCount === 1 ? "issue" : "issues"}</span>
              </span>
            )}
          </div>

          {/* Pricing Row: Price / night */}
          <div className="flex items-baseline gap-1 pt-0.5">
            <span className="text-xl font-bold text-foreground tabular-nums tracking-tight">
              {formatINR(room.pricePerNight)}
            </span>
            <span className="text-xs text-muted-foreground font-medium">/ night</span>
          </div>

          {/* Dynamic Context Banner */}
          <div className="mt-auto pt-1">
            {room.status === "OCCUPIED" && room.currentBooking && (
              <div className="rounded-lg bg-status-occupied/10 border border-status-occupied/20 p-2.5 space-y-1 text-xs">
                <div className="flex items-center gap-1.5 font-semibold text-status-occupied truncate">
                  <GuestIcon className="size-3.5 shrink-0" aria-hidden="true" />
                  <span className="truncate">{room.currentBooking.guestName}</span>
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <ClockIcon className="size-3 shrink-0" aria-hidden="true" />
                  <span>Depart: {formatISTDate(new Date(room.currentBooking.checkOutAt))}</span>
                </div>
              </div>
            )}

            {room.status === "RESERVED" && room.currentBooking && (
              <div className="rounded-lg bg-status-reserved/10 border border-status-reserved/25 p-2.5 space-y-1 text-xs">
                <div className="flex items-center gap-1.5 font-semibold text-status-reserved truncate">
                  <GuestIcon className="size-3.5 shrink-0" aria-hidden="true" />
                  <span className="truncate">{room.currentBooking.guestName}</span>
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <ClockIcon className="size-3 shrink-0" aria-hidden="true" />
                  <span>Expected: {formatISTDate(new Date(room.currentBooking.checkInAt))}</span>
                </div>
              </div>
            )}

            {room.status === "MAINTENANCE" && (
              <div className="rounded-lg bg-status-maintenance/10 border border-status-maintenance/20 p-2.5 space-y-1 text-xs">
                <div className="flex items-center gap-1.5 font-semibold text-status-maintenance">
                  <MaintenanceIcon className="size-3.5 shrink-0" aria-hidden="true" />
                  <span>Under Maintenance</span>
                </div>
                <p className="text-[11px] text-muted-foreground line-clamp-1" title={room.maintenanceReason || "Scheduled repair work"}>
                  {room.maintenanceReason || "Scheduled repair work"}
                </p>
              </div>
            )}

            {!room.isActive && (
              <div className="rounded-md bg-muted/60 border border-border px-2.5 py-1.5 text-xs flex items-center justify-between text-muted-foreground">
                <span className="text-[11px] font-medium">Inactive in system</span>
                <Badge variant="secondary" className="text-[10px] uppercase font-bold py-0">Disabled</Badge>
              </div>
            )}

            {room.status === "AVAILABLE" && room.isActive && (
              <div className="rounded-md bg-status-available/5 border border-status-available/15 px-2.5 py-1.5 text-[11px] text-muted-foreground flex items-center gap-2">
                <span className="size-2 rounded-full bg-status-available shrink-0 animate-pulse" />
                <span className="font-medium text-foreground/80">Available for check-in</span>
              </div>
            )}
          </div>
        </CardContent>

        {/* Card Footer Actions */}
        <div className="px-3.5 py-2 border-t border-border/70 bg-muted/25 flex items-center justify-between text-xs text-muted-foreground">
          <span className="text-[11px] font-medium">
            {room.status === "OCCUPIED"
              ? "Guest in room"
              : room.status === "RESERVED"
              ? "Reserved"
              : room.status === "MAINTENANCE"
              ? "Out of service"
              : !room.isActive
              ? "Not bookable"
              : "Vacant clean"}
          </span>

          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            {isOwner && onEdit && (
              <Button
                variant="ghost"
                size="icon-sm"
                className="size-7 hover:bg-background hover:text-foreground text-muted-foreground transition-colors"
                title="Edit room settings"
                onClick={() => onEdit(room)}
              >
                <EditIcon className="size-3.5" aria-hidden="true" />
                <span className="sr-only">Edit room {room.number}</span>
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon-sm"
              className="size-7 hover:bg-background hover:text-foreground text-muted-foreground transition-colors"
              title="View room details"
              onClick={() => setIsDetailsOpen(true)}
            >
              <ChevronRightIcon className="size-3.5" aria-hidden="true" />
              <span className="sr-only">View room {room.number} details</span>
            </Button>
          </div>
        </div>
      </Card>

      {/* Quick Summary Dialog */}
      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <RoomIcon className="size-5" aria-hidden="true" />
              </div>
              <div className="space-y-0.5">
                <DialogTitle className="text-xl">Room {room.number}</DialogTitle>
                <DialogDescription>
                  {room.typeName} • {formatINR(room.pricePerNight)} / night
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4 py-1">
            {/* 2-Column Key Metrics Card */}
            <div className="grid grid-cols-2 gap-3 p-3.5 rounded-xl bg-muted/30 border border-border">
              <div className="space-y-1">
                <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Current Status</span>
                <div>
                  <StatusBadge status={room.status} />
                </div>
              </div>
              <div className="space-y-1">
                <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Nightly Rate</span>
                <div className="text-sm font-bold text-foreground font-mono">{formatINR(room.pricePerNight)}</div>
              </div>
              <div className="space-y-1">
                <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Room Category</span>
                <div className="text-sm font-semibold text-foreground truncate">{room.typeName}</div>
              </div>
              <div className="space-y-1">
                <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Inventory State</span>
                <div className="text-sm font-semibold text-foreground">
                  {room.isActive ? "Active (Bookable)" : "Disabled (Archived)"}
                </div>
              </div>
            </div>

            {/* Occupied or Reserved Guest Details */}
            {(room.status === "OCCUPIED" || room.status === "RESERVED") && room.currentBooking && (
              <div className={cn(
                "rounded-xl p-4 space-y-3 border",
                room.status === "OCCUPIED"
                  ? "bg-status-occupied/5 border-status-occupied/20"
                  : "bg-status-reserved/5 border-status-reserved/25"
              )}>
                <div className={cn(
                  "flex items-center justify-between pb-2 border-b",
                  room.status === "OCCUPIED" ? "border-status-occupied/15" : "border-status-reserved/20"
                )}>
                  <span className={cn(
                    "text-xs font-bold uppercase tracking-wider",
                    room.status === "OCCUPIED" ? "text-status-occupied" : "text-status-reserved"
                  )}>
                    {room.status === "OCCUPIED" ? "Active Stay" : "Upcoming Reservation"}
                  </span>
                  <span className={cn(
                    "font-mono text-xs px-2 py-0.5 rounded font-semibold",
                    room.status === "OCCUPIED"
                      ? "bg-status-occupied/15 text-status-occupied"
                      : "bg-status-reserved/15 text-status-reserved"
                  )}>
                    {room.currentBooking.reference}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Primary Guest</span>
                    <span className="font-semibold text-foreground text-sm">{room.currentBooking.guestName}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">
                      {room.status === "OCCUPIED" ? "Checked In" : "Expected Check-In"}
                    </span>
                    <span className="font-medium text-foreground">{formatISTDateTime(new Date(room.currentBooking.checkInAt))}</span>
                  </div>
                  <div className="sm:col-span-2">
                    <span className="text-muted-foreground block text-[11px]">Scheduled Check-Out</span>
                    <span className="font-medium text-foreground">{formatISTDateTime(new Date(room.currentBooking.checkOutAt))}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Maintenance Reason */}
            {room.status === "MAINTENANCE" && (
              <div className="rounded-xl bg-status-maintenance/10 border border-status-maintenance/20 p-4 space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-status-maintenance">
                  <MaintenanceIcon className="size-4 shrink-0" aria-hidden="true" />
                  <span>Maintenance Record</span>
                </div>
                <p className="text-xs text-foreground font-medium">
                  {room.maintenanceReason || "Routine maintenance and inspection in progress."}
                </p>
              </div>
            )}

            {/* Open Problems */}
            {room.hasProblem && (
              <div className="rounded-xl bg-status-problem/10 border border-status-problem/20 p-4 space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-status-problem">
                  <ProblemIcon className="size-4 shrink-0" aria-hidden="true" />
                  <span>{room.openProblemsCount} Unresolved Issue(s)</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Room requires front-desk or housekeeping inspection before assigning to a walk-in guest.
                </p>
              </div>
            )}
          </div>

          <DialogFooter className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-2.5">
            {(room.status === "OCCUPIED" || room.status === "RESERVED") && room.currentBooking ? (
              <Link
                href={`/bookings`}
                className={buttonVariants({ variant: "default", size: "sm" })}
              >
                View Booking Details
                <ChevronRightIcon className="size-3.5 ml-1.5" aria-hidden="true" />
              </Link>
            ) : (
              <div />
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
