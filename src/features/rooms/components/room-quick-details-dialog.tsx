"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatINR } from "@/lib/money";
import { formatISTDateTime, formatIST } from "@/lib/datetime";
import {
  GuestIcon,
  ProblemIcon,
  MaintenanceIcon,
  ChevronRightIcon,
  RoomIcon,
  CalendarIcon,
  ClockIcon,
} from "@/lib/icons";
import { cn } from "@/lib/utils";
import type { RoomWithStatus } from "@/server/services/room.service";
import { LogProblemDialog } from "./log-problem-dialog";
import { CreateMaintenanceDialog } from "./create-maintenance-dialog";

interface RoomQuickDetailsDialogProps {
  room: RoomWithStatus | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onProblemLogged?: () => void;
  onMaintenanceCreated?: () => void;
}

export function RoomQuickDetailsDialog({
  room,
  open,
  onOpenChange,
  onProblemLogged,
  onMaintenanceCreated,
}: RoomQuickDetailsDialogProps) {
  const [isProblemOpen, setIsProblemOpen] = useState(false);
  const [isMaintenanceOpen, setIsMaintenanceOpen] = useState(false);

  if (!room) return null;

  const isOccupied = room.status === "OCCUPIED";
  const isAvailable = room.status === "AVAILABLE";
  const isMaintenance = room.status === "MAINTENANCE";
  const isReserved = room.status === "RESERVED";

  // Status icon container color
  const statusIconBg = !room.isActive
    ? "bg-stone-500 text-white"
    : isOccupied
    ? "bg-blue-600 text-white dark:bg-blue-500 dark:text-blue-950"
    : isAvailable
    ? "bg-emerald-600 text-white dark:bg-emerald-500 dark:text-emerald-950"
    : isMaintenance
    ? "bg-purple-700 text-white dark:bg-purple-600 dark:text-white"
    : isReserved
    ? "bg-amber-600 text-white dark:bg-amber-500 dark:text-amber-950"
    : "bg-muted text-muted-foreground";

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md sm:max-w-lg p-5 sm:p-6 max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <DialogHeader className="pb-3.5 border-b border-border/80">
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  "size-10 rounded-xl flex items-center justify-center font-bold text-base shadow-xs shrink-0",
                  statusIconBg
                )}
              >
                <RoomIcon className="size-5" aria-hidden="true" />
              </div>
              <div className="space-y-0.5 min-w-0">
                <DialogTitle className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
                  <span>Room {room.number}</span>
                  {!room.isActive && (
                    <span className="text-xs font-normal px-2 py-0.5 rounded bg-muted text-muted-foreground border">
                      Inactive
                    </span>
                  )}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground truncate">
                  {room.typeName} • {formatINR(room.pricePerNight)} / night
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-3.5 py-1">
            {/* Realigned 3-Column Key Metrics Card (Inventory State removed) */}
            <div className="grid grid-cols-3 gap-2.5 sm:gap-3 p-3 sm:p-3.5 rounded-xl bg-muted/40 border border-border">
              <div className="space-y-1">
                <span className="text-[10px] sm:text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                  Status
                </span>
                <div>
                  <StatusBadge status={room.status} />
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-[10px] sm:text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                  Category
                </span>
                <div className="text-xs sm:text-sm font-semibold text-foreground truncate">
                  {room.typeName}
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-[10px] sm:text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                  Nightly Rate
                </span>
                <div className="text-xs sm:text-sm font-bold text-foreground font-mono">
                  {formatINR(room.pricePerNight)}
                  <span className="text-[10px] font-normal text-muted-foreground ml-0.5">/nt</span>
                </div>
              </div>
            </div>

            {/* Occupied or Reserved Guest Details */}
            {(isOccupied || isReserved) && room.currentBooking && (
              <div
                className={cn(
                  "rounded-xl p-3.5 sm:p-4 space-y-2.5 border",
                  isOccupied
                    ? "bg-blue-500/5 border-blue-500/20 text-blue-950 dark:text-blue-100"
                    : "bg-amber-500/5 border-amber-500/25 text-amber-950 dark:text-amber-100"
                )}
              >
                <div
                  className={cn(
                    "flex items-center justify-between pb-2 border-b",
                    isOccupied ? "border-blue-500/15" : "border-amber-500/20"
                  )}
                >
                  <span
                    className={cn(
                      "text-xs font-bold uppercase tracking-wider flex items-center gap-1.5",
                      isOccupied ? "text-blue-700 dark:text-blue-400" : "text-amber-700 dark:text-amber-400"
                    )}
                  >
                    {isOccupied ? (
                      <>
                        <GuestIcon className="size-3.5" aria-hidden="true" />
                        <span>Active Stay</span>
                      </>
                    ) : (
                      <>
                        <CalendarIcon className="size-3.5" aria-hidden="true" />
                        <span>Upcoming Reservation</span>
                      </>
                    )}
                  </span>
                  <span
                    className={cn(
                      "font-mono text-[11px] px-2 py-0.5 rounded font-semibold",
                      isOccupied
                        ? "bg-blue-500/15 text-blue-800 dark:text-blue-200"
                        : "bg-amber-500/15 text-amber-800 dark:text-amber-200"
                    )}
                  >
                    {room.currentBooking.reference}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Primary Guest</span>
                    <span className="font-semibold text-foreground text-sm">
                      {room.currentBooking.guestName}
                    </span>
                  </div>

                  <div>
                    <span className="text-muted-foreground block text-[11px]">
                      {isOccupied ? "Checked In" : "Expected Check-In"}
                    </span>
                    <span className="font-medium text-foreground">
                      {formatISTDateTime(new Date(room.currentBooking.checkInAt))}
                    </span>
                  </div>

                  <div className="sm:col-span-2">
                    <span className="text-muted-foreground block text-[11px]">
                      Scheduled Check-Out
                    </span>
                    <span className="font-medium text-foreground">
                      {formatISTDateTime(new Date(room.currentBooking.checkOutAt))}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Maintenance Reason */}
            {isMaintenance && (
              <div className="rounded-xl bg-purple-500/10 border border-purple-500/25 p-3.5 sm:p-4 space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-purple-700 dark:text-purple-300">
                  <MaintenanceIcon className="size-4 shrink-0" aria-hidden="true" />
                  <span>Maintenance Record</span>
                </div>
                <p className="text-xs text-foreground font-medium">
                  {room.maintenanceReason || "Routine maintenance and inspection in progress."}
                </p>
                {room.activeMaintenance?.endsAt && (
                  <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <ClockIcon className="size-3" aria-hidden="true" />
                    <span>Scheduled until {formatISTDateTime(new Date(room.activeMaintenance.endsAt))}</span>
                  </p>
                )}
              </div>
            )}

            {/* Scheduled Upcoming Maintenance */}
            {room.upcomingMaintenance && room.upcomingMaintenance.length > 0 && (
              <div className="rounded-xl bg-purple-500/10 border border-purple-500/25 p-3.5 sm:p-4 space-y-2">
                <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-purple-700 dark:text-purple-300">
                  <div className="flex items-center gap-1.5">
                    <MaintenanceIcon className="size-4 shrink-0" aria-hidden="true" />
                    <span>Scheduled Maintenance ({room.upcomingMaintenance.length})</span>
                  </div>
                </div>

                <div className="space-y-1.5 pt-0.5">
                  {room.upcomingMaintenance.map((m) => (
                    <div
                      key={m.id}
                      className="rounded-lg bg-card/90 border border-purple-500/20 p-2.5 space-y-0.5 text-xs shadow-2xs"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-foreground text-xs">{m.reason}</span>
                        <span className="text-[10px] font-mono text-purple-700 dark:text-purple-300 font-bold shrink-0">
                          {formatIST(new Date(m.startsAt), "dd MMM, hh:mm a")} –{" "}
                          {formatIST(new Date(m.endsAt), "dd MMM, hh:mm a")}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Open Problems */}
            {room.hasProblem && (
              <div className="rounded-xl bg-rose-500/10 border border-rose-500/25 p-3.5 sm:p-4 space-y-2.5">
                <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">
                  <ProblemIcon className="size-4 shrink-0" aria-hidden="true" />
                  <span>{room.openProblemsCount} Unresolved Issue(s)</span>
                </div>

                {room.openProblems && room.openProblems.length > 0 ? (
                  <div className="space-y-2 pt-0.5">
                    {room.openProblems.map((prob) => (
                      <div
                        key={prob.id}
                        className="rounded-lg bg-card/90 border border-rose-500/25 p-2.5 space-y-1 text-xs shadow-2xs"
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
                    Room requires front-desk or housekeeping inspection before assigning to a guest.
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
                    onOpenChange(false);
                    setIsProblemOpen(true);
                  }}
                  className="flex-1 gap-1.5 text-xs text-destructive border-destructive/30 hover:bg-destructive/10"
                >
                  <ProblemIcon className="size-3.5" aria-hidden="true" />
                  <span>Report Problem</span>
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isOccupied || isReserved || isMaintenance}
                  onClick={() => {
                    if (isOccupied || isReserved || isMaintenance) return;
                    onOpenChange(false);
                    setIsMaintenanceOpen(true);
                  }}
                  title={
                    isMaintenance
                      ? "Room is already under maintenance."
                      : isOccupied
                      ? "Room is currently occupied. Maintenance cannot be scheduled until check-out."
                      : isReserved
                      ? "Room has an active reservation. Maintenance cannot be scheduled."
                      : "Schedule room maintenance"
                  }
                  className={cn(
                    "flex-1 gap-1.5 text-xs border-purple-500/30",
                    isOccupied || isReserved || isMaintenance
                      ? "opacity-50 cursor-not-allowed bg-muted text-muted-foreground border-border hover:bg-muted"
                      : "text-purple-700 dark:text-purple-300 hover:bg-purple-500/10"
                  )}
                >
                  <MaintenanceIcon className="size-3.5" aria-hidden="true" />
                  <span>Maintenance</span>
                </Button>
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <DialogFooter className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-2.5 pt-2 border-t border-border/60">
            <Link
              href={`/rooms/${room.id}`}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              <span>Room Details</span>
              <ChevronRightIcon className="size-3.5 ml-1" aria-hidden="true" />
            </Link>

            <div className="flex items-center gap-2">
              {(isOccupied || isReserved) && room.currentBooking && (
                <Link
                  href={`/bookings/${room.currentBooking.id}`}
                  className={buttonVariants({ variant: "default", size: "sm" })}
                >
                  View Booking
                </Link>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Log Problem Dialog */}
      <LogProblemDialog
        open={isProblemOpen}
        onOpenChange={setIsProblemOpen}
        room={{ id: room.id, number: room.number }}
        onSuccess={onProblemLogged}
      />

      {/* Create Maintenance Dialog */}
      <CreateMaintenanceDialog
        open={isMaintenanceOpen}
        onOpenChange={setIsMaintenanceOpen}
        room={{ id: room.id, number: room.number }}
        onSuccess={onMaintenanceCreated}
      />
    </>
  );
}

