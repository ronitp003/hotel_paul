"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
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
import { formatISTDateTime, formatIST } from "@/lib/datetime";
import {
  GuestIcon,
  ClockIcon,
  ProblemIcon,
  MaintenanceIcon,
  EditIcon,
  ChevronRightIcon,
  RoomIcon,
  CheckIcon,
} from "@/lib/icons";
import { cn } from "@/lib/utils";
import type { RoomWithStatus } from "@/server/services/room.service";
import type { Role } from "@/lib/constants";
import { LogProblemDialog } from "./log-problem-dialog";
import { CreateMaintenanceDialog } from "./create-maintenance-dialog";

interface RoomCardProps {
  room: RoomWithStatus;
  userRole?: Role;
  onEdit?: (room: RoomWithStatus) => void;
}

export function RoomCard({
  room,
  userRole = "RECEPTIONIST",
  onEdit,
}: RoomCardProps) {
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isProblemOpen, setIsProblemOpen] = useState(false);
  const [isMaintenanceOpen, setIsMaintenanceOpen] = useState(false);

  const isOwner = userRole === "OWNER";

  // Status badge styling
  const statusConfig = !room.isActive
    ? {
        label: "Disabled",
        dotClass: "bg-muted-foreground",
        badgeClass: "bg-muted text-muted-foreground border-border",
      }
    : room.status === "OCCUPIED"
      ? {
          label: "Occupied",
          dotClass: "bg-blue-600 dark:bg-blue-400",
          badgeClass:
            "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20",
        }
      : room.status === "RESERVED"
        ? {
            label: "Reserved",
            dotClass: "bg-amber-600 dark:bg-amber-400",
            badgeClass:
              "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20",
          }
        : room.status === "MAINTENANCE"
          ? {
              label: "Maintenance",
              dotClass: "bg-slate-500",
              badgeClass:
                "bg-slate-500/10 text-slate-700 dark:text-slate-400 border-slate-500/20",
            }
          : {
              label: "Available",
              dotClass: "bg-emerald-600 dark:bg-emerald-400",
              badgeClass:
                "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20",
            };

  return (
    <>
      <Card
        onClick={() => {
          setIsDetailsOpen(true);
        }}
        className="relative overflow-hidden transition-all duration-150 ease-out cursor-pointer flex flex-col justify-between select-none group border border-border/80 rounded-xl hover:shadow-xs hover:border-border motion-reduce:transition-none bg-card py-0 gap-0"
      >
        <CardContent className="p-3.5 sm:p-4 flex flex-col justify-between h-full">
          <div>
            {/* Top Row: Room Number & Status Badge */}
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <span
                  className="text-xl sm:text-2xl font-bold font-mono tracking-tight text-foreground leading-none truncate block"
                  title={`Room ${room.number}`}
                >
                  {room.number}
                </span>
                <p
                  className="text-xs text-muted-foreground mt-1 truncate font-medium"
                  title={room.typeName}
                >
                  {room.typeName}
                </p>
              </div>

              <div className="shrink-0 flex items-center gap-1.5 flex-wrap justify-end">
                {room.hasProblem && (
                  <span
                    title={`${room.openProblemsCount} unresolved problem(s)`}
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20 shrink-0"
                  >
                    <ProblemIcon
                      className="size-2.5 shrink-0"
                      aria-hidden="true"
                    />
                    <span>
                      {room.openProblemsCount > 1
                        ? `${room.openProblemsCount} Issues`
                        : "Issue"}
                    </span>
                  </span>
                )}
                <span
                  className={cn(
                    "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border leading-none shrink-0",
                    statusConfig.badgeClass
                  )}
                >
                  <span
                    className={cn(
                      "size-1.5 rounded-full shrink-0",
                      statusConfig.dotClass
                    )}
                    aria-hidden="true"
                  />
                  <span>{statusConfig.label}</span>
                </span>
              </div>
            </div>

            {/* Pricing Row: Price / night */}
            <div className="flex items-baseline gap-1 mt-3">
              <span className="text-lg font-bold font-mono text-foreground tracking-tight tabular-nums">
                {formatINR(room.pricePerNight)}
              </span>
              <span className="text-xs text-muted-foreground font-normal">
                / night
              </span>
            </div>

            {/* Inline Status Message with Small Icon */}
            <div className="mt-2 text-xs text-muted-foreground min-w-0">
              {room.status === "OCCUPIED" ? (
                <div className="flex items-center gap-1.5 min-w-0">
                  <GuestIcon
                    className="size-3.5 shrink-0 text-blue-600 dark:text-blue-400"
                    aria-hidden="true"
                  />
                  {room.currentBooking ? (
                    <span className="truncate">
                      <strong className="font-semibold text-foreground/90">
                        {room.currentBooking.guestName}
                      </strong>
                      <span className="text-[11px] text-muted-foreground font-normal ml-1">
                        • Out{" "}
                        {formatIST(
                          new Date(room.currentBooking.checkOutAt),
                          "d MMM"
                        )}
                      </span>
                    </span>
                  ) : (
                    <span className="truncate font-medium text-foreground/80">
                      Guest in room
                    </span>
                  )}
                </div>
              ) : room.status === "RESERVED" ? (
                <div className="flex items-center gap-1.5 min-w-0">
                  <ClockIcon
                    className="size-3.5 shrink-0 text-amber-600 dark:text-amber-400"
                    aria-hidden="true"
                  />
                  {room.currentBooking ? (
                    <span className="truncate">
                      <strong className="font-semibold text-foreground/90">
                        {room.currentBooking.guestName}
                      </strong>
                      <span className="text-[11px] text-muted-foreground font-normal ml-1">
                        • In{" "}
                        {formatIST(
                          new Date(room.currentBooking.checkInAt),
                          "d MMM"
                        )}
                      </span>
                    </span>
                  ) : (
                    <span className="truncate font-medium text-foreground/80">
                      Reserved
                    </span>
                  )}
                </div>
              ) : room.status === "MAINTENANCE" ? (
                <div className="flex items-center gap-1.5 min-w-0">
                  <MaintenanceIcon
                    className="size-3.5 shrink-0 text-slate-500"
                    aria-hidden="true"
                  />
                  <span
                    className="truncate font-medium text-foreground/80"
                    title={room.maintenanceReason || "Under maintenance"}
                  >
                    {room.maintenanceReason || "Under maintenance"}
                  </span>
                </div>
              ) : !room.isActive ? (
                <div className="flex items-center gap-1.5 min-w-0">
                  <RoomIcon
                    className="size-3.5 shrink-0 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <span className="truncate font-medium text-muted-foreground">
                    Inactive in system
                  </span>
                </div>
              ) : room.upcomingMaintenance &&
                room.upcomingMaintenance.length > 0 ? (
                <div className="flex items-center gap-1.5 min-w-0">
                  <MaintenanceIcon
                    className="size-3.5 shrink-0 text-slate-500"
                    aria-hidden="true"
                  />
                  <span
                    className="truncate font-medium text-foreground/80"
                    title={room.upcomingMaintenance[0].reason}
                  >
                    Maint:{" "}
                    {formatIST(
                      new Date(room.upcomingMaintenance[0].startsAt),
                      "d MMM"
                    )}
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 min-w-0">
                  <CheckIcon
                    className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400"
                    aria-hidden="true"
                  />
                  <span className="truncate font-medium text-foreground/80">
                    Available for check-in
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Bottom Section: Subtle Divider & Minimal Actions */}
          <div
            className={cn(
              "mt-3.5 pt-2 border-t border-border/60 flex items-center text-xs",
              isOwner && onEdit ? "justify-between" : "justify-end"
            )}
            onClick={(e) => e.stopPropagation()}
          >
            {isOwner && onEdit && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onEdit(room)}
                className="h-7 px-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 rounded-md transition-colors gap-1 -ml-1"
              >
                <EditIcon className="size-3" aria-hidden="true" />
                <span>Edit</span>
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setIsDetailsOpen(true)}
              className="h-7 px-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 rounded-md transition-colors gap-1 -mr-1"
            >
              <span>View Details</span>
              <ChevronRightIcon
                className="size-3 text-muted-foreground"
                aria-hidden="true"
              />
            </Button>
          </div>
        </CardContent>
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
                <DialogTitle className="text-xl">
                  Room {room.number}
                </DialogTitle>
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
                <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                  Current Status
                </span>
                <div>
                  <StatusBadge status={room.status} />
                </div>
              </div>
              <div className="space-y-1">
                <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                  Nightly Rate
                </span>
                <div className="text-sm font-bold text-foreground font-mono">
                  {formatINR(room.pricePerNight)}
                </div>
              </div>
              <div className="space-y-1">
                <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                  Room Category
                </span>
                <div className="text-sm font-semibold text-foreground truncate">
                  {room.typeName}
                </div>
              </div>
              <div className="space-y-1">
                <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                  Inventory State
                </span>
                <div className="text-sm font-semibold text-foreground">
                  {room.isActive ? "Active (Bookable)" : "Disabled (Archived)"}
                </div>
              </div>
            </div>

            {/* Occupied or Reserved Guest Details */}
            {(room.status === "OCCUPIED" || room.status === "RESERVED") &&
              room.currentBooking && (
                <div
                  className={cn(
                    "rounded-xl p-4 space-y-3 border",
                    room.status === "OCCUPIED"
                      ? "bg-status-occupied/5 border-status-occupied/20"
                      : "bg-status-reserved/5 border-status-reserved/25"
                  )}
                >
                  <div
                    className={cn(
                      "flex items-center justify-between pb-2 border-b",
                      room.status === "OCCUPIED"
                        ? "border-status-occupied/15"
                        : "border-status-reserved/20"
                    )}
                  >
                    <span
                      className={cn(
                        "text-xs font-bold uppercase tracking-wider",
                        room.status === "OCCUPIED"
                          ? "text-status-occupied"
                          : "text-status-reserved"
                      )}
                    >
                      {room.status === "OCCUPIED"
                        ? "Active Stay"
                        : "Upcoming Reservation"}
                    </span>
                    <span
                      className={cn(
                        "font-mono text-xs px-2 py-0.5 rounded font-semibold",
                        room.status === "OCCUPIED"
                          ? "bg-status-occupied/15 text-status-occupied"
                          : "bg-status-reserved/15 text-status-reserved"
                      )}
                    >
                      {room.currentBooking.reference}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-muted-foreground block text-[11px]">
                        Primary Guest
                      </span>
                      <span className="font-semibold text-foreground text-sm">
                        {room.currentBooking.guestName}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-[11px]">
                        {room.status === "OCCUPIED"
                          ? "Checked In"
                          : "Expected Check-In"}
                      </span>
                      <span className="font-medium text-foreground">
                        {formatISTDateTime(
                          new Date(room.currentBooking.checkInAt)
                        )}
                      </span>
                    </div>
                    <div className="sm:col-span-2">
                      <span className="text-muted-foreground block text-[11px]">
                        Scheduled Check-Out
                      </span>
                      <span className="font-medium text-foreground">
                        {formatISTDateTime(
                          new Date(room.currentBooking.checkOutAt)
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              )}

            {/* Maintenance Reason */}
            {room.status === "MAINTENANCE" && (
              <div className="rounded-xl bg-status-maintenance/10 border border-status-maintenance/20 p-4 space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-status-maintenance">
                  <MaintenanceIcon
                    className="size-4 shrink-0"
                    aria-hidden="true"
                  />
                  <span>Maintenance Record</span>
                </div>
                <p className="text-xs text-foreground font-medium">
                  {room.maintenanceReason ||
                    "Routine maintenance and inspection in progress."}
                </p>
              </div>
            )}

            {/* Scheduled Upcoming Maintenance */}
            {room.upcomingMaintenance && room.upcomingMaintenance.length > 0 && (
              <div className="rounded-xl bg-status-maintenance/10 border border-status-maintenance/20 p-4 space-y-2">
                <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-status-maintenance">
                  <div className="flex items-center gap-1.5">
                    <MaintenanceIcon
                      className="size-4 shrink-0"
                      aria-hidden="true"
                    />
                    <span>
                      Scheduled Maintenance ({room.upcomingMaintenance.length})
                    </span>
                  </div>
                </div>

                <div className="space-y-2 pt-0.5">
                  {room.upcomingMaintenance.map((m) => (
                    <div
                      key={m.id}
                      className="rounded-lg bg-card/90 border border-status-maintenance/25 p-2.5 space-y-1 text-xs shadow-2xs"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-foreground text-xs">
                          {m.reason}
                        </span>
                        <span className="text-[10px] font-mono text-status-maintenance font-bold shrink-0">
                          {formatIST(new Date(m.startsAt), "dd MMM, hh:mm a")} – {formatIST(new Date(m.endsAt), "dd MMM, hh:mm a")}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Open Problems */}
            {room.hasProblem && (
              <div className="rounded-xl bg-status-problem/10 border border-status-problem/20 p-4 space-y-2.5">
                <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-status-problem">
                  <ProblemIcon className="size-4 shrink-0" aria-hidden="true" />
                  <span>{room.openProblemsCount} Unresolved Issue(s)</span>
                </div>

                {room.openProblems && room.openProblems.length > 0 ? (
                  <div className="space-y-2 pt-0.5">
                    {room.openProblems.map((prob) => (
                      <div
                        key={prob.id}
                        className="rounded-lg bg-card/90 border border-status-problem/25 p-2.5 space-y-1 text-xs shadow-2xs"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className={cn(
                              "px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border",
                              prob.severity === "HIGH" || prob.severity === "CRITICAL"
                                ? "bg-destructive/15 text-destructive border-destructive/30"
                                : prob.severity === "MEDIUM"
                                  ? "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30"
                                  : "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30"
                            )}
                          >
                            {prob.severity} Priority
                          </span>
                          {prob.reportedAt && (
                            <span className="text-[10px] text-muted-foreground font-mono">
                              {formatISTDateTime(prob.reportedAt)}
                            </span>
                          )}
                        </div>
                        <p className="text-xs font-medium text-foreground whitespace-pre-wrap">
                          {prob.description}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Room requires front-desk or housekeeping inspection before
                    assigning to a walk-in guest.
                  </p>
                )}
              </div>
            )}
            {/* Quick Action Buttons for Problem & Maintenance */}
            <div className="space-y-1.5 pt-2 border-t border-border/60">
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setIsDetailsOpen(false);
                    setIsProblemOpen(true);
                  }}
                  className="flex-1 gap-1.5 text-xs text-destructive border-destructive/30 hover:bg-destructive/10"
                >
                  <ProblemIcon className="size-3.5" />
                  <span>Report Problem</span>
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={
                    room.status === "OCCUPIED" ||
                    room.status === "RESERVED" ||
                    room.status === "MAINTENANCE"
                  }
                  onClick={() => {
                    if (
                      room.status === "OCCUPIED" ||
                      room.status === "RESERVED" ||
                      room.status === "MAINTENANCE"
                    )
                      return;
                    setIsDetailsOpen(false);
                    setIsMaintenanceOpen(true);
                  }}
                  title={
                    room.status === "MAINTENANCE"
                      ? "Room is already under maintenance."
                      : room.status === "OCCUPIED"
                      ? "Room is currently occupied. Maintenance cannot be scheduled until check-out."
                      : room.status === "RESERVED"
                      ? "Room has an active reservation. Maintenance cannot be scheduled."
                      : "Schedule room maintenance"
                  }
                  className={cn(
                    "flex-1 gap-1.5 text-xs border-status-maintenance/30",
                    room.status === "OCCUPIED" ||
                      room.status === "RESERVED" ||
                      room.status === "MAINTENANCE"
                      ? "opacity-50 cursor-not-allowed bg-muted text-muted-foreground border-border hover:bg-muted"
                      : "text-status-maintenance hover:bg-status-maintenance/10"
                  )}
                >
                  <MaintenanceIcon className="size-3.5" />
                  <span>Maintenance</span>
                </Button>
              </div>
            </div>
          </div>

          <DialogFooter className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-2.5">
            <Link
              href={`/rooms/${room.id}`}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              Full Room Details
              <ChevronRightIcon className="size-3.5 ml-1" />
            </Link>

            <div className="flex items-center gap-2">
              {(room.status === "OCCUPIED" || room.status === "RESERVED") &&
              room.currentBooking && (
                <Link
                  href={`/bookings/${room.currentBooking.id}`}
                  className={buttonVariants({ variant: "default", size: "sm" })}
                >
                  View Booking
                </Link>
              )}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setIsDetailsOpen(false)}
              >
                Close
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Log Problem Dialog */}
      <LogProblemDialog
        open={isProblemOpen}
        onOpenChange={setIsProblemOpen}
        room={{ id: room.id, number: room.number }}
      />

      {/* Create Maintenance Dialog */}
      <CreateMaintenanceDialog
        open={isMaintenanceOpen}
        onOpenChange={setIsMaintenanceOpen}
        room={{ id: room.id, number: room.number }}
      />
    </>
  );
}
