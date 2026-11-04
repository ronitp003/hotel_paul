"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { StatusBadge, type StatusType } from "@/components/shared/status-badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { TablePagination } from "@/components/ui/table-pagination";
import { LogProblemDialog } from "./log-problem-dialog";
import { CreateMaintenanceDialog } from "./create-maintenance-dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  markProblemFixedAction,
  deleteMaintenanceAction,
  closeMaintenanceAction,
} from "@/server/actions/room-maintenance.actions";
import {
  RoomIcon,
  ProblemIcon,
  MaintenanceIcon,
  CheckIcon,
  ChevronLeftIcon,
  GuestIcon,
  SpinnerIcon,
  DeleteIcon,
  CircleCheckIcon,
} from "@/lib/icons";
import { formatINR } from "@/lib/money";
import { formatISTDateTime, formatISTDate } from "@/lib/datetime";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { Severity } from "@prisma/client";
import type { RoomDetailsData } from "@/server/services/room-maintenance.service";

interface RoomDetailsViewProps {
  initialData: RoomDetailsData;
}

const SEVERITY_BADGE_STYLE: Record<Severity, string> = {
  LOW: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20",
  MEDIUM: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20",
  HIGH: "bg-orange-500/10 text-orange-700 dark:text-orange-300 border-orange-500/20",
  CRITICAL: "bg-destructive/10 text-destructive border-destructive/20 font-bold",
};

type ActiveMaintenanceItem = RoomDetailsData["activeMaintenance"][number];

