"use client";

import { useState, useMemo, useSyncExternalStore } from "react";
import {
  addDays,
  subDays,
  addWeeks,
  subWeeks,
  differenceInMilliseconds,
  isSameDay,
} from "date-fns";
import {
  toIST,
  formatIST,
  formatISTDate,
  formatISTTime,
  startOfISTDay,
  endOfISTDay,
} from "@/lib/datetime";
import { formatINR } from "@/lib/money";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { SelectDropdown } from "@/components/ui/select-dropdown";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  CalendarIcon,
  SearchIcon,
  MaintenanceIcon,
  SpinnerIcon,
} from "@/lib/icons";
import { useCalendarData } from "../hooks/use-calendar";
import { BookingDetailDialog } from "./booking-detail-dialog";
import { MaintenanceDetailDialog } from "./maintenance-detail-dialog";
import type {
  CalendarBookingEvent,
  CalendarMaintenanceEvent,
  CalendarRoomItem,
} from "@/server/services/calendar.service";

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="skeleton"
      className={cn("bg-muted animate-pulse rounded-md", className)}
      {...props}
    />
  );
}

type ViewMode = "day" | "week";

interface CalendarTimelineProps {
  initialRooms?: CalendarRoomItem[];
  roomTypes?: Array<{ id: string; name: string }>;
}

let cachedNowMs: number | null = null;
const nowListeners = new Set<() => void>();
let nowTimer: ReturnType<typeof setInterval> | null = null;

function subscribeNow(onStoreChange: () => void) {
  nowListeners.add(onStoreChange);
  if (!nowTimer && typeof window !== "undefined") {
    nowTimer = setInterval(() => {
      cachedNowMs = Date.now();
      nowListeners.forEach((fn) => fn());
    }, 60000);
  }
  return () => {
    nowListeners.delete(onStoreChange);
    if (nowListeners.size === 0 && nowTimer) {
      clearInterval(nowTimer);
      nowTimer = null;
    }
  };
}

function getClientNow(): number {
  if (cachedNowMs === null) {
    cachedNowMs = Date.now();
  }
  return cachedNowMs;
}

function getServerNow(): null {
  return null;
}

