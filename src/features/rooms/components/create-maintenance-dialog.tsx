"use client";

import { useState, useTransition, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SelectDropdown } from "@/components/ui/select-dropdown";
import {
  createMaintenanceAction,
  checkMaintenanceConflictsAction,
} from "@/server/actions/room-maintenance.actions";
import { MaintenanceIcon, SpinnerIcon, ProblemIcon } from "@/lib/icons";
import { toast } from "sonner";
import { formatIST, startOfISTDay, endOfISTDay } from "@/lib/datetime";
import { addDays } from "date-fns";

interface CreateMaintenanceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  room?: { id: string; number: string };
  rooms?: Array<{ id: string; number: string }>;
  onSuccess?: () => void;
}

interface ConflictingBooking {
  id: string;
  reference: string;
  status: string;
  guestName: string;
  checkInAt: Date;
  checkOutAt: Date;
}

interface ConflictingMaintenance {
  id: string;
  reason: string;
  startsAt: Date | string;
  endsAt: Date | string;
}

export function CreateMaintenanceDialog({
  open,
  onOpenChange,
  room,
  rooms = [],
  onSuccess,
}: CreateMaintenanceDialogProps) {
  const [selectedRoomId, setSelectedRoomId] = useState<string>(room?.id || "");
  const [reason, setReason] = useState("");

  // Default to today from now until tomorrow 12:00 PM IST
  const getInitialDates = () => {
    const now = new Date();
    const startStr = formatIST(now, "yyyy-MM-dd'T'HH:mm");
    const tomorrowNoon = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const endStr = formatIST(tomorrowNoon, "yyyy-MM-dd'T'12:00");
    return { startStr, endStr };
  };

  const [startsAt, setStartsAt] = useState(() => getInitialDates().startStr);
  const [endsAt, setEndsAt] = useState(() => getInitialDates().endStr);
  const [confirmOverlap, setConfirmOverlap] = useState(false);
  const [bookingConflicts, setBookingConflicts] = useState<ConflictingBooking[]>([]);
  const [maintenanceConflicts, setMaintenanceConflicts] = useState<ConflictingMaintenance[]>([]);
  const [roomUpcomingMaintenance, setRoomUpcomingMaintenance] = useState<ConflictingMaintenance[]>([]);
  const [isCheckingConflicts, setIsCheckingConflicts] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const activeRoomId = room?.id || selectedRoomId;
  const activeRoomNumber =
    room?.number || rooms.find((r) => r.id === activeRoomId)?.number || "";

  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      const { startStr, endStr } = getInitialDates();
      setStartsAt(startStr);
      setEndsAt(endStr);
      setReason("");
      setConfirmOverlap(false);
      setErrorMsg(null);
      setBookingConflicts([]);
      setMaintenanceConflicts([]);
      if (room?.id) {
        setSelectedRoomId(room.id);
      }
    }
  }

  // Presets
  const applyPreset = (preset: "restOfDay" | "tomorrow" | "threeDays" | "oneWeek") => {
    const now = new Date();
    if (preset === "restOfDay") {
      setStartsAt(formatIST(now, "yyyy-MM-dd'T'HH:mm"));
      setEndsAt(formatIST(endOfISTDay(now), "yyyy-MM-dd'T'23:59"));
    } else if (preset === "tomorrow") {
      const tmrw = addDays(now, 1);
      setStartsAt(formatIST(startOfISTDay(tmrw), "yyyy-MM-dd'T'00:00"));
      setEndsAt(formatIST(endOfISTDay(tmrw), "yyyy-MM-dd'T'23:59"));
    } else if (preset === "threeDays") {
      setStartsAt(formatIST(now, "yyyy-MM-dd'T'HH:mm"));
      setEndsAt(formatIST(addDays(now, 3), "yyyy-MM-dd'T'12:00"));
    } else if (preset === "oneWeek") {
      setStartsAt(formatIST(now, "yyyy-MM-dd'T'HH:mm"));
      setEndsAt(formatIST(addDays(now, 7), "yyyy-MM-dd'T'12:00"));
    }
  };

  // Check conflicts whenever room, start or end change
  useEffect(() => {
    if (!open || !activeRoomId || !startsAt || !endsAt) {
      return;
    }

    const s = new Date(startsAt);
    const e = new Date(endsAt);
    if (isNaN(s.getTime()) || isNaN(e.getTime()) || e <= s) {
      return;
    }

    let isSubscribed = true;
    checkMaintenanceConflictsAction({
      roomId: activeRoomId,
      startsAt: s.toISOString(),
      endsAt: e.toISOString(),
    }).then((res) => {
      if (!isSubscribed) return;
      setIsCheckingConflicts(false);
      if (res.ok && res.data) {
        const data = res.data as {
          bookings?: ConflictingBooking[];
          maintenance?: ConflictingMaintenance[];
          roomUpcomingMaintenance?: ConflictingMaintenance[];
        };
        setBookingConflicts(data.bookings || []);
        setMaintenanceConflicts(data.maintenance || []);
        setRoomUpcomingMaintenance(data.roomUpcomingMaintenance || []);
      } else {
        setBookingConflicts([]);
        setMaintenanceConflicts([]);
        setRoomUpcomingMaintenance([]);
      }
    });

    return () => {
      isSubscribed = false;
    };
  }, [open, activeRoomId, startsAt, endsAt]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeRoomId) {
      setErrorMsg("Please select a room.");
      return;
    }
    if (!startsAt || !endsAt) {
      setErrorMsg("Start and end dates are required.");
      return;
    }
    const s = new Date(startsAt);
    const end = new Date(endsAt);
    if (end <= s) {
      setErrorMsg("End date/time must be strictly after start date/time.");
      return;
    }
    if (reason.trim().length < 3) {
      setErrorMsg("Please provide a reason (at least 3 characters).");
      return;
    }

    if (maintenanceConflicts.length > 0) {
      setErrorMsg(
        `A maintenance period (${maintenanceConflicts[0].reason}) is already scheduled during this time. Please choose different dates.`
      );
      return;
    }

    if (bookingConflicts.length > 0 && !confirmOverlap) {
      setErrorMsg(
        `There are ${bookingConflicts.length} overlapping booking(s). Check the confirmation box below to proceed.`
      );
      return;
    }

    setErrorMsg(null);
    startTransition(async () => {
      const res = await createMaintenanceAction({
        roomId: activeRoomId,
        startsAt: s.toISOString(),
        endsAt: end.toISOString(),
        reason: reason.trim(),
        confirmOverlap,
      });

      if (!res.ok) {
        setErrorMsg(res.message || "Failed to schedule maintenance");
        return;
      }

      toast.success(`Maintenance scheduled for Room ${activeRoomNumber}`, {
        description: `Room is blocked from ${formatIST(s, "dd MMM, hh:mm a")} to ${formatIST(end, "dd MMM, hh:mm a")}.`,
      });
      setReason("");
      setConfirmOverlap(false);
      onOpenChange(false);
      onSuccess?.();
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-xl bg-status-maintenance/15 text-status-maintenance flex items-center justify-center shrink-0">
                <MaintenanceIcon className="size-5" />
              </div>
              <div className="space-y-0.5">
                <DialogTitle className="text-lg">
                  {room ? `Schedule Maintenance — Room ${room.number}` : "Schedule Room Maintenance"}
                </DialogTitle>
                <DialogDescription>
                  Blocks the room from new reservations and marks it as out-of-service on the calendar.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Room Selector if room not pre-selected */}
            {!room && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">
                  Select Room <span className="text-destructive">*</span>
                </label>
                <SelectDropdown
                  value={selectedRoomId}
                  onChange={setSelectedRoomId}
                  options={rooms.map((r) => ({
                    value: r.id,
                    label: `Room ${r.number}`,
                  }))}
                  placeholder="Choose room..."
                />
              </div>
            )}

            {/* Quick Presets */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Quick Duration Presets
              </label>
              <div className="flex flex-wrap gap-1.5">
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  onClick={() => applyPreset("restOfDay")}
                  className="text-xs h-7"
                >
                  Rest of Today
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  onClick={() => applyPreset("tomorrow")}
                  className="text-xs h-7"
                >
                  Tomorrow
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  onClick={() => applyPreset("threeDays")}
                  className="text-xs h-7"
                >
                  3 Days
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  onClick={() => applyPreset("oneWeek")}
                  className="text-xs h-7"
                >
                  1 Week
                </Button>
              </div>
            </div>

            {/* Start and End Times */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">
                  Starts At (IST) <span className="text-destructive">*</span>
                </label>
                <Input
                  type="datetime-local"
                  value={startsAt}
                  onChange={(e) => setStartsAt(e.target.value)}
                  className="text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">
                  Ends At (IST) <span className="text-destructive">*</span>
                </label>
                <Input
                  type="datetime-local"
                  value={endsAt}
                  onChange={(e) => setEndsAt(e.target.value)}
                  className="text-xs"
                />
              </div>
            </div>

            {/* Existing Scheduled Maintenance on Selected Room */}
            {roomUpcomingMaintenance.length > 0 && (
              <div className="p-3 rounded-xl bg-status-maintenance/10 border border-status-maintenance/20 space-y-1.5 text-xs">
                <div className="flex items-center gap-1.5 font-semibold text-status-maintenance">
                  <MaintenanceIcon className="size-3.5 shrink-0" />
                  <span>
                    Existing Maintenance on Room {activeRoomNumber} ({roomUpcomingMaintenance.length})
                  </span>
                </div>
                <div className="space-y-1 pl-5">
                  {roomUpcomingMaintenance.map((m) => (
                    <div
                      key={m.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[11px] text-muted-foreground"
                    >
                      <span className="font-medium text-foreground">
                        &ldquo;{m.reason}&rdquo;
                      </span>
                      <span className="font-mono text-status-maintenance/90 font-medium">
                        {formatIST(new Date(m.startsAt), "dd MMM, hh:mm a")} – {formatIST(new Date(m.endsAt), "dd MMM, hh:mm a")}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Overlap Conflict Warning Boxes */}
            {isCheckingConflicts ? (
              <div className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/40 text-xs text-muted-foreground">
                <SpinnerIcon className="size-3.5 animate-spin" />
                <span>Checking room schedule...</span>
              </div>
            ) : null}

            {/* Maintenance Collision Warning */}
            {maintenanceConflicts.length > 0 && (
              <div className="p-3.5 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive space-y-2.5">
                <div className="flex items-start gap-2">
                  <ProblemIcon className="size-4 text-destructive shrink-0 mt-0.5" />
                  <div className="space-y-1 text-xs">
                    <span className="font-bold">
                      Maintenance Collision Detected
                    </span>
                    <p className="text-destructive/90 text-[11px] leading-tight">
                      A maintenance period is already scheduled for this room during this time. Two maintenance blocks cannot overlap. Please adjust the start or end dates.
                    </p>
                  </div>
                </div>

                <div className="space-y-1.5 pl-6">
                  {maintenanceConflicts.map((m) => (
                    <div
                      key={m.id}
                      className="flex items-center justify-between text-[11px] bg-background/80 p-2 rounded border border-destructive/20 text-foreground"
                    >
                      <span className="font-semibold text-destructive">
                        {m.reason}
                      </span>
                      <span className="font-mono text-muted-foreground">
                        {formatIST(new Date(m.startsAt), "dd MMM, hh:mm a")} – {formatIST(new Date(m.endsAt), "dd MMM, hh:mm a")}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Booking Overlap Conflict Warning Box */}
            {bookingConflicts.length > 0 && (
              <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 space-y-2.5">
                <div className="flex items-start gap-2">
                  <ProblemIcon className="size-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <div className="space-y-1 text-xs">
                    <span className="font-bold">
                      {bookingConflicts.length} Overlapping Booking{bookingConflicts.length > 1 ? "s" : ""} Detected
                    </span>
                    <p className="text-muted-foreground text-[11px] leading-tight">
                      Existing reservations collide with this maintenance schedule. Assigning maintenance will block this room and may require guest reallocation.
                    </p>
                  </div>
                </div>

                <div className="space-y-1.5 pl-6">
                  {bookingConflicts.map((c) => (
                    <div
                      key={c.id}
                      className="flex items-center justify-between text-[11px] bg-background/60 p-2 rounded border border-amber-500/20"
                    >
                      <span className="font-semibold">{c.guestName}</span>
                      <span className="font-mono text-muted-foreground">
                        {c.reference} ({formatIST(new Date(c.checkInAt), "dd MMM")} - {formatIST(new Date(c.checkOutAt), "dd MMM")})
                      </span>
                    </div>
                  ))}
                </div>

                <label className="flex items-center gap-2 pt-1 text-xs font-semibold cursor-pointer pl-6">
                  <input
                    type="checkbox"
                    checked={confirmOverlap}
                    onChange={(e) => setConfirmOverlap(e.target.checked)}
                    className="rounded border-amber-500 text-amber-600 focus:ring-amber-500 size-4"
                  />
                  <span>Confirm and schedule maintenance anyway</span>
                </label>
              </div>
            )}

            {/* Reason Textarea */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <label className="font-semibold text-foreground">
                  Reason / Work Description <span className="text-destructive">*</span>
                </label>
                <span className="text-muted-foreground text-[11px]">
                  {reason.length}/500
                </span>
              </div>
              <Textarea
                placeholder="e.g. AC compressor replacement, painting, wall repair, plumbing overhaul..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={500}
                rows={2}
                className="resize-none text-sm"
              />
            </div>

            {errorMsg && (
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-xs font-medium text-destructive">
                {errorMsg}
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isPending || maintenanceConflicts.length > 0}
              className="gap-1.5"
            >
              {isPending && <SpinnerIcon className="size-3.5 animate-spin" />}
              <span>Schedule Maintenance</span>
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