export function RoomDetailsView({ initialData }: RoomDetailsViewProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"stays" | "problems" | "maintenance">("stays");
  const [isProblemDialogOpen, setIsProblemDialogOpen] = useState(false);
  const [isMaintenanceDialogOpen, setIsMaintenanceDialogOpen] = useState(false);
  const [fixingProblemId, setFixingProblemId] = useState<string | null>(null);

  // Maintenance actions state
  const [maintenanceToRemove, setMaintenanceToRemove] = useState<ActiveMaintenanceItem | null>(null);
  const [isRemovingMaintenance, setIsRemovingMaintenance] = useState(false);
  const [maintenanceToClose, setMaintenanceToClose] = useState<ActiveMaintenanceItem | null>(null);
  const [closeCompletionNote, setCloseCompletionNote] = useState("");
  const [isClosingMaintenance, setIsClosingMaintenance] = useState(false);

  const [, startTransition] = useTransition();

  const { room, derivedStatus, currentBooking, openProblems, resolvedProblems, activeMaintenance, pastMaintenance, recentBookings } =
    initialData;

  // Pagination for Recent Room History (5 records per page)
  const PAGE_SIZE = 5;
  const [currentPage, setCurrentPage] = useState(1);
  const [prevRoomId, setPrevRoomId] = useState(room.id);

  if (room.id !== prevRoomId) {
    setPrevRoomId(room.id);
    setCurrentPage(1);
  }

  const totalRecords = recentBookings.length;
  const totalPages = Math.max(1, Math.ceil(totalRecords / PAGE_SIZE));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);
  const paginatedBookings = recentBookings.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE
  );

  const isOccupiedOrReserved =
    derivedStatus.status === "OCCUPIED" || derivedStatus.status === "RESERVED";
  const isAlreadyUnderMaintenance = derivedStatus.status === "MAINTENANCE";
  const isMaintenanceDisabled = isOccupiedOrReserved || isAlreadyUnderMaintenance;

  const maintenanceDisabledTooltip = isAlreadyUnderMaintenance
    ? `Room ${room.number} is already under maintenance.`
    : isOccupiedOrReserved
    ? `Room ${room.number} is ${derivedStatus.status === "OCCUPIED" ? "currently occupied" : "reserved"}. Maintenance cannot be scheduled until room is free.`
    : "Schedule room maintenance";

  const handleMarkFixed = (problemId: string) => {
    setFixingProblemId(problemId);
    startTransition(async () => {
      const res = await markProblemFixedAction({ problemId });
      setFixingProblemId(null);
      if (!res.ok) {
        toast.error("Failed to mark problem as fixed", {
          description: res.message,
        });
        return;
      }
      toast.success("Problem marked as resolved!");
      router.refresh();
    });
  };

  const handleConfirmRemove = () => {
    if (!maintenanceToRemove) return;
    setIsRemovingMaintenance(true);
    startTransition(async () => {
      const res = await deleteMaintenanceAction({
        maintenanceId: maintenanceToRemove.id,
      });
      setIsRemovingMaintenance(false);
      if (!res.ok) {
        toast.error("Failed to remove maintenance block", {
          description: res.message,
        });
        return;
      }
      toast.success("Maintenance block removed");
      setMaintenanceToRemove(null);
      router.refresh();
    });
  };

  const handleConfirmClose = () => {
    if (!maintenanceToClose) return;
    setIsClosingMaintenance(true);
    startTransition(async () => {
      const res = await closeMaintenanceAction({
        maintenanceId: maintenanceToClose.id,
        completionNote: closeCompletionNote.trim() || undefined,
      });
      setIsClosingMaintenance(false);
      if (!res.ok) {
        toast.error("Failed to close maintenance", {
          description: res.message,
        });
        return;
      }
      toast.success("Maintenance marked as completed and saved to history!");
      setMaintenanceToClose(null);
      setCloseCompletionNote("");
      router.refresh();
    });
  };

  return (
    <div className="space-y-6">
      {/* Top Breadcrumb & Actions Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <Link
          href="/rooms"
          className={cn(
            buttonVariants({ variant: "ghost", size: "sm" }),
            "-ml-2 text-muted-foreground hover:text-foreground"
          )}
        >
          <ChevronLeftIcon className="size-4 mr-1" />
          Back to All Rooms
        </Link>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsProblemDialogOpen(true)}
            className="gap-1.5 border-destructive/30 text-destructive hover:bg-destructive/10"
          >
            <ProblemIcon className="size-3.5" />
            <span>Report Problem</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            disabled={isMaintenanceDisabled}
            onClick={() => {
              if (isMaintenanceDisabled) return;
              setIsMaintenanceDialogOpen(true);
            }}
            title={maintenanceDisabledTooltip}
            className={cn(
              "gap-1.5 border-status-maintenance/30",
              isMaintenanceDisabled
                ? "opacity-50 cursor-not-allowed bg-muted text-muted-foreground border-border hover:bg-muted"
                : "text-status-maintenance hover:bg-status-maintenance/10"
            )}
          >
            <MaintenanceIcon className="size-3.5" />
            <span>Schedule Maintenance</span>
          </Button>
        </div>
      </div>

      {/* Main Room Hero Header */}
      <div className="p-5 sm:p-6 rounded-2xl bg-card border border-border shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="size-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0 border border-primary/20">
            <RoomIcon className="size-8" />
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-black font-mono tracking-tight text-foreground">
                Room {room.number}
              </h1>
              <StatusBadge status={derivedStatus.status} />
              {derivedStatus.hasProblem && (
                <Badge
                  variant="outline"
                  className="bg-destructive/10 text-destructive border-destructive/30 text-xs px-2 py-0.5 gap-1 font-bold"
                >
                  <ProblemIcon className="size-3" />
                  <span>
                    {derivedStatus.openProblemsCount} Issue
                    {derivedStatus.openProblemsCount > 1 ? "s" : ""}
                  </span>
                </Badge>
              )}
            </div>

            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <span className="font-semibold text-foreground/90 uppercase tracking-wide text-xs">
                {room.typeName}
              </span>
              <span>•</span>
              <span className="font-mono font-bold text-foreground">
                {formatINR(room.pricePerNight)}
              </span>
              <span>/ night</span>
              <span>•</span>
              <span className="text-xs">
                {room.isActive ? "Active in Inventory" : "Disabled"}
              </span>
            </p>
          </div>
        </div>

        {/* Quick Room Snapshot Stat Boxes */}
        <div className="grid grid-cols-3 gap-3 border-t md:border-t-0 md:border-l border-border pt-4 md:pt-0 md:pl-6 shrink-0">
          <div className="space-y-0.5">
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider block">
              Total Stays
            </span>
            <span className="text-xl font-bold font-mono text-foreground">
              {recentBookings.length}
            </span>
          </div>

          <div className="space-y-0.5">
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider block">
              Open Defects
            </span>
            <span className="text-xl font-bold font-mono text-destructive">
              {openProblems.length}
            </span>
          </div>

          <div className="space-y-0.5">
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider block">
              Maintenance
            </span>
            <span className="text-xl font-bold font-mono text-status-maintenance">
              {activeMaintenance.length}
            </span>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex border-b border-border gap-2">
        <button
          onClick={() => setActiveTab("stays")}
          className={cn(
            "pb-3 px-3 text-sm font-semibold transition-all relative flex items-center gap-2 cursor-pointer",
            activeTab === "stays"
              ? "text-primary border-b-2 border-primary"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <GuestIcon className="size-4" />
          <span>Stay & Booking</span>
        </button>

        <button
          onClick={() => setActiveTab("problems")}
          className={cn(
            "pb-3 px-3 text-sm font-semibold transition-all relative flex items-center gap-2 cursor-pointer",
            activeTab === "problems"
              ? "text-primary border-b-2 border-primary"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <ProblemIcon className="size-4" />
          <span>Room Problems</span>
          {openProblems.length > 0 && (
            <span className="size-5 rounded-full bg-destructive text-white text-[10px] font-bold flex items-center justify-center">
              {openProblems.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab("maintenance")}
          className={cn(
            "pb-3 px-3 text-sm font-semibold transition-all relative flex items-center gap-2 cursor-pointer",
            activeTab === "maintenance"
              ? "text-primary border-b-2 border-primary"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <MaintenanceIcon className="size-4" />
          <span>Maintenance Records</span>
          {activeMaintenance.length > 0 && (
            <span className="size-5 rounded-full bg-status-maintenance text-white text-[10px] font-bold flex items-center justify-center">
              {activeMaintenance.length}
            </span>
          )}
        </button>
      </div>

      {/* TAB 1: PROBLEMS */}
      {activeTab === "problems" && (
        <div className="space-y-6">
          {/* Open Problems Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-foreground">
                  Unresolved Issues ({openProblems.length})
                </h3>
                <p className="text-xs text-muted-foreground">
                  Active defects preventing optimal guest satisfaction.
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsProblemDialogOpen(true)}
                className="gap-1.5 text-xs"
              >
                <ProblemIcon className="size-3.5 text-destructive" />
                <span>Log New Issue</span>
              </Button>
            </div>

            {openProblems.length === 0 ? (
              <div className="p-8 rounded-xl border border-dashed border-border bg-card text-center space-y-2">
                <CheckIcon className="size-8 text-emerald-500 mx-auto" />
                <h4 className="text-sm font-semibold text-foreground">No Open Issues</h4>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  Room {room.number} currently has zero unresolved problems. Everything is reported clean and functional.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {openProblems.map((p) => {
                  const isFixing = fixingProblemId === p.id;
                  return (
                    <Card
                      key={p.id}
                      className="p-4 rounded-xl border border-destructive/30 bg-destructive/5 space-y-3 shadow-xs"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span
                          className={cn(
                            "px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider border",
                            SEVERITY_BADGE_STYLE[p.severity]
                          )}
                        >
                          {p.severity} Priority
                        </span>

                        <span className="text-[11px] text-muted-foreground font-mono">
                          {formatISTDateTime(p.reportedAt)}
                        </span>
                      </div>

                      <p className="text-sm font-medium text-foreground whitespace-pre-wrap">
                        {p.description}
                      </p>

                      <div className="pt-2 border-t border-destructive/20 flex items-center justify-between text-xs">
                        <span className="text-muted-foreground text-[11px]">
                          Reported by <strong className="text-foreground">{p.reportedByName}</strong>
                        </span>

                        <Button
                          size="xs"
                          onClick={() => handleMarkFixed(p.id)}
                          disabled={isFixing}
                          className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-xs"
                        >
                          {isFixing ? (
                            <SpinnerIcon className="size-3 animate-spin" />
                          ) : (
                            <CheckIcon className="size-3.5" />
                          )}
                          <span>Mark Fixed</span>
                        </Button>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>

          {/* Resolved History */}
          {resolvedProblems.length > 0 && (
            <div className="space-y-3 pt-4 border-t border-border">
              <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">
                Resolved Issues History ({resolvedProblems.length})
              </h3>

              <div className="space-y-2">
                {resolvedProblems.map((p) => (
                  <div
                    key={p.id}
                    className="p-3.5 rounded-xl border border-border bg-card/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                  >
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            "px-1.5 py-0.5 rounded text-[10px] font-bold uppercase border",
                            SEVERITY_BADGE_STYLE[p.severity]
                          )}
                        >
                          {p.severity}
                        </span>
                        <span className="font-semibold text-foreground">
                          {p.description}
                        </span>
                      </div>
                      <span className="text-muted-foreground text-[11px] block">
                        Reported by {p.reportedByName} on {formatISTDateTime(p.reportedAt)}
                      </span>
                    </div>

                    <div className="sm:text-right shrink-0">
                      <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold text-xs">
                        <CheckIcon className="size-3" /> Fixed by {p.fixedByName || "Staff"}
                      </span>
                      {p.fixedAt && (
                        <span className="text-muted-foreground text-[11px] block font-mono">
                          {formatISTDateTime(p.fixedAt)}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: MAINTENANCE */}
      {activeTab === "maintenance" && (
        <div className="space-y-6">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-foreground">
                  Scheduled Maintenance Periods
                </h3>
                <p className="text-xs text-muted-foreground">
                  Periods where the room is blocked from booking for service and repairs.
                </p>
              </div>

              <Button
                size="sm"
                disabled={isMaintenanceDisabled}
                onClick={() => {
                  if (isMaintenanceDisabled) return;
                  setIsMaintenanceDialogOpen(true);
                }}
                title={maintenanceDisabledTooltip}
                className={cn(
                  "gap-1.5 text-xs text-white",
                  isMaintenanceDisabled
                    ? "opacity-50 cursor-not-allowed bg-muted text-muted-foreground hover:bg-muted"
                    : "bg-status-maintenance hover:bg-status-maintenance/90"
                )}
              >
                <MaintenanceIcon className="size-3.5" />
                <span>Schedule Maintenance</span>
              </Button>
            </div>

            {isOccupiedOrReserved && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-900 dark:text-amber-200 text-xs flex items-center gap-2">
                <ProblemIcon className="size-4 shrink-0 text-amber-600 dark:text-amber-400" />
                <span>
                  Room {room.number} is {derivedStatus.status === "OCCUPIED" ? "currently occupied by a guest" : "reserved"}. Maintenance cannot be scheduled until the room is free after check-out.
                </span>
              </div>
            )}

            {activeMaintenance.length === 0 ? (
              <div className="p-8 rounded-xl border border-dashed border-border bg-card text-center space-y-2">
                <MaintenanceIcon className="size-8 text-muted-foreground mx-auto" />
                <h4 className="text-sm font-semibold text-foreground">No Maintenance Scheduled</h4>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  Room {room.number} is fully available for reservations with no upcoming maintenance blocks.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {activeMaintenance.map((m) => {
                  return (
                    <Card
                      key={m.id}
                      className={cn(
                        "p-4 rounded-xl border shadow-xs space-y-3",
                        m.isCurrentlyActive
                          ? "border-status-maintenance/50 bg-status-maintenance/10"
                          : "border-border bg-card"
                      )}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <MaintenanceIcon className="size-4 text-status-maintenance" />
                          <span className="text-sm font-bold text-foreground">
                            {m.reason}
                          </span>
                          {m.isCurrentlyActive && (
                            <Badge className="bg-status-maintenance text-white text-[10px] font-bold">
                              In Progress Right Now
                            </Badge>
                          )}
                        </div>

                        {/* Two Maintenance Actions: Close Maintenance & Remove Block */}
                        <div className="flex items-center gap-2 self-start sm:self-auto">
                          <Button
                            type="button"
                            variant="outline"
                            size="xs"
                            onClick={() => {
                              setCloseCompletionNote("");
                              setMaintenanceToClose(m);
                            }}
                            disabled={isRemovingMaintenance || isClosingMaintenance}
                            className="gap-1 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10 font-semibold"
                          >
                            <CircleCheckIcon className="size-3 text-emerald-600 dark:text-emerald-400" />
                            <span>Close Maintenance</span>
                          </Button>

                          <Button
                            type="button"
                            variant="ghost"
                            size="xs"
                            onClick={() => setMaintenanceToRemove(m)}
                            disabled={isRemovingMaintenance || isClosingMaintenance}
                            className="gap-1 text-destructive hover:bg-destructive/10"
                          >
                            <DeleteIcon className="size-3" />
                            <span>Remove Block</span>
                          </Button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-background/50 p-3 rounded-lg border border-border/60">
                        <div>
                          <span className="text-muted-foreground block text-[11px]">
                            Starts At (IST)
                          </span>
                          <span className="font-semibold text-foreground font-mono">
                            {formatISTDateTime(m.startsAt)}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground block text-[11px]">
                            Ends At (IST)
                          </span>
                          <span className="font-semibold text-foreground font-mono">
                            {formatISTDateTime(m.endsAt)}
                          </span>
                        </div>
                      </div>

                      <div className="text-[11px] text-muted-foreground">
                        Scheduled by <strong className="text-foreground">{m.createdByName}</strong>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>

          {/* Past Maintenance Records */}
          {pastMaintenance.length > 0 && (
            <div className="space-y-3 pt-4 border-t border-border">
              <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">
                Past Maintenance History ({pastMaintenance.length})
              </h3>

              <div className="space-y-2">
                {pastMaintenance.map((m) => (
                  <div
                    key={m.id}
                    className="p-3.5 rounded-xl border border-border bg-card/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                  >
                    <div className="space-y-0.5">
                      <span className="font-semibold text-foreground">
                        {m.reason}
                      </span>
                      <span className="text-muted-foreground text-[11px] block">
                        Logged by {m.createdByName}
                      </span>
                    </div>

                    <div className="sm:text-right font-mono text-[11px] text-muted-foreground">
                      {formatISTDate(m.startsAt)} — {formatISTDate(m.endsAt)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: STAYS & BOOKINGS */}
      {activeTab === "stays" && (
        <div className="space-y-6">
          {/* Current Active Stay if any */}
          {currentBooking && (
            <div className="space-y-2">
              <h3 className="text-base font-bold text-foreground">
                Current Active Stay
              </h3>
              <div className="p-4 rounded-xl border border-status-occupied/30 bg-status-occupied/5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-status-occupied uppercase text-xs tracking-wider">
                    {currentBooking.status === "CHECKED_IN" ? "Guest In Room" : "Reserved Stay"}
                  </span>
                  <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-status-occupied/15 text-status-occupied">
                    {currentBooking.reference}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Primary Guest</span>
                    <span className="font-bold text-sm text-foreground">
                      {currentBooking.guests.find((g) => g.isPrimary)?.name || "Guest"}
                    </span>
                    {currentBooking.guests.find((g) => g.isPrimary)?.mobile && (
                      <span className="text-muted-foreground block font-mono">
                        {currentBooking.guests.find((g) => g.isPrimary)?.mobile}
                      </span>
                    )}
                  </div>

                  <div>
                    <span className="text-muted-foreground block text-[11px]">Stay Dates</span>
                    <span className="font-medium text-foreground">
                      {formatISTDate(currentBooking.checkInAt)} — {formatISTDate(currentBooking.checkOutAt)}
                    </span>
                  </div>

                  <div className="flex items-center sm:justify-end">
                    <Link
                      href={`/bookings/${currentBooking.id}`}
                      className={buttonVariants({ variant: "default", size: "sm" })}
                    >
                      Manage Stay Details
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Stays History Table */}
          <div className="space-y-3">
            <h3 className="text-base font-bold text-foreground">
              Recent Room History ({recentBookings.length})
            </h3>

            {recentBookings.length === 0 ? (
              <div className="p-8 rounded-xl border border-dashed border-border bg-card text-center text-sm text-muted-foreground">
                No past stays recorded for Room {room.number}.
              </div>
            ) : (
              <div className="rounded-xl border border-border bg-card overflow-hidden shadow-2xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-muted/50 border-b border-border text-muted-foreground font-semibold">
                      <tr>
                        <th className="py-2.5 px-3">Reference</th>
                        <th className="py-2.5 px-3">Primary Guest</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3">Check-In</th>
                        <th className="py-2.5 px-3">Check-Out</th>
                        <th className="py-2.5 px-3">Rate</th>
                        <th className="py-2.5 px-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {paginatedBookings.map((b) => (
                        <tr key={b.id} className="hover:bg-muted/20">
                          <td className="py-2.5 px-3 font-mono font-semibold text-foreground">
                            {b.reference}
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="font-medium text-foreground block">
                              {b.primaryGuestName}
                            </span>
                            {b.primaryGuestMobile && (
                              <span className="text-[11px] text-muted-foreground font-mono">
                                {b.primaryGuestMobile}
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3">
                            <StatusBadge status={b.status as StatusType} />
                          </td>
                          <td className="py-2.5 px-3 text-muted-foreground">
                            {formatISTDate(b.checkInAt)}
                          </td>
                          <td className="py-2.5 px-3 text-muted-foreground">
                            {formatISTDate(b.checkOutAt)}
                          </td>
                          <td className="py-2.5 px-3 font-mono font-semibold">
                            {formatINR(b.rateApplied)}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <Link
                              href={`/bookings/${b.id}`}
                              className={cn(
                                buttonVariants({ variant: "ghost", size: "xs" }),
                                "h-7 px-2 text-xs"
                              )}
                            >
                              View
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Controls */}
                <TablePagination
                  currentPage={safePage}
                  totalRecords={totalRecords}
                  pageSize={PAGE_SIZE}
                  onPageChange={(page) => setCurrentPage(page)}
                  recordLabel="records"
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Dialogs */}
      <LogProblemDialog
        open={isProblemDialogOpen}
        onOpenChange={setIsProblemDialogOpen}
        room={{ id: room.id, number: room.number }}
        onSuccess={() => router.refresh()}
      />

      <CreateMaintenanceDialog
        open={isMaintenanceDialogOpen}
        onOpenChange={setIsMaintenanceDialogOpen}
        room={{ id: room.id, number: room.number }}
        onSuccess={() => router.refresh()}
      />

      {/* 1. Custom Confirmation Modal: Remove Maintenance Block */}
      <AlertDialog
        open={!!maintenanceToRemove}
        onOpenChange={(open) => {
          if (!open && !isRemovingMaintenance) {
            setMaintenanceToRemove(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <DeleteIcon className="size-5" />
              <span>Remove Maintenance Block?</span>
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove this maintenance block for Room {room.number}?
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-3 py-1 text-xs">
            <div className="rounded-lg border border-border bg-muted/40 p-3 space-y-1.5">
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block">
                  Reason
                </span>
                <span className="font-medium text-foreground">{maintenanceToRemove?.reason}</span>
              </div>
              <div className="flex items-center justify-between text-muted-foreground pt-1 border-t border-border/60 text-[11px] font-mono">
                <span>Scheduled:</span>
                <span>
                  {maintenanceToRemove?.startsAt ? formatISTDateTime(maintenanceToRemove.startsAt) : ""} —{" "}
                  {maintenanceToRemove?.endsAt ? formatISTDateTime(maintenanceToRemove.endsAt) : ""}
                </span>
              </div>
            </div>

            <p className="text-muted-foreground">
              This action will completely delete the block <strong>without adding an entry to maintenance history</strong>. Use this if the maintenance was created accidentally.
            </p>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRemovingMaintenance}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleConfirmRemove();
              }}
              disabled={isRemovingMaintenance}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground font-semibold"
            >
              {isRemovingMaintenance ? (
                <SpinnerIcon className="size-3.5 animate-spin mr-1.5" />
              ) : (
                <DeleteIcon className="size-3.5 mr-1.5" />
              )}
              Confirm & Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 2. Custom Confirmation Modal: Close Maintenance Early */}
      <AlertDialog
        open={!!maintenanceToClose}
        onOpenChange={(open) => {
          if (!open && !isClosingMaintenance) {
            setMaintenanceToClose(null);
            setCloseCompletionNote("");
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
              <CircleCheckIcon className="size-5" />
              <span>Close Maintenance Early?</span>
            </AlertDialogTitle>
            <AlertDialogDescription>
              Mark maintenance as completed early for Room {room.number}.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-3 py-1 text-xs">
            <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/10 p-3 space-y-1.5">
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-800 dark:text-emerald-300 block">
                  Maintenance Reason
                </span>
                <span className="font-medium text-foreground">{maintenanceToClose?.reason}</span>
              </div>
              <div className="flex items-center justify-between text-muted-foreground pt-1 border-t border-emerald-500/20 text-[11px]">
                <span>Scheduled end:</span>
                <span className="font-mono text-foreground font-semibold">
                  {maintenanceToClose?.endsAt ? formatISTDateTime(maintenanceToClose.endsAt) : "-"}
                </span>
              </div>
              <div className="flex items-center justify-between text-muted-foreground text-[11px]">
                <span>Actual completion date:</span>
                <span className="font-mono text-emerald-700 dark:text-emerald-400 font-bold">
                  Now (Completed)
                </span>
              </div>
            </div>

            <div className="space-y-1.5 text-left">
              <Label htmlFor="close-maintenance-note" className="text-xs font-semibold text-foreground">
                Completion Note (Optional)
              </Label>
              <Input
                id="close-maintenance-note"
                placeholder="e.g. Repairs completed and verified operational"
                value={closeCompletionNote}
                onChange={(e) => setCloseCompletionNote(e.target.value)}
                className="h-9 text-xs"
                disabled={isClosingMaintenance}
              />
            </div>

            <p className="text-muted-foreground">
              Closing maintenance will immediately restore room availability and save this completed entry into the room&apos;s <strong>Past Maintenance History</strong>.
            </p>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={isClosingMaintenance}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleConfirmClose();
              }}
              disabled={isClosingMaintenance}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
            >
              {isClosingMaintenance ? (
                <SpinnerIcon className="size-3.5 animate-spin mr-1.5" />
              ) : (
                <CheckIcon className="size-3.5 mr-1.5" />
              )}
              Confirm & Close Maintenance
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