export function CalendarTimeline({ roomTypes = [] }: CalendarTimelineProps) {
  // Current anchor date (in IST)
  const [selectedDate, setSelectedDate] = useState<Date>(() => startOfISTDay(new Date()));
  const [viewMode, setViewMode] = useState<ViewMode>("week");
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Selected event dialog states
  const [selectedBooking, setSelectedBooking] = useState<{
    booking: CalendarBookingEvent;
    room?: CalendarRoomItem;
  } | null>(null);
  const [selectedMaintenance, setSelectedMaintenance] = useState<{
    maintenance: CalendarMaintenanceEvent;
    room?: CalendarRoomItem;
  } | null>(null);

  // Live "Now" timestamp via useSyncExternalStore (SSR-safe, zero hydration mismatch)
  const nowMs = useSyncExternalStore(subscribeNow, getClientNow, getServerNow);

  // Fixed today start for deterministic column highlighting
  const todayIST = useMemo(() => startOfISTDay(new Date()), []);

  // Compute timeline start and end in UTC based on selectedDate and viewMode
  const { timelineStart, timelineEnd, totalMs } = useMemo(() => {
    const start = startOfISTDay(selectedDate);
    let end: Date;
    if (viewMode === "day") {
      end = endOfISTDay(selectedDate);
    } else {
      // 7 full days
      end = endOfISTDay(addDays(selectedDate, 6));
    }
    const ms = differenceInMilliseconds(end, start);
    return {
      timelineStart: start,
      timelineEnd: end,
      totalMs: ms,
    };
  }, [selectedDate, viewMode]);

  // Fetch live calendar data via TanStack Query
  const {
    data: timelineData,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useCalendarData({
    startUtc: timelineStart.toISOString(),
    endUtc: timelineEnd.toISOString(),
  });

  // Filtered rooms
  const filteredRooms = useMemo(() => {
    if (!timelineData?.rooms) return [];
    return timelineData.rooms.filter((room) => {
      const matchesType =
        selectedTypeFilter === "ALL" || room.typeId === selectedTypeFilter;
      const matchesSearch =
        searchQuery.trim() === "" ||
        room.number.toLowerCase().includes(searchQuery.toLowerCase().trim()) ||
        room.typeName.toLowerCase().includes(searchQuery.toLowerCase().trim());
      return matchesType && matchesSearch;
    });
  }, [timelineData, selectedTypeFilter, searchQuery]);

  // Navigation handlers
  const handlePrev = () => {
    if (viewMode === "day") {
      setSelectedDate((prev) => subDays(prev, 1));
    } else {
      setSelectedDate((prev) => subWeeks(prev, 1));
    }
  };

  const handleNext = () => {
    if (viewMode === "day") {
      setSelectedDate((prev) => addDays(prev, 1));
    } else {
      setSelectedDate((prev) => addWeeks(prev, 1));
    }
  };

  const handleToday = () => {
    setSelectedDate(startOfISTDay(new Date()));
  };

  // Header column generation
  const headerColumns = useMemo(() => {
    if (viewMode === "day") {
      // 24 one-hour blocks: 00:00 to 23:00
      return Array.from({ length: 24 }).map((_, hour) => {
        const d = new Date(timelineStart);
        d.setUTCHours(d.getUTCHours() + hour);
        return {
          id: `hour-${hour}`,
          label: formatIST(d, "ha"),
          subLabel: formatIST(d, "HH:00"),
          isToday: isSameDay(toIST(d), toIST(todayIST)),
        };
      });
    } else {
      // 7 day blocks
      return Array.from({ length: 7 }).map((_, dayIdx) => {
        const d = addDays(timelineStart, dayIdx);
        return {
          id: `day-${dayIdx}`,
          label: formatIST(d, "EEE"),
          subLabel: formatIST(d, "dd MMM"),
          isToday: isSameDay(toIST(d), toIST(todayIST)),
        };
      });
    }
  }, [viewMode, timelineStart, todayIST]);

  // Calculate percentage position for "Now" line (SSR-safe, client-only)
  const nowPercent = useMemo(() => {
    if (nowMs === null) return null;
    const startMs = timelineStart.getTime();
    const endMs = timelineEnd.getTime();
    if (nowMs < startMs || nowMs > endMs) return null;
    return ((nowMs - startMs) / totalMs) * 100;
  }, [nowMs, timelineStart, timelineEnd, totalMs]);

  // Group events by room
  const eventsByRoom = useMemo(() => {
    const bookingMap: Record<string, CalendarBookingEvent[]> = {};
    const maintenanceMap: Record<string, CalendarMaintenanceEvent[]> = {};

    if (timelineData?.bookings) {
      for (const b of timelineData.bookings) {
        if (!bookingMap[b.roomId]) bookingMap[b.roomId] = [];
        bookingMap[b.roomId].push(b);
      }
    }

    if (timelineData?.maintenance) {
      for (const m of timelineData.maintenance) {
        if (!maintenanceMap[m.roomId]) maintenanceMap[m.roomId] = [];
        maintenanceMap[m.roomId].push(m);
      }
    }

    return { bookingMap, maintenanceMap };
  }, [timelineData]);

  // Calculate precise horizontal layout [left%, width%]
  const calculatePosition = (startIso: string, endIso: string) => {
    const startMs = new Date(startIso).getTime();
    const endMs = new Date(endIso).getTime();
    const tStartMs = timelineStart.getTime();
    const tEndMs = timelineEnd.getTime();

    const clampedStart = Math.max(startMs, tStartMs);
    const clampedEnd = Math.min(endMs, tEndMs);

    if (clampedEnd <= clampedStart) return null;

    const left = ((clampedStart - tStartMs) / totalMs) * 100;
    const width = ((clampedEnd - clampedStart) / totalMs) * 100;

    return {
      left: Math.max(0, Math.min(100, left)),
      width: Math.max(0.6, Math.min(100 - left, width)),
      isStartsBefore: startMs < tStartMs,
      isEndsAfter: endMs > tEndMs,
    };
  };

  return (
    <div className="space-y-4">
      {/* Top Toolbar */}
      <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between p-3.5 rounded-xl border border-border bg-card shadow-xs">
        {/* Left: Nav Buttons & Date Title */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 border border-border rounded-lg p-0.5 bg-muted/40">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 rounded-md"
              onClick={handlePrev}
              title="Previous"
            >
              <ChevronLeftIcon className="size-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 px-2.5 text-xs font-semibold"
              onClick={handleToday}
            >
              Today
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 rounded-md"
              onClick={handleNext}
              title="Next"
            >
              <ChevronRightIcon className="size-4" />
            </Button>
          </div>

          <div className="flex items-center gap-2 pl-2">
            <CalendarIcon className="size-4 text-primary shrink-0" />
            <h2 className="text-sm sm:text-base font-bold text-foreground">
              {viewMode === "day"
                ? formatIST(selectedDate, "EEEE, dd MMMM yyyy")
                : `${formatISTDate(timelineStart)} — ${formatISTDate(timelineEnd)}`}
            </h2>
            {isFetching && (
              <SpinnerIcon className="size-3.5 text-muted-foreground animate-spin ml-1" />
            )}
          </div>
        </div>

        {/* Right: View Toggle, Filters, Room Search */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Day / Week View Mode Toggle */}
          <div className="flex items-center border border-border rounded-lg p-0.5 bg-muted/50">
            <Button
              type="button"
              variant={viewMode === "day" ? "default" : "ghost"}
              size="sm"
              className={cn(
                "h-7 px-3 text-xs font-semibold rounded-md",
                viewMode === "day" && "shadow-xs"
              )}
              onClick={() => setViewMode("day")}
            >
              Day
            </Button>
            <Button
              type="button"
              variant={viewMode === "week" ? "default" : "ghost"}
              size="sm"
              className={cn(
                "h-7 px-3 text-xs font-semibold rounded-md",
                viewMode === "week" && "shadow-xs"
              )}
              onClick={() => setViewMode("week")}
            >
              Week
            </Button>
          </div>

          {/* Room Type Filter */}
          <div className="w-36 sm:w-44">
            <SelectDropdown
              value={selectedTypeFilter}
              onChange={setSelectedTypeFilter}
              size="sm"
              options={[
                { value: "ALL", label: "All Room Types" },
                ...roomTypes.map((rt) => ({
                  value: rt.id,
                  label: rt.name,
                })),
              ]}
              placeholder="All Types"
            />
          </div>

          {/* Room Search */}
          <div className="relative w-32 sm:w-40">
            <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
            <Input
              type="text"
              placeholder="Search room..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 pl-8 text-xs rounded-md"
            />
          </div>
        </div>
      </div>

      {/* Legend & Summary Row */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-1 text-xs text-muted-foreground">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="size-3 rounded-xs bg-blue-600 shrink-0" />
            <span className="font-medium text-foreground">Occupied</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="size-3 rounded-xs bg-amber-500 shrink-0" />
            <span className="font-medium text-foreground">Reserved</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="size-3 rounded-xs bg-slate-400 dark:bg-slate-600 shrink-0" />
            <span className="font-medium text-foreground">Checked Out</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="size-3 rounded-xs bg-slate-700 dark:bg-slate-800 border border-slate-500 shrink-0" />
            <span className="font-medium text-foreground">Maintenance</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-destructive shrink-0" />
            <span>Problem reported</span>
          </div>
        </div>

        <div>
          Showing{" "}
          <span className="font-semibold text-foreground">
            {filteredRooms.length}
          </span>{" "}
          rooms
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="p-4 rounded-xl border border-destructive/30 bg-destructive/5 text-destructive text-sm flex items-center justify-between gap-3">
          <span>Failed to load timeline data: {error.message}</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            className="border-destructive/30 hover:bg-destructive/10"
          >
            Retry
          </Button>
        </div>
      )}

      {/* Main Timeline Grid */}
      <div className="rounded-xl border border-border bg-card shadow-xs overflow-hidden">
        <div className="overflow-x-auto custom-scrollbar select-none">
          <div
            className="min-w-[900px] lg:min-w-[1200px]"
            style={{
              width: viewMode === "day" ? "1800px" : "1400px",
            }}
          >
            {/* Header Row */}
            <div className="flex border-b border-border bg-muted/60 sticky top-0 z-30">
              {/* Sticky Room Column Header */}
              <div className="sticky left-0 z-40 w-44 sm:w-52 shrink-0 bg-muted/90 backdrop-blur-xs p-3 border-r border-border font-semibold text-xs text-foreground flex items-center justify-between shadow-xs">
                <span>Room</span>
                <Badge
                  variant="secondary"
                  className="text-[10px] font-mono px-1.5 py-0"
                >
                  {filteredRooms.length}
                </Badge>
              </div>

              {/* Time Column Headers */}
              <div className="flex-1 grid relative" style={{ gridTemplateColumns: `repeat(${headerColumns.length}, minmax(0, 1fr))` }}>
                {headerColumns.map((col) => (
                  <div
                    key={col.id}
                    className={cn(
                      "p-2 text-center border-r border-border/60 last:border-r-0 flex flex-col justify-center",
                      col.isToday && "bg-primary/5 text-primary font-semibold"
                    )}
                  >
                    <span className="text-xs font-bold leading-tight">
                      {col.label}
                    </span>
                    <span className="text-[11px] text-muted-foreground leading-tight">
                      {col.subLabel}
                    </span>
                  </div>
                ))}
                {nowPercent !== null && (
                  <div
                    suppressHydrationWarning
                    className="absolute top-0 bottom-0 pointer-events-none z-30"
                    style={{ left: `${nowPercent}%` }}
                  >
                    <span className="text-[9px] bg-red-500 text-white font-mono font-bold px-1 py-0.5 rounded-xs -translate-x-1/2 absolute top-1 shadow-xs">
                      NOW
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Room Rows */}
            {isLoading && !timelineData ? (
              <div className="p-6 space-y-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="flex gap-3 items-center">
                    <Skeleton className="h-14 w-48 shrink-0 rounded-lg" />
                    <Skeleton className="h-14 flex-1 rounded-lg" />
                  </div>
                ))}
              </div>
            ) : filteredRooms.length === 0 ? (
              <div className="p-12 text-center text-sm text-muted-foreground">
                No rooms match the current search or filters.
              </div>
            ) : (
              <div className="divide-y divide-border/60 relative">

                {filteredRooms.map((room) => {
                  const roomBookings = eventsByRoom.bookingMap[room.id] || [];
                  const roomMaintenance =
                    eventsByRoom.maintenanceMap[room.id] || [];

                  return (
                    <div
                      key={room.id}
                      className="flex group/row hover:bg-muted/15 transition-colors"
                    >
                      {/* Sticky Room Label Column */}
                      <div className="sticky left-0 z-20 w-44 sm:w-52 shrink-0 bg-card group-hover/row:bg-muted/30 transition-colors p-3 border-r border-border flex items-center justify-between shadow-xs">
                        <div className="space-y-0.5 min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-sm text-foreground">
                              {room.number}
                            </span>
                            {room.hasOpenProblem && (
                              <span
                                title="Open problem reported"
                                className="inline-flex"
                              >
                                <span className="size-2 rounded-full bg-destructive animate-pulse" />
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-muted-foreground truncate">
                            {room.typeName}
                          </p>
                        </div>
                        <div className="text-right shrink-0 pl-1">
                          <span className="text-xs font-mono font-semibold text-foreground">
                            {formatINR(room.pricePerNight)}
                          </span>
                        </div>
                      </div>

                      {/* Timeline Canvas for this room */}
                      <div className="flex-1 relative h-16 bg-background/50">
                        {/* Background Grid Lines */}
                        <div
                          className="absolute inset-0 grid pointer-events-none"
                          style={{
                            gridTemplateColumns: `repeat(${headerColumns.length}, minmax(0, 1fr))`,
                          }}
                        >
                          {headerColumns.map((col) => (
                            <div
                              key={col.id}
                              className={cn(
                                "border-r border-border/30 last:border-r-0 h-full",
                                col.isToday && "bg-primary/[0.02]"
                              )}
                            />
                          ))}
                        </div>

                        {/* Maintenance Bars */}
                        {roomMaintenance.map((m) => {
                          const pos = calculatePosition(m.startsAt, m.endsAt);
                          if (!pos) return null;

                          return (
                            <div
                              key={m.id}
                              onClick={() =>
                                setSelectedMaintenance({ maintenance: m, room })
                              }
                              style={{
                                left: `${pos.left}%`,
                                width: `${pos.width}%`,
                              }}
                              title={`Maintenance: ${m.reason} (${formatIST(
                                m.startsAt,
                                "dd MMM, hh:mm a"
                              )} - ${formatIST(m.endsAt, "dd MMM, hh:mm a")})`}
                              className="absolute top-2 bottom-2 z-10 rounded-md bg-slate-700/90 hover:bg-slate-700 text-white border border-slate-500 cursor-pointer p-1.5 overflow-hidden flex items-center gap-1.5 transition-transform hover:scale-[1.01] shadow-xs select-none"
                            >
                              <MaintenanceIcon className="size-3.5 shrink-0 text-slate-300" />
                              <span className="text-xs font-semibold truncate leading-none">
                                {m.reason || "Maintenance"}
                              </span>
                            </div>
                          );
                        })}

                        {/* Now Line Marker */}
                        {nowPercent !== null && (
                          <div
                            suppressHydrationWarning
                            className="absolute top-0 bottom-0 pointer-events-none z-20"
                            style={{ left: `${nowPercent}%` }}
                          >
                            <div className="w-0.5 h-full bg-red-500/80 shadow-xs" />
                          </div>
                        )}

                        {/* Booking Bars */}
                        {roomBookings.map((b) => {
                          const pos = calculatePosition(
                            b.checkInAt,
                            b.checkOutAt
                          );
                          if (!pos) return null;

                          const isCheckedIn = b.status === "CHECKED_IN";
                          const isReserved = b.status === "RESERVED";

                          const barStyle = isCheckedIn
                            ? "bg-blue-600 hover:bg-blue-700 text-white shadow-xs"
                            : isReserved
                            ? "bg-amber-500 hover:bg-amber-600 text-white shadow-xs"
                            : "bg-slate-400 dark:bg-slate-600 hover:bg-slate-500 text-white";

                          return (
                            <div
                              key={b.id}
                              onClick={() =>
                                setSelectedBooking({ booking: b, room })
                              }
                              style={{
                                left: `${pos.left}%`,
                                width: `${pos.width}%`,
                              }}
                              title={`${b.primaryGuestName} (${b.status}) • ${formatIST(
                                b.checkInAt,
                                "hh:mm a"
                              )} → ${formatIST(b.checkOutAt, "hh:mm a")}`}
                              className={cn(
                                "absolute top-2 bottom-2 z-10 rounded-md cursor-pointer px-2 py-1 overflow-hidden flex items-center justify-between gap-1 transition-all hover:scale-[1.01] hover:z-20 select-none",
                                barStyle
                              )}
                            >
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span className="text-xs font-bold truncate leading-none">
                                  {b.primaryGuestName}
                                </span>
                                <span className="text-[10px] opacity-80 font-mono hidden sm:inline-block truncate">
                                  ({formatISTTime(b.checkInAt)} -{" "}
                                  {formatISTTime(b.checkOutAt)})
                                </span>
                              </div>

                              {b.balanceDue > 0 && isCheckedIn && (
                                <Badge
                                  variant="destructive"
                                  className="text-[9px] px-1 py-0 h-4 bg-red-700 text-white shrink-0 ml-1 font-mono"
                                >
                                  Due {formatINR(b.balanceDue)}
                                </Badge>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Booking Details Dialog */}
      <BookingDetailDialog
        booking={selectedBooking?.booking || null}
        roomNumber={selectedBooking?.room?.number}
        roomTypeName={selectedBooking?.room?.typeName}
        isOpen={Boolean(selectedBooking)}
        onClose={() => setSelectedBooking(null)}
      />

      {/* Maintenance Details Dialog */}
      <MaintenanceDetailDialog
        maintenance={selectedMaintenance?.maintenance || null}
        roomNumber={selectedMaintenance?.room?.number}
        isOpen={Boolean(selectedMaintenance)}
        onClose={() => setSelectedMaintenance(null)}
      />
    </div>
  );
}
