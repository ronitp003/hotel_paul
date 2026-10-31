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
import { Label } from "@/components/ui/label";
import { DateInput } from "@/components/ui/date-input";
import { Textarea } from "@/components/ui/textarea";
import { SelectDropdown } from "@/components/ui/select-dropdown";
import {
  createMaintenanceAction,
  checkMaintenanceConflictsAction,
} from "@/server/actions/room-maintenance.actions";
import {
  MaintenanceIcon,
  SpinnerIcon,
  ProblemIcon,
  ClockIcon,
  CalendarIcon,
} from "@/lib/icons";
import { toast } from "sonner";
import { formatIST, startOfISTDay, endOfISTDay, fromISTInput } from "@/lib/datetime";
import { addDays } from "date-fns";

interface CreateMaintenanceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  room?: { id: string; number: string; status?: string };
  rooms?: Array<{ id: string; number: string; status?: string }>;
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
    const startDate = formatIST(now, "yyyy-MM-dd");
    const startTime = formatIST(now, "HH:mm");
    const tomorrowNoon = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const endDate = formatIST(tomorrowNoon, "yyyy-MM-dd");
    const endTime = "12:00";
    return { startDate, startTime, endDate, endTime };
  };

  const [startDate, setStartDate] = useState(() => getInitialDates().startDate);
  const [startTime, setStartTime] = useState(() => getInitialDates().startTime);
  const [endDate, setEndDate] = useState(() => getInitialDates().endDate);
  const [endTime, setEndTime] = useState(() => getInitialDates().endTime);

  const startsAt = startDate && startTime ? `${startDate}T${startTime}` : "";
  const endsAt = endDate && endTime ? `${endDate}T${endTime}` : "";
  const [bookingConflicts, setBookingConflicts] = useState<ConflictingBooking[]>([]);
  const [maintenanceConflicts, setMaintenanceConflicts] = useState<ConflictingMaintenance[]>([]);
  const [roomUpcomingMaintenance, setRoomUpcomingMaintenance] = useState<ConflictingMaintenance[]>([]);
  const [isCheckingConflicts, setIsCheckingConflicts] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const durationSummary = (() => {
    if (!startDate || !startTime || !endDate || !endTime) return null;
    const s = new Date(`${startDate}T${startTime}`);
    const e = new Date(`${endDate}T${endTime}`);
    if (isNaN(s.getTime()) || isNaN(e.getTime()) || e <= s) return null;
    const diffMs = e.getTime() - s.getTime();
    const totalMinutes = Math.round(diffMs / (1000 * 60));
    const days = Math.floor(totalMinutes / (24 * 60));
    const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
    const mins = totalMinutes % 60;

    const parts: string[] = [];
    if (days > 0) parts.push(`${days} day${days > 1 ? "s" : ""}`);
    if (hours > 0) parts.push(`${hours} hr${hours > 1 ? "s" : ""}`);
    if (mins > 0 && days === 0) parts.push(`${mins} min${mins > 1 ? "s" : ""}`);
    return parts.join(", ") || "< 1 min";
  })();

  // Only free / available rooms can have maintenance scheduled from the selector
  const availableRooms = rooms.filter(
    (r) =>
      r.status === "AVAILABLE" ||
      (!r.status &&
        r.status !== "OCCUPIED" &&
        r.status !== "MAINTENANCE" &&
        r.status !== "RESERVED")
  );

  const activeRoomId = room?.id || selectedRoomId;
  const activeRoomNumber =
    room?.number || rooms.find((r) => r.id === activeRoomId)?.number || "";

  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      const init = getInitialDates();
      setStartDate(init.startDate);
      setStartTime(init.startTime);
      setEndDate(init.endDate);
      setEndTime(init.endTime);
      setReason("");
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
      setStartDate(formatIST(now, "yyyy-MM-dd"));
      setStartTime(formatIST(now, "HH:mm"));
      setEndDate(formatIST(now, "yyyy-MM-dd"));
      setEndTime("23:59");
    } else if (preset === "tomorrow") {
      const tmrw = addDays(now, 1);
      setStartDate(formatIST(startOfISTDay(tmrw), "yyyy-MM-dd"));
      setStartTime("00:00");
      setEndDate(formatIST(endOfISTDay(tmrw), "yyyy-MM-dd"));
      setEndTime("23:59");
    } else if (preset === "threeDays") {
      setStartDate(formatIST(now, "yyyy-MM-dd"));
      setStartTime(formatIST(now, "HH:mm"));
      setEndDate(formatIST(addDays(now, 3), "yyyy-MM-dd"));
      setEndTime("12:00");
    } else if (preset === "oneWeek") {
      setStartDate(formatIST(now, "yyyy-MM-dd"));
      setStartTime(formatIST(now, "HH:mm"));
      setEndDate(formatIST(addDays(now, 7), "yyyy-MM-dd"));
      setEndTime("12:00");
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

    if (bookingConflicts.length > 0) {
      setErrorMsg(
        `Cannot schedule maintenance: Room ${activeRoomNumber} is currently occupied or reserved during this period. Maintenance cannot be added until the room is free.`
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
      });

      if (!res.ok) {
        setErrorMsg(res.message || "Failed to schedule maintenance");
        return;
      }

      toast.success(`Maintenance scheduled for Room ${activeRoomNumber}`, {
        description: `Room is blocked from ${formatIST(s, "dd MMM, hh:mm a")} to ${formatIST(end, "dd MMM, hh:mm a")}.`,
      });
      setReason("");
      onOpenChange(false);
      onSuccess?.();
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[92vh] overflow-y-auto p-5 sm:p-6">
        <form onSubmit={handleSubmit}>
          <DialogHeader className="pb-3 border-b border-border/60">
            <div className="flex items-center gap-3.5">
              <div className="size-11 rounded-xl bg-status-maintenance/15 text-status-maintenance flex items-center justify-center shrink-0 border border-status-maintenance/25 shadow-xs">
                <MaintenanceIcon className="size-5" />
              </div>
              <div className="space-y-0.5">
                <DialogTitle className="text-xl font-bold tracking-tight">
                  {room ? `Schedule Maintenance — Room ${room.number}` : "Schedule Room Maintenance"}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground leading-relaxed">
                  Blocks the room from new reservations and marks it as out-of-service on the calendar.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-5 py-4">
            {/* Room Selector if room not pre-selected */}
            {!room && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-foreground">
                    Select Room <span className="text-destructive">*</span>
                  </label>
                  <span className="text-[11px] text-muted-foreground font-medium">
                    {availableRooms.length} available room{availableRooms.length === 1 ? "" : "s"}
                  </span>
                </div>
                <SelectDropdown
                  value={selectedRoomId}
                  onChange={setSelectedRoomId}
                  options={availableRooms.map((r) => ({
                    value: r.id,
                    label: `Room ${r.number}`,
                  }))}
                  placeholder={
                    availableRooms.length === 0
                      ? "No free rooms available"
                      : "Choose room..."
                  }
                  disabled={availableRooms.length === 0}
                />
                {availableRooms.length === 0 && (
                  <p className="text-[11px] text-muted-foreground">
                    No free rooms available right now. Maintenance cannot be scheduled on occupied or active maintenance rooms.
                  </p>
                )}
              </div>
            )}

            {/* Quick Presets */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <ClockIcon className="size-3.5 text-muted-foreground" />
                  <span>Quick Duration Presets</span>
                </label>
                <span className="text-[11px] text-muted-foreground font-normal">
                  Auto-fill schedule
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => applyPreset("restOfDay")}
                  className="text-xs h-8 bg-background hover:bg-muted/60 transition-colors shadow-2xs"
                >
                  Rest of Today
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => applyPreset("tomorrow")}
                  className="text-xs h-8 bg-background hover:bg-muted/60 transition-colors shadow-2xs"
                >
                  Tomorrow
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => applyPreset("threeDays")}
                  className="text-xs h-8 bg-background hover:bg-muted/60 transition-colors shadow-2xs"
                >
                  3 Days
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => applyPreset("oneWeek")}
                  className="text-xs h-8 bg-background hover:bg-muted/60 transition-colors shadow-2xs"
                >
                  1 Week
                </Button>
              </div>
            </div>

            {/* Start and End Times with separated Date and Time fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Starts At (IST) */}
              <div className="p-4 rounded-xl border border-border/80 bg-muted/20 space-y-3.5">
                <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-border/60">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="size-2 rounded-full bg-primary shrink-0" />
                    <span className="text-xs font-semibold text-foreground truncate">
                      Starts At (IST) <span className="text-destructive">*</span>
                    </span>
                  </div>
                  {startsAt && (
                    <span className="text-[11px] font-mono font-medium px-2 py-0.5 rounded-md bg-background border border-border/80 text-foreground shrink-0 shadow-2xs">
                      {formatIST(fromISTInput(startsAt), "dd MMM, hh:mm a")}
                    </span>
                  )}
                </div>

                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                      <CalendarIcon className="size-3.5 text-muted-foreground" />
                      <span>Date (DD/MM/YYYY)</span>
                    </Label>
                    <DateInput
                      value={startDate}
                      onChange={setStartDate}
                      className="text-xs h-9 font-mono bg-background"
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                      <ClockIcon className="size-3.5 text-muted-foreground" />
                      <span>Start Time</span>
                    </Label>
                    <Input
                      type="time"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      className="text-sm font-medium h-9 bg-background px-3"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Ends At (IST) */}
              <div className="p-4 rounded-xl border border-border/80 bg-muted/20 space-y-3.5">
                <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-border/60">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="size-2 rounded-full bg-status-maintenance shrink-0" />
                    <span className="text-xs font-semibold text-foreground truncate">
                      Ends At (IST) <span className="text-destructive">*</span>
                    </span>
                  </div>
                  {endsAt && (
                    <span className="text-[11px] font-mono font-medium px-2 py-0.5 rounded-md bg-background border border-border/80 text-foreground shrink-0 shadow-2xs">
                      {formatIST(fromISTInput(endsAt), "dd MMM, hh:mm a")}
                    </span>
                  )}
                </div>

                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                      <CalendarIcon className="size-3.5 text-muted-foreground" />
                      <span>Date (DD/MM/YYYY)</span>
                    </Label>
                    <DateInput
                      value={endDate}
                      onChange={setEndDate}
                      className="text-xs h-9 font-mono bg-background"
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                      <ClockIcon className="size-3.5 text-muted-foreground" />
                      <span>End Time</span>
                    </Label>
                    <Input
                      type="time"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      className="text-sm font-medium h-9 bg-background px-3"
                      required
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Live Block Duration Banner */}
            {durationSummary && (
              <div className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-status-maintenance/10 border border-status-maintenance/20 text-xs">
                <span className="font-semibold text-status-maintenance flex items-center gap-1.5">
                  <ClockIcon className="size-3.5" />
                  <span>Scheduled Maintenance Duration:</span>
                </span>
                <span className="font-bold text-foreground font-mono">
                  {durationSummary}
                </span>
              </div>
            )}

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

            {/* Booking Overlap Conflict Blocking Box */}
            {bookingConflicts.length > 0 && (
              <div className="p-3.5 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive space-y-2.5">
                <div className="flex items-start gap-2">
                  <ProblemIcon className="size-4 text-destructive shrink-0 mt-0.5" />
                  <div className="space-y-1 text-xs">
                    <span className="font-bold">
                      Cannot Schedule: Room is {bookingConflicts.some((b) => b.status === "CHECKED_IN") ? "Occupied" : "Reserved"}
                    </span>
                    <p className="text-destructive/90 text-[11px] leading-tight">
                      Maintenance cannot be added because this room has {bookingConflicts.length} active or upcoming booking{bookingConflicts.length > 1 ? "s" : ""} during this time. The room must be completely free before maintenance can be scheduled.
                    </p>
                  </div>
                </div>

                <div className="space-y-1.5 pl-6">
                  {bookingConflicts.map((c) => (
                    <div
                      key={c.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 text-[11px] bg-background/90 p-2.5 rounded-lg border border-destructive/20 text-foreground"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider shrink-0 ${
                            c.status === "CHECKED_IN"
                              ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                              : "bg-blue-500/15 text-blue-700 dark:text-blue-300"
                          }`}
                        >
                          {c.status === "CHECKED_IN" ? "Occupied" : "Reserved"}
                        </span>
                        <span className="font-semibold text-foreground truncate">{c.guestName}</span>
                      </div>
                      <span className="font-mono text-muted-foreground text-[11px] shrink-0">
                        {c.reference} • {formatIST(new Date(c.checkInAt), "dd MMM, hh:mm a")} – {formatIST(new Date(c.checkOutAt), "dd MMM, hh:mm a")}
                      </span>
                    </div>
                  ))}
                </div>

                <p className="text-[11px] text-destructive/90 font-medium pl-6">
                  Please select a different date range after the guest checks out, or choose another room.
                </p>
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
                rows={3}
                className="resize-none text-sm min-h-[75px]"
              />
            </div>

            {errorMsg && (
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-xs font-medium text-destructive">
                {errorMsg}
              </div>
            )}
          </div>

          <DialogFooter className="pt-3 border-t border-border/60 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2">
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
              disabled={isPending || maintenanceConflicts.length > 0 || bookingConflicts.length > 0}
              className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-xs"
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
