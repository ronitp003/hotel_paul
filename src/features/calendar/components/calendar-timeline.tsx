"use client";

import { useState, useMemo, useSyncExternalStore } from "react";
import {
  addDays,
  subDays,
  addWeeks,
  subWeeks,
  addMonths,
  subMonths,
  startOfWeek,
  endOfWeek,
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
  startOfISTMonth,
  endOfISTMonth,
  fromISTInput,
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
  CircleAlertIcon,
} from "@/lib/icons";
import { useCalendarData } from "../hooks/use-calendar";
import { useBookingModal } from "@/features/bookings/context/booking-modal-context";
import { BookingDetailDialog } from "./booking-detail-dialog";
import { MaintenanceDetailDialog } from "./maintenance-detail-dialog";
import { BookingHoverCard } from "./booking-hover-card";
import { MaintenanceHoverCard } from "./maintenance-hover-card";
import { CalendarMonthView } from "./calendar-month-view";
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

export type ViewMode = "day" | "week" | "month";

interface CalendarTimelineProps {
  initialRooms?: CalendarRoomItem[];
  roomTypes?: Array<{ id: string; name: string }>;
  className?: string;
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

export function CalendarTimeline({
  roomTypes = [],
  className,
}: CalendarTimelineProps) {
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

  // Booking modal trigger
  const { openBookingModal } = useBookingModal();

  const handleDateClick = (date: Date, roomId?: string) => {
    const isToday = isSameDay(toIST(date), toIST(new Date()));
    const checkIn = isToday
      ? new Date()
      : fromISTInput(`${formatIST(date, "yyyy-MM-dd")}T12:00:00`);
    const checkOut = new Date(checkIn.getTime() + 24 * 60 * 60 * 1000);

    openBookingModal({
      preselectedRoomId: roomId,
      checkIn,
      checkOut,
    });
  };

  // Live "Now" timestamp via useSyncExternalStore (SSR-safe, zero hydration mismatch)
  const nowMs = useSyncExternalStore(subscribeNow, getClientNow, getServerNow);

  // Fixed today start for deterministic column highlighting
  const todayIST = useMemo(() => startOfISTDay(new Date()), []);

  // Compute timeline start and end in UTC based on selectedDate and viewMode
  const { timelineStart, timelineEnd, totalMs } = useMemo(() => {
    if (viewMode === "day") {
      const start = startOfISTDay(selectedDate);
      const end = endOfISTDay(selectedDate);
      return {
        timelineStart: start,
        timelineEnd: end,
        totalMs: differenceInMilliseconds(end, start),
      };
    } else if (viewMode === "week") {
      // 7 full days starting from selectedDate
      const start = startOfISTDay(selectedDate);
      const end = endOfISTDay(addDays(selectedDate, 6));
      return {
        timelineStart: start,
        timelineEnd: end,
        totalMs: differenceInMilliseconds(end, start),
      };
    } else {
      // Month grid (covers complete weeks for the full calendar view)
      const monthStart = startOfISTMonth(selectedDate);
      const monthEnd = endOfISTMonth(selectedDate);
      const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
      const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
      const start = startOfISTDay(gridStart);
      const end = endOfISTDay(gridEnd);
      return {
        timelineStart: start,
        timelineEnd: end,
        totalMs: differenceInMilliseconds(end, start),
      };
    }
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

  // Dynamic Occupancy Summary Calculation
  const occupancyStats = useMemo(() => {
    const totalRooms = filteredRooms.length;
    if (totalRooms === 0) {
      return {
        totalRooms: 0,
        occupiedCount: 0,
        reservedCount: 0,
        maintenanceCount: 0,
        availableCount: 0,
        occupancyRate: 0,
      };
    }

    let evalStartIso: string;
    let evalEndIso: string;

    if (viewMode === "day") {
      evalStartIso = startOfISTDay(selectedDate).toISOString();
      evalEndIso = endOfISTDay(selectedDate).toISOString();
    } else if (viewMode === "week") {
      evalStartIso = timelineStart.toISOString();
      evalEndIso = timelineEnd.toISOString();
    } else {
      evalStartIso = startOfISTMonth(selectedDate).toISOString();
      evalEndIso = endOfISTMonth(selectedDate).toISOString();
    }

    const filteredRoomIdSet = new Set(filteredRooms.map((r) => r.id));
    const occupiedRoomIds = new Set<string>();
    const reservedRoomIds = new Set<string>();
    const maintenanceRoomIds = new Set<string>();

    if (timelineData?.bookings) {
      for (const b of timelineData.bookings) {
        if (!filteredRoomIdSet.has(b.roomId)) continue;
        if (b.checkInAt <= evalEndIso && b.checkOutAt >= evalStartIso) {
          if (b.status === "CHECKED_IN") {
            occupiedRoomIds.add(b.roomId);
          } else if (b.status === "RESERVED") {
            reservedRoomIds.add(b.roomId);
          }
        }
      }
    }

    if (timelineData?.maintenance) {
      for (const m of timelineData.maintenance) {
        if (!filteredRoomIdSet.has(m.roomId)) continue;
        if (m.startsAt <= evalEndIso && m.endsAt >= evalStartIso) {
          maintenanceRoomIds.add(m.roomId);
        }
      }
    }

    const occupiedCount = occupiedRoomIds.size;
    let reservedCount = 0;
    for (const rid of reservedRoomIds) {
      if (!occupiedRoomIds.has(rid)) {
        reservedCount++;
      }
    }
    let maintenanceCount = 0;
    for (const rid of maintenanceRoomIds) {
      if (!occupiedRoomIds.has(rid) && !reservedRoomIds.has(rid)) {
        maintenanceCount++;
      }
    }

    const busyCount = occupiedCount + reservedCount + maintenanceCount;
    const availableCount = Math.max(0, totalRooms - busyCount);
    const occupancyRate = Math.round(
      ((occupiedCount + reservedCount) / totalRooms) * 100
    );

    return {
      totalRooms,
      occupiedCount,
      reservedCount,
      maintenanceCount,
      availableCount,
      occupancyRate,
    };
  }, [
    filteredRooms,
    timelineData,
    viewMode,
    selectedDate,
    timelineStart,
    timelineEnd,
  ]);

  // Navigation handlers
  const handlePrev = () => {
    if (viewMode === "day") {
      setSelectedDate((prev) => subDays(prev, 1));
    } else if (viewMode === "week") {
      setSelectedDate((prev) => subWeeks(prev, 1));
    } else {
      setSelectedDate((prev) => subMonths(prev, 1));
    }
  };

  const handleNext = () => {
    if (viewMode === "day") {
      setSelectedDate((prev) => addDays(prev, 1));
    } else if (viewMode === "week") {
      setSelectedDate((prev) => addWeeks(prev, 1));
    } else {
      setSelectedDate((prev) => addMonths(prev, 1));
    }
  };

  // Header column generation for Day and Week views
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
    } else if (viewMode === "week") {
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
    return [];
  }, [viewMode, timelineStart, todayIST]);

  // Calculate percentage position for "Now" line (SSR-safe, client-only)
  const nowPercent = useMemo(() => {
    if (nowMs === null || viewMode === "month") return null;
    const startMs = timelineStart.getTime();
    const endMs = timelineEnd.getTime();
    if (nowMs < startMs || nowMs > endMs) return null;
    return ((nowMs - startMs) / totalMs) * 100;
  }, [nowMs, timelineStart, timelineEnd, totalMs, viewMode]);

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

  // Calculate precise horizontal layout [left%, width%] — used for Day view
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

  // Calculate CSS grid column span for Week view — aligns bars perfectly with day headers
  const getBookingWeekCols = (startIso: string, endIso: string) => {
    const startMs = new Date(startIso).getTime();
    const endMs = new Date(endIso).getTime();
    const weekStartMs = timelineStart.getTime();
    // timelineEnd is end-of-day on day 6 (inclusive), so exclusive end is weekStartMs + 7 days
    const weekEndMs = weekStartMs + 7 * 24 * 60 * 60 * 1000;

    if (endMs <= weekStartMs || startMs >= weekEndMs) return null;

    // 0-based day index within the week
    const startDayIdx = Math.max(
      0,
      Math.floor((startMs - weekStartMs) / (24 * 60 * 60 * 1000))
    );
    const endDayIdx = Math.min(
      7,
      Math.ceil((endMs - weekStartMs) / (24 * 60 * 60 * 1000))
    );

    if (endDayIdx <= startDayIdx) return null;

    return {
      startCol: startDayIdx + 1, // 1-based CSS grid column
      endCol: endDayIdx + 1, // exclusive end column
      isStartsBefore: startMs < weekStartMs,
      isEndsAfter: endMs > weekEndMs,
    };
  };

  return (
    <div className={cn("space-y-2 flex flex-col flex-1 min-h-0 h-full", className)}>
      {/* 1. Calendar Toolbar */}
      <div className="flex flex-col lg:flex-row gap-2 items-stretch lg:items-center justify-between px-3 py-1.5 rounded-lg border border-border bg-card shadow-xs shrink-0">
        {/* Left: Nav Buttons & Date Title */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-0.5 border border-border rounded-lg p-0.5 bg-muted/40 shrink-0">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-7 rounded-md"
              onClick={handlePrev}
              title="Previous"
            >
              <ChevronLeftIcon className="size-3.5" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-7 rounded-md"
              onClick={handleNext}
              title="Next"
            >
              <ChevronRightIcon className="size-3.5" />
            </Button>
          </div>

          <div className="flex items-center gap-1.5 pl-0.5 min-w-0">
            <CalendarIcon className="size-3.5 text-primary shrink-0" />
            <h2 className="text-xs sm:text-sm font-bold text-foreground truncate">
              {viewMode === "day"
                ? formatIST(selectedDate, "EEEE, dd MMMM yyyy")
                : viewMode === "week"
                ? `${formatISTDate(timelineStart)} — ${formatISTDate(timelineEnd)}`
                : formatIST(selectedDate, "MMMM yyyy")}
            </h2>
            {isFetching && (
              <SpinnerIcon className="size-3 text-muted-foreground animate-spin ml-1 shrink-0" />
            )}
          </div>
        </div>

        {/* Right: View Toggle (Day/Week/Month), Room Type Filter, Room Search */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {/* Day / Week / Month View Mode Toggle */}
          <div className="flex items-center border border-border rounded-lg p-0.5 bg-muted/50">
            <Button
              type="button"
              variant={viewMode === "day" ? "default" : "ghost"}
              size="sm"
              className={cn(
                "h-7 px-2.5 text-xs font-semibold rounded-md transition-all",
                viewMode === "day" && "shadow-xs font-bold"
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
                "h-7 px-2.5 text-xs font-semibold rounded-md transition-all",
                viewMode === "week" && "shadow-xs font-bold"
              )}
              onClick={() => setViewMode("week")}
            >
              Week
            </Button>
            <Button
              type="button"
              variant={viewMode === "month" ? "default" : "ghost"}
              size="sm"
              className={cn(
                "h-7 px-2.5 text-xs font-semibold rounded-md transition-all",
                viewMode === "month" && "shadow-xs font-bold"
              )}
              onClick={() => setViewMode("month")}
            >
              Month
            </Button>
          </div>

          {/* Room Type Filter */}
          <div className="w-32 sm:w-36">
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
          <div className="relative w-28 sm:w-32">
            <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3 text-muted-foreground pointer-events-none" />
            <Input
              type="text"
              placeholder="Search room..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-7 pl-7 text-xs rounded-md"
            />
          </div>
        </div>
      </div>

      {/* 2. Occupancy Summary & Legend Bar */}
      <div className="px-3 py-1 rounded-lg border border-border bg-card shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-1.5 text-xs shrink-0">
        {/* Dynamic Occupancy Stats */}
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            {viewMode === "day"
              ? "Day Occupancy"
              : viewMode === "week"
              ? "Week Overview"
              : "Month Overview"}
            :
          </span>

          <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-blue-500/10 text-blue-700 dark:text-blue-400 font-semibold border border-blue-500/20 text-[11px]">
            <span className="size-2 rounded-full bg-blue-600" />
            <span>{occupancyStats.occupiedCount} Occupied</span>
          </div>

          <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-400 font-semibold border border-amber-500/20 text-[11px]">
            <span className="size-2 rounded-full bg-amber-500" />
            <span>{occupancyStats.reservedCount} Reserved</span>
          </div>

          {occupancyStats.maintenanceCount > 0 && (
            <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-purple-500/10 text-purple-700 dark:text-purple-400 font-semibold border border-purple-500/20 text-[11px]">
              <MaintenanceIcon className="size-3 text-purple-600 dark:text-purple-400" />
              <span>{occupancyStats.maintenanceCount} Maint</span>
            </div>
          )}

          <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-semibold border border-emerald-500/20 text-[11px]">
            <span className="size-2 rounded-full bg-emerald-500" />
            <span>{occupancyStats.availableCount} Available</span>
          </div>

          {occupancyStats.totalRooms > 0 && (
            <Badge
              variant="secondary"
              className="font-mono text-[10px] font-bold px-1.5 py-0 bg-muted"
            >
              {occupancyStats.occupancyRate}% Occ
            </Badge>
          )}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-2 text-muted-foreground text-[10px] pt-1 md:pt-0 border-t md:border-t-0 border-border/50">
          <div className="flex items-center gap-1">
            <span className="size-2 rounded-xs bg-blue-600 shrink-0" />
            <span>Occupied</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="size-2 rounded-xs bg-amber-500 shrink-0" />
            <span>Reserved</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="size-2 rounded-xs bg-slate-400 dark:bg-slate-600 shrink-0" />
            <span>Checked Out</span>
          </div>
          <div className="flex items-center gap-1">
            <span
              style={{
                backgroundColor: "var(--maintenance-bg, #f3e8ff)",
                backgroundImage:
                  "repeating-linear-gradient(-45deg, var(--maintenance-stripe, rgba(147, 51, 234, 0.28)), var(--maintenance-stripe, rgba(147, 51, 234, 0.28)) 2px, transparent 2px, transparent 5px)",
              }}
              className="size-2 rounded-xs bg-maintenance-striped border border-purple-500 dark:border-purple-400 shrink-0"
            />
            <span>Maintenance</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="size-1.5 rounded-full bg-destructive animate-pulse shrink-0" />
            <span>Problem</span>
          </div>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="p-3 rounded-lg border border-destructive/30 bg-destructive/5 text-destructive text-xs flex items-center justify-between gap-3 shrink-0">
          <span>Failed to load timeline data: {error.message}</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            className="border-destructive/30 hover:bg-destructive/10 h-7 text-xs"
          >
            Retry
          </Button>
        </div>
      )}

      {/* 3. Main Calendar View: Month Grid OR Day/Week Timeline */}
      {viewMode === "month" ? (
        <CalendarMonthView
          selectedDate={selectedDate}
          onSelectDate={(newDate) => {
            setSelectedDate(newDate);
          }}
          onDateClick={(newDate) => {
            handleDateClick(newDate);
          }}
          onViewDay={(newDate) => {
            setSelectedDate(newDate);
            setViewMode("day");
          }}
          rooms={filteredRooms}
          bookings={timelineData?.bookings || []}
          maintenance={timelineData?.maintenance || []}
          onSelectBooking={(b, room) => setSelectedBooking({ booking: b, room })}
          onSelectMaintenance={(m, room) =>
            setSelectedMaintenance({ maintenance: m, room })
          }
        />
      ) : (
        /* Timeline View for Day and Week */
        <div className="rounded-xl border border-border bg-card shadow-xs overflow-auto flex-1 min-h-0 h-full custom-scrollbar select-none relative">
          <div
            className={cn(
              viewMode === "week"
                ? "w-full min-w-0"
                : "min-w-[1200px] w-[1600px]"
            )}
          >
            {/* Header Row: Sticky top */}
            <div className="flex border-b border-border bg-muted/95 backdrop-blur-xs sticky top-0 z-30">
              {/* Sticky Room Column Header: Sticky top AND left */}
              <div className="sticky left-0 top-0 z-40 w-36 sm:w-44 lg:w-48 shrink-0 bg-muted/95 backdrop-blur-xs p-2 sm:px-3 sm:py-2 border-r border-border font-semibold text-xs text-foreground flex items-center justify-between shadow-xs">
                <span>Room</span>
                <Badge
                  variant="secondary"
                  className="text-[10px] font-mono px-1.5 py-0"
                >
                  {filteredRooms.length}
                </Badge>
              </div>

              {/* Time Column Headers */}
              <div
                className="flex-1 grid relative"
                style={{
                  gridTemplateColumns: `repeat(${headerColumns.length}, minmax(0, 1fr))`,
                }}
              >
                {headerColumns.map((col, idx) => {
                  const colDate =
                    viewMode === "week" ? addDays(timelineStart, idx) : null;

                  return (
                    <div
                      key={col.id}
                      onClick={() => {
                        if (colDate) {
                          handleDateClick(colDate);
                        }
                      }}
                      className={cn(
                        "p-1.5 text-center border-r last:border-r-0 flex flex-col justify-center transition-colors",
                        viewMode === "week"
                          ? "border-border/80 cursor-pointer hover:bg-primary/10"
                          : "border-border/50",
                        col.isToday && "bg-primary/5 text-primary font-semibold"
                      )}
                      title={
                        viewMode === "week" && colDate
                          ? `Click to book for ${formatIST(colDate, "dd MMM yyyy")}`
                          : undefined
                      }
                    >
                      <span className="text-xs font-bold leading-tight">
                        {col.label}
                      </span>
                      <span className="text-[10px] sm:text-[11px] text-muted-foreground leading-tight">
                        {col.subLabel}
                      </span>
                    </div>
                  );
                })}

                {/* Current Time Indicator Pip in Header */}
                {nowPercent !== null && (
                  <div
                    suppressHydrationWarning
                    className="absolute top-0 bottom-0 pointer-events-none z-30 flex flex-col items-center"
                    style={{ left: `${nowPercent}%` }}
                  >
                    <span className="size-2 rounded-full bg-red-500 ring-2 ring-background shadow-xs -translate-x-1/2 absolute top-1.5 animate-pulse" />
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
                      <div className="sticky left-0 z-20 w-36 sm:w-44 lg:w-48 shrink-0 bg-card group-hover/row:bg-muted/30 transition-colors p-2 sm:px-3 sm:py-1.5 border-r border-border flex items-center justify-between shadow-xs">
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
                                <CircleAlertIcon className="size-3 text-destructive animate-pulse" />
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
                      {viewMode === "week" ? (
                        /* ── Week View: CSS Grid column-span layout (reference approach) ── */
                        <div
                          className="flex-1 bg-background/50"
                          style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
                            gridTemplateRows: "40px",
                            height: "40px",
                            position: "relative",
                          }}
                        >
                          {/* 7 clickable day cells */}
                          {headerColumns.map((col, colIdx) => {
                            const colDate = addDays(timelineStart, colIdx);
                            return (
                              <div
                                key={col.id}
                                onClick={() => handleDateClick(colDate, room.id)}
                                title={`Click to book Room ${room.number} on ${formatIST(colDate, "dd MMM yyyy")}`}
                                style={{ gridRow: 1, gridColumn: colIdx + 1 }}
                                className={cn(
                                  "border-r last:border-r-0 h-full cursor-pointer transition-colors",
                                  "border-border/70 hover:bg-primary/8",
                                  col.isToday && "bg-primary/[0.03]"
                                )}
                              />
                            );
                          })}

                          {/* Current Time Indicator Line */}
                          {nowPercent !== null && (
                            <div
                              suppressHydrationWarning
                              className="pointer-events-none z-20"
                              style={{
                                position: "absolute",
                                top: 0,
                                bottom: 0,
                                left: `${nowPercent}%`,
                              }}
                            >
                              <div className="w-[1.5px] h-full bg-red-500/80 shadow-[0_0_4px_rgba(239,68,68,0.5)]" />
                            </div>
                          )}

                          {/* Maintenance Bars — grid-column span */}
                          {roomMaintenance.map((m) => {
                            const cols = getBookingWeekCols(m.startsAt, m.endsAt);
                            if (!cols) return null;
                            return (
                              <MaintenanceHoverCard
                                key={m.id}
                                maintenance={m}
                                room={room}
                              >
                                <div
                                  role="button"
                                  tabIndex={0}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedMaintenance({ maintenance: m, room });
                                  }}
                                  style={{
                                    gridRow: 1,
                                    gridColumn: `${cols.startCol} / ${cols.endCol}`,
                                    zIndex: 2,
                                    margin: "4px 2px",
                                    backgroundColor: "var(--maintenance-bg, #f3e8ff)",
                                    backgroundImage:
                                      "repeating-linear-gradient(-45deg, var(--maintenance-stripe, rgba(147, 51, 234, 0.22)), var(--maintenance-stripe, rgba(147, 51, 234, 0.22)) 8px, transparent 8px, transparent 16px)",
                                  }}
                                  className="rounded-md hover:opacity-95 text-purple-950 dark:text-purple-100 border border-purple-400 dark:border-purple-500 cursor-pointer px-2 py-0.5 overflow-hidden flex items-center gap-1.5 transition-transform hover:scale-[1.01] shadow-xs select-none"
                                >
                                  <MaintenanceIcon className="size-3.5 shrink-0 text-purple-800 dark:text-purple-300" />
                                  <span className="text-xs font-bold text-purple-950 dark:text-purple-100 truncate leading-none">
                                    {m.reason ? `Maintenance • ${m.reason}` : "Maintenance"}
                                  </span>
                                </div>
                              </MaintenanceHoverCard>
                            );
                          })}

                          {/* Booking Bars — grid-column span */}
                          {roomBookings.map((b) => {
                            const cols = getBookingWeekCols(b.checkInAt, b.checkOutAt);
                            if (!cols) return null;

                            const isCheckedIn = b.status === "CHECKED_IN";
                            const isReserved = b.status === "RESERVED";

                            const barStyle = isCheckedIn
                              ? "bg-blue-600 hover:bg-blue-700 text-white shadow-xs border border-blue-400/30"
                              : isReserved
                              ? "bg-amber-500 hover:bg-amber-600 text-white shadow-xs border border-amber-300/30"
                              : "bg-slate-400 dark:bg-slate-600 hover:bg-slate-500 text-white border border-slate-300/20";

                            return (
                              <BookingHoverCard
                                key={b.id}
                                booking={b}
                                room={room}
                              >
                                <div
                                  role="button"
                                  tabIndex={0}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedBooking({ booking: b, room });
                                  }}
                                  style={{
                                    gridRow: 1,
                                    gridColumn: `${cols.startCol} / ${cols.endCol}`,
                                    zIndex: 10,
                                    margin: "4px 2px",
                                  }}
                                  className={cn(
                                    "rounded-md cursor-pointer px-2 py-0.5 overflow-hidden flex flex-col justify-center gap-0.5 transition-all hover:scale-[1.01] hover:z-20 select-none shadow-xs",
                                    barStyle
                                  )}
                                >
                                  <div className="flex items-center justify-between gap-1.5 min-w-0">
                                    <div className="flex items-center gap-1 min-w-0">
                                      {room.hasOpenProblem && (
                                        <CircleAlertIcon className="size-2.5 text-red-200 animate-pulse shrink-0" />
                                      )}
                                      <span className="text-xs font-bold truncate leading-tight tracking-tight">
                                        {b.primaryGuestName}
                                      </span>
                                      {b.groupBookingId && (
                                        <span className="text-[8px] uppercase tracking-wider px-1 py-0.2 rounded bg-white/25 text-white font-bold shrink-0">
                                          Group
                                        </span>
                                      )}
                                    </div>

                                    {b.balanceDue > 0 && isCheckedIn && (
                                      <span className="text-[9px] px-1 py-0 rounded-xs bg-red-700/95 text-white font-mono font-bold shrink-0 shadow-2xs">
                                        Due {formatINR(b.balanceDue)}
                                      </span>
                                    )}
                                  </div>

                                  <div className="text-[10px] text-white/80 font-mono font-medium truncate leading-none">
                                    {formatISTTime(b.checkInAt)} →{" "}
                                    {formatISTTime(b.checkOutAt)}
                                  </div>
                                </div>
                              </BookingHoverCard>
                            );
                          })}
                        </div>
                      ) : (
                        /* ── Day View: percentage-based absolute positioning ── */
                        <div className="flex-1 relative h-12 sm:h-13 bg-background/50">
                        {/* Background Grid Lines & Clickable Date Cells */}
                        <div
                          className="absolute inset-0 grid"
                          style={{
                            gridTemplateColumns: `repeat(${headerColumns.length}, minmax(0, 1fr))`,
                          }}
                        >
                          {headerColumns.map((col) => (
                            <div
                              key={col.id}
                              className={cn(
                                "border-r last:border-r-0 h-full",
                                "border-border/30",
                                col.isToday && "bg-primary/[0.02]"
                              )}
                            />
                          ))}
                        </div>

                        {/* Current Time Indicator Line */}
                        {nowPercent !== null && (
                          <div
                            suppressHydrationWarning
                            className="absolute top-0 bottom-0 pointer-events-none z-20"
                            style={{ left: `${nowPercent}%` }}
                          >
                            <div className="w-[1.5px] h-full bg-red-500/80 shadow-[0_0_4px_rgba(239,68,68,0.5)]" />
                          </div>
                        )}

                        {/* Maintenance Bars */}
                        {roomMaintenance.map((m) => {
                          const pos = calculatePosition(m.startsAt, m.endsAt);
                          if (!pos) return null;

                          return (
                            <MaintenanceHoverCard
                              key={m.id}
                              maintenance={m}
                              room={room}
                            >
                              <div
                                role="button"
                                tabIndex={0}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedMaintenance({ maintenance: m, room });
                                }}
                                style={{
                                  left: `${pos.left}%`,
                                  width: `${pos.width}%`,
                                  backgroundColor: "var(--maintenance-bg, #f3e8ff)",
                                  backgroundImage:
                                    "repeating-linear-gradient(-45deg, var(--maintenance-stripe, rgba(147, 51, 234, 0.22)), var(--maintenance-stripe, rgba(147, 51, 234, 0.22)) 8px, transparent 8px, transparent 16px)",
                                }}
                                className="absolute top-1 bottom-1 z-10 rounded-md bg-maintenance-striped hover:opacity-95 text-purple-950 dark:text-purple-100 border border-purple-400 dark:border-purple-500 cursor-pointer px-2 py-0.5 overflow-hidden flex items-center gap-1.5 transition-transform hover:scale-[1.01] shadow-xs select-none"
                              >
                                <MaintenanceIcon className="size-3.5 shrink-0 text-purple-800 dark:text-purple-300" />
                                <span className="text-xs font-bold text-purple-950 dark:text-purple-100 truncate leading-none">
                                  {m.reason ? `Maintenance • ${m.reason}` : "Maintenance"}
                                </span>
                              </div>
                            </MaintenanceHoverCard>
                          );
                        })}

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
                            ? "bg-blue-600 hover:bg-blue-700 text-white shadow-xs border border-blue-400/30"
                            : isReserved
                            ? "bg-amber-500 hover:bg-amber-600 text-white shadow-xs border border-amber-300/30"
                            : "bg-slate-400 dark:bg-slate-600 hover:bg-slate-500 text-white border border-slate-300/20";

                          return (
                            <BookingHoverCard
                              key={b.id}
                              booking={b}
                              room={room}
                            >
                              <div
                                role="button"
                                tabIndex={0}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedBooking({ booking: b, room });
                                }}
                                style={{
                                  left: `${pos.left}%`,
                                  width: `${pos.width}%`,
                                }}
                                className={cn(
                                  "absolute top-1 bottom-1 z-10 rounded-md cursor-pointer px-2 py-0.5 overflow-hidden flex flex-col justify-center gap-0.5 transition-all hover:scale-[1.01] hover:z-20 select-none shadow-xs",
                                  barStyle
                                )}
                              >
                                <div className="flex items-center justify-between gap-1.5 min-w-0">
                                  <div className="flex items-center gap-1 min-w-0">
                                    {room.hasOpenProblem && (
                                      <CircleAlertIcon className="size-2.5 text-red-200 animate-pulse shrink-0" />
                                    )}
                                    <span className="text-xs font-bold truncate leading-tight tracking-tight">
                                      {b.primaryGuestName}
                                    </span>
                                    {b.groupBookingId && (
                                      <span className="text-[8px] uppercase tracking-wider px-1 py-0.2 rounded bg-white/25 text-white font-bold shrink-0">
                                        Group
                                      </span>
                                    )}
                                  </div>

                                  {b.balanceDue > 0 && isCheckedIn && (
                                    <span className="text-[9px] px-1 py-0 rounded-xs bg-red-700/95 text-white font-mono font-bold shrink-0 shadow-2xs">
                                      Due {formatINR(b.balanceDue)}
                                    </span>
                                  )}
                                </div>

                                <div className="text-[10px] text-white/80 font-mono font-medium truncate leading-none">
                                  {formatISTTime(b.checkInAt)} →{" "}
                                  {formatISTTime(b.checkOutAt)}
                                </div>
                              </div>
                            </BookingHoverCard>
                          );
                        })}
                      </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

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
