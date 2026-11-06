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

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
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
  const [selectedDate, setSelectedDate] = useState<Date>(() =>
    startOfISTDay(new Date())
  );
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

  const handleDateClick = (
    date: Date,
    roomId?: string,
    hasExplicitTime: boolean = false
  ) => {
    let checkIn: Date;
    if (hasExplicitTime) {
      checkIn = date;
    } else {
      const isToday = isSameDay(toIST(date), toIST(new Date()));
      checkIn = isToday
        ? new Date()
        : fromISTInput(`${formatIST(date, "yyyy-MM-dd")}T12:00:00`);
    }
    const checkOut = new Date(checkIn.getTime() + 24 * 60 * 60 * 1000);

    openBookingModal({
      preselectedRoomId: roomId,
      checkIn,
      checkOut,
    });
  };

  // Live "Now" timestamp via useSyncExternalStore (SSR-safe)
  const nowMs = useSyncExternalStore(subscribeNow, getClientNow, getServerNow);

  // Fixed today start for deterministic column highlighting
  const todayIST = useMemo(() => startOfISTDay(new Date()), []);

  const isSelectedToday = useMemo(
    () => isSameDay(toIST(selectedDate), toIST(todayIST)),
    [selectedDate, todayIST]
  );

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
      const start = startOfISTDay(selectedDate);
      const end = endOfISTDay(addDays(selectedDate, 6));
      return {
        timelineStart: start,
        timelineEnd: end,
        totalMs: differenceInMilliseconds(end, start),
      };
    } else {
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

  const handleToday = () => {
    setSelectedDate(startOfISTDay(new Date()));
  };

  const hasActiveFilters =
    selectedTypeFilter !== "ALL" || searchQuery.trim() !== "";

  const resetFilters = () => {
    setSelectedTypeFilter("ALL");
    setSearchQuery("");
  };

  // Header column generation for Day and Week views
  const headerColumns = useMemo(() => {
    if (viewMode === "day") {
      return Array.from({ length: 24 }).map((_, hour) => {
        const d = new Date(timelineStart);
        d.setUTCHours(d.getUTCHours() + hour);
        return {
          id: `hour-${hour}`,
          date: d,
          label: formatIST(d, "ha"),
          subLabel: formatIST(d, "HH:00"),
          isToday: isSameDay(toIST(d), toIST(todayIST)),
          isMajorMilestone: hour % 6 === 0, // Highlight 00:00, 06:00, 12:00, 18:00
          isWeekend: false,
        };
      });
    } else if (viewMode === "week") {
      return Array.from({ length: 7 }).map((_, dayIdx) => {
        const d = addDays(timelineStart, dayIdx);
        const dayOfWeek = toIST(d).getDay();
        return {
          id: `day-${dayIdx}`,
          date: d,
          label: formatIST(d, "EEE"),
          subLabel: formatIST(d, "dd MMM"),
          isToday: isSameDay(toIST(d), toIST(todayIST)),
          isMajorMilestone: false,
          isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
        };
      });
    }
    return [];
  }, [viewMode, timelineStart, todayIST]);

  // Calculate percentage position for "Now" line
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
      width: Math.max(0.8, Math.min(100 - left, width)),
      isStartsBefore: startMs < tStartMs,
      isEndsAfter: endMs > tEndMs,
    };
  };

  // Calculate CSS grid column span for Week view
  const getBookingWeekCols = (startIso: string, endIso: string) => {
    const startMs = new Date(startIso).getTime();
    const endMs = new Date(endIso).getTime();
    const weekStartMs = timelineStart.getTime();
    const weekEndMs = weekStartMs + 7 * 24 * 60 * 60 * 1000;

    if (endMs <= weekStartMs || startMs >= weekEndMs) return null;

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
      startCol: startDayIdx + 1,
      endCol: endDayIdx + 1,
      isStartsBefore: startMs < weekStartMs,
      isEndsAfter: endMs > weekEndMs,
    };
  };

  return (
    <div
      className={cn(
        "space-y-2 flex flex-col flex-1 min-h-0 h-full",
        className
      )}
    >
      {/* 1. Responsive Calendar Toolbar */}
      <div className="flex flex-col lg:flex-row gap-2 items-stretch lg:items-center justify-between p-2 sm:px-3 sm:py-2 rounded-xl border border-border bg-card shadow-xs shrink-0">
        {/* Left: Navigation + Current Date Title + Mobile View Switcher */}
        <div className="flex items-center justify-between gap-2 min-w-0">
          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
            {/* Prev / Today / Next Controls */}
            <div className="flex items-center gap-0.5 border border-border rounded-lg p-0.5 bg-muted/40 shrink-0">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-7 rounded-md"
                onClick={handlePrev}
                title={`Previous ${viewMode}`}
              >
                <ChevronLeftIcon className="size-3.5" />
              </Button>
              <Button
                type="button"
                variant={isSelectedToday ? "secondary" : "ghost"}
                size="sm"
                className={cn(
                  "h-7 px-2 text-[11px] font-semibold rounded-md transition-colors",
                  isSelectedToday && "text-primary font-bold"
                )}
                onClick={handleToday}
                title="Jump to Today"
              >
                Today
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-7 rounded-md"
                onClick={handleNext}
                title={`Next ${viewMode}`}
              >
                <ChevronRightIcon className="size-3.5" />
              </Button>
            </div>

            {/* Active Date Range Heading */}
            <div className="flex items-center gap-1.5 pl-0.5 min-w-0">
              <CalendarIcon className="size-3.5 text-primary shrink-0 hidden sm:inline-block" />
              <h2
                key={`${viewMode}-${selectedDate.toISOString()}`}
                className="text-xs sm:text-sm font-bold text-foreground truncate animate-in fade-in duration-200"
              >
                {viewMode === "day"
                  ? formatIST(selectedDate, "EEE, dd MMM yyyy")
                  : viewMode === "week"
                    ? `${formatISTDate(timelineStart)} – ${formatISTDate(
                      timelineEnd
                    )}`
                    : formatIST(selectedDate, "MMMM yyyy")}
              </h2>
              {isFetching && (
                <SpinnerIcon className="size-3.5 text-primary animate-spin shrink-0" />
              )}
            </div>
          </div>
        </div>

        {/* Right: View Mode Toggle + Room Type Filter + Search */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {/* Day / Week / Month View Mode Toggle */}
          <div className="flex items-center border border-border rounded-lg p-0.5 bg-muted/50">
            {(["day", "week", "month"] as const).map((mode) => (
              <Button
                key={mode}
                type="button"
                variant={viewMode === mode ? "default" : "ghost"}
                size="sm"
                className={cn(
                  "h-7 px-2.5 sm:px-3 text-xs font-semibold rounded-md transition-all duration-200",
                  viewMode === mode && "shadow-xs font-bold scale-[1.02]"
                )}
                onClick={() => setViewMode(mode)}
              >
                {mode === "day" ? "Day" : mode === "week" ? "Week" : "Month"}
              </Button>
            ))}
          </div>

          {/* Room Type Filter */}
          <div className="flex-1 sm:flex-initial sm:w-40">
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

          {/* Room Search Input with Clear Button */}
          <div className="relative flex-1 sm:flex-initial sm:w-44">
            <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
            <Input
              type="text"
              placeholder="Search room..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 lg:h-7 pl-8 pr-6 text-xs rounded-md w-full"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs font-bold leading-none"
                title="Clear search"
              >
                ×
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 2. Occupancy Summary & Legend Bar */}
      <div className="px-2.5 py-1.5 rounded-xl border border-border bg-card shadow-xs flex flex-col xl:flex-row xl:items-center justify-between gap-2 text-xs shrink-0">
        {/* Status Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5 xl:pb-0">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground shrink-0 mr-0.5">
            {viewMode === "day"
              ? "Day"
              : viewMode === "week"
                ? "Week"
                : "Month"}
            :
          </span>

          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-700 dark:text-blue-400 font-semibold border border-blue-500/20 text-[11px] shrink-0">
            <span className="size-2 rounded-full bg-blue-600" />
            <span>{occupancyStats.occupiedCount} Occupied</span>
          </div>

          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-400 font-semibold border border-amber-500/20 text-[11px] shrink-0">
            <span className="size-2 rounded-full bg-amber-500" />
            <span>{occupancyStats.reservedCount} Reserved</span>
          </div>

          {occupancyStats.maintenanceCount > 0 && (
            <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-purple-500/10 text-purple-700 dark:text-purple-400 font-semibold border border-purple-500/20 text-[11px] shrink-0 whitespace-nowrap">
              <MaintenanceIcon className="size-3 text-purple-600 dark:text-purple-400 shrink-0" />
              <span>{occupancyStats.maintenanceCount} Maintenance</span>
            </div>
          )}

          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-semibold border border-emerald-500/20 text-[11px] shrink-0">
            <span className="size-2 rounded-full bg-emerald-500" />
            <span>{occupancyStats.availableCount} Free</span>
          </div>

          {occupancyStats.totalRooms > 0 && (
            <Badge
              variant="secondary"
              className="font-mono text-[10px] font-bold px-2 py-0.5 bg-muted shrink-0"
            >
              {occupancyStats.occupancyRate}% Occ
            </Badge>
          )}
        </div>

        {/* Clean Left-Accent Legend matching the new bars */}
        <div className="hidden sm:flex flex-wrap items-center gap-3 text-muted-foreground text-[11px] pt-1 xl:pt-0 border-t xl:border-t-0 border-border/50">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-2.5 rounded-xs border-l-2 border-l-blue-600 bg-blue-500/20 shrink-0" />
            <span>Checked In</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-2.5 rounded-xs border-l-2 border-l-amber-500 bg-amber-500/25 shrink-0" />
            <span>Reserved</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-2.5 rounded-xs border-l-2 border-l-slate-400 bg-slate-500/20 shrink-0" />
            <span>Checked Out</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-2.5 rounded-xs border border-purple-400/80 dark:border-purple-600/70 bg-maintenance-striped shrink-0" />
            <span>Maintenance</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-destructive animate-pulse shrink-0" />
            <span>Room Issue</span>
          </div>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="p-3 rounded-xl border border-destructive/30 bg-destructive/5 text-destructive text-xs flex items-center justify-between gap-3 shrink-0">
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

      {/* 3. Animated Main View Container (Day ↔ Week ↔ Month transitions) */}
      <div
        key={viewMode}
        className="flex flex-col flex-1 min-h-0 h-full animate-in fade-in zoom-in-[0.99] slide-in-from-bottom-1 duration-200 ease-out"
      >
        {viewMode === "month" ? (
          <CalendarMonthView
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
            onDateClick={(newDate) => handleDateClick(newDate)}
            onViewDay={(newDate) => {
              setSelectedDate(newDate);
              setViewMode("day");
            }}
            rooms={filteredRooms}
            bookings={timelineData?.bookings || []}
            maintenance={timelineData?.maintenance || []}
            onSelectBooking={(b, room) =>
              setSelectedBooking({ booking: b, room })
            }
            onSelectMaintenance={(m, room) =>
              setSelectedMaintenance({ maintenance: m, room })
            }
          />
        ) : (
          <div className="rounded-xl border border-border bg-card shadow-xs overflow-auto flex-1 min-h-0 h-full custom-scrollbar select-none relative">
            <div
              className={cn(
                viewMode === "week"
                  ? "w-full min-w-[700px]"
                  : "min-w-[1200px] w-full"
              )}
            >
              {/* Sticky Header Row */}
              <div className="flex border-b border-border bg-muted/95 backdrop-blur-xs sticky top-0 z-30">
                {/* Top-Left Sticky Room Column Header */}
                <div className="sticky left-0 top-0 z-40 w-28 sm:w-44 lg:w-52 shrink-0 bg-muted/95 backdrop-blur-xs px-3 py-2 border-r border-border font-bold text-xs text-foreground flex items-center justify-between shadow-[1px_0_3px_rgba(0,0,0,0.04)]">
                  <span className="uppercase tracking-wider text-[11px] text-muted-foreground">
                    Room
                  </span>
                  <Badge
                    variant="secondary"
                    className="text-[10px] font-mono px-1.5 py-0"
                  >
                    {filteredRooms.length}
                  </Badge>
                </div>

                {/* Time / Date Column Headers */}
                <div
                  className="flex-1 grid relative"
                  style={{
                    gridTemplateColumns: `repeat(${headerColumns.length}, minmax(0, 1fr))`,
                  }}
                >
                  {headerColumns.map((col) => (
                    <div
                      key={col.id}
                      onClick={() => {
                        handleDateClick(
                          col.date,
                          undefined,
                          viewMode === "day"
                        );
                      }}
                      className={cn(
                        "py-2 px-1 text-center border-r last:border-r-0 flex flex-col justify-center transition-colors cursor-pointer group/hcol",
                        viewMode === "week"
                          ? "border-border hover:bg-primary/8"
                          : col.isMajorMilestone
                            ? "border-r-border border-l-border/80 bg-muted/40 hover:bg-primary/5"
                            : "border-border/50 hover:bg-primary/5",
                        col.isWeekend && !col.isToday && "bg-muted/70",
                        col.isToday && "bg-primary/10 text-primary"
                      )}
                      title={
                        viewMode === "week"
                          ? `Click to book for ${formatIST(col.date, "dd MMM yyyy")}`
                          : `Click to book at ${col.subLabel}`
                      }
                    >
                      <span
                        className={cn(
                          "text-[11px] sm:text-xs font-bold leading-tight",
                          col.isToday
                            ? "text-primary"
                            : "text-foreground group-hover/hcol:text-primary"
                        )}
                      >
                        {col.label}
                      </span>
                      <span
                        className={cn(
                          "text-[10px] leading-tight font-mono",
                          col.isToday
                            ? "text-primary font-bold"
                            : "text-muted-foreground"
                        )}
                      >
                        {col.subLabel}
                      </span>
                    </div>
                  ))}

                  {/* Current Time Indicator Pill in Header */}
                  {nowPercent !== null && nowMs !== null && (
                    <div
                      suppressHydrationWarning
                      className="absolute top-0 bottom-0 pointer-events-none z-30 flex flex-col items-center"
                      style={{ left: `${nowPercent}%` }}
                    >
                      <span className="-translate-x-1/2 bg-red-600 text-white text-[9px] font-mono font-bold px-1 py-0.2 rounded-b shadow-xs whitespace-nowrap">
                        {formatIST(new Date(nowMs), "hh:mm a")}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Room Rows */}
              {isLoading && !timelineData ? (
                <div className="p-4 sm:p-6 space-y-2.5">
                  {Array.from({ length: 7 }).map((_, i) => (
                    <div key={i} className="flex gap-3 items-center">
                      <Skeleton className="h-12 w-28 sm:w-44 lg:w-52 shrink-0 rounded-lg" />
                      <Skeleton className="h-12 flex-1 rounded-lg" />
                    </div>
                  ))}
                </div>
              ) : filteredRooms.length === 0 ? (
                <div className="p-12 text-center space-y-3">
                  <p className="text-sm text-muted-foreground">
                    No rooms match your current search or filter criteria.
                  </p>
                  {hasActiveFilters && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={resetFilters}
                      className="text-xs h-8"
                    >
                      Reset Filters
                    </Button>
                  )}
                </div>
              ) : (
                <div
                  key={`${viewMode}-${timelineStart.toISOString()}`}
                  className="divide-y divide-border relative animate-in fade-in duration-150"
                >
                  {filteredRooms.map((room) => {
                    const roomBookings = eventsByRoom.bookingMap[room.id] || [];
                    const roomMaintenance =
                      eventsByRoom.maintenanceMap[room.id] || [];

                    return (
                      <div
                        key={room.id}
                        className="flex group/row even:bg-muted/[0.15] hover:bg-primary/[0.03] transition-colors"
                      >
                        {/* Sticky Left Room Card */}
                        <div
                          onClick={() => handleDateClick(selectedDate, room.id)}
                          title={`Click to book Room ${room.number}`}
                          className="sticky left-0 z-20 w-28 sm:w-44 lg:w-52 shrink-0 bg-card group-even/row:bg-card group-hover/row:bg-accent/50 transition-colors px-2.5 sm:px-3 py-1.5 border-r border-border flex flex-col justify-center min-w-0 cursor-pointer shadow-[1px_0_3px_rgba(0,0,0,0.03)]"
                        >
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="font-bold text-xs sm:text-sm text-foreground group-hover/row:text-primary transition-colors">
                              {room.number}
                            </span>
                            {room.hasOpenProblem && (
                              <span
                                title="Open problem reported"
                                className="inline-flex shrink-0"
                              >
                                <CircleAlertIcon className="size-3.5 text-destructive animate-pulse" />
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] sm:text-[11px] text-muted-foreground truncate leading-tight">
                            {room.typeName}
                          </p>
                        </div>

                        {/* Room Timeline Canvas */}
                        {viewMode === "week" ? (
                          /* ── Week View: 7-Column CSS Grid with Crisp Cell Borders ── */
                          <div
                            className="flex-1"
                            style={{
                              display: "grid",
                              gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
                              gridTemplateRows: "48px",
                              height: "48px",
                              position: "relative",
                            }}
                          >
                            {/* 7 Clickable Day Slots */}
                            {headerColumns.map((col, colIdx) => (
                              <div
                                key={col.id}
                                onClick={() =>
                                  handleDateClick(col.date, room.id)
                                }
                                title={`Click to book Room ${room.number} on ${formatIST(
                                  col.date,
                                  "dd MMM yyyy"
                                )}`}
                                style={{ gridRow: 1, gridColumn: colIdx + 1 }}
                                className={cn(
                                  "border-r last:border-r-0 border-border/80 h-full cursor-pointer transition-colors group/slot relative",
                                  col.isWeekend &&
                                  !col.isToday &&
                                  "bg-muted/25",
                                  col.isToday && "bg-primary/[0.04]",
                                  "hover:bg-primary/10"
                                )}
                              >
                                <span className="opacity-0 group-hover/slot:opacity-100 transition-opacity absolute inset-0 flex items-center justify-center text-[10px] font-bold text-primary pointer-events-none">
                                  + Book
                                </span>
                              </div>
                            ))}

                            {/* Live "Now" Line */}
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
                                <div className="w-[1.5px] h-full bg-red-500/85 shadow-[0_0_4px_rgba(239,68,68,0.4)]" />
                              </div>
                            )}

                            {/* Maintenance Bars (Soft Tinted + Left Purple Accent) */}
                            {roomMaintenance.map((m) => {
                              const cols = getBookingWeekCols(
                                m.startsAt,
                                m.endsAt
                              );
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
                                      setSelectedMaintenance({
                                        maintenance: m,
                                        room,
                                      });
                                    }}
                                    style={{
                                      gridRow: 1,
                                      gridColumn: `${cols.startCol} / ${cols.endCol}`,
                                      zIndex: 5,
                                      margin: "5px 3px",
                                    }}
                                    className={cn(
                                      "rounded-md border border-purple-400/80 dark:border-purple-600/70 border-l-[3px] border-l-purple-600 bg-maintenance-striped text-purple-950 dark:text-purple-100 cursor-pointer px-2 py-1 overflow-hidden flex items-center gap-1.5 transition-all hover:shadow-xs select-none",
                                      cols.isStartsBefore && "rounded-l-none",
                                      cols.isEndsAfter && "rounded-r-none"
                                    )}
                                  >
                                    <MaintenanceIcon className="size-3.5 shrink-0 text-purple-700 dark:text-purple-300" />
                                    <span className="text-xs font-bold truncate leading-none">
                                      {m.reason
                                        ? `Maint • ${m.reason}`
                                        : "Maintenance"}
                                    </span>
                                  </div>
                                </MaintenanceHoverCard>
                              );
                            })}

                            {/* Booking Bars (Soft Tinted + Crisp Left Accent Border) */}
                            {roomBookings.map((b) => {
                              const cols = getBookingWeekCols(
                                b.checkInAt,
                                b.checkOutAt
                              );
                              if (!cols) return null;

                              const isCheckedIn = b.status === "CHECKED_IN";
                              const isReserved = b.status === "RESERVED";

                              const barStyle = isCheckedIn
                                ? "border border-blue-500/30 border-l-[3px] border-l-blue-600 bg-blue-500/14 hover:bg-blue-500/22 text-blue-950 dark:text-blue-100"
                                : isReserved
                                  ? "border border-amber-500/35 border-l-[3px] border-l-amber-500 bg-amber-500/16 hover:bg-amber-500/25 text-amber-950 dark:text-amber-100"
                                  : "border border-slate-400/30 border-l-[3px] border-l-slate-500 bg-slate-500/12 hover:bg-slate-500/20 text-slate-700 dark:text-slate-200";

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
                                      margin: "5px 3px",
                                    }}
                                    className={cn(
                                      "rounded-md cursor-pointer px-2 py-0.5 overflow-hidden flex flex-col justify-center gap-0.5 transition-all hover:z-20 hover:shadow-xs select-none backdrop-blur-[1px]",
                                      barStyle,
                                      cols.isStartsBefore && "rounded-l-none",
                                      cols.isEndsAfter && "rounded-r-none"
                                    )}
                                  >
                                    <div className="flex items-center justify-between gap-1.5 min-w-0">
                                      <div className="flex items-center gap-1 min-w-0">
                                        {cols.isStartsBefore && (
                                          <span className="text-[9px] opacity-70 shrink-0">
                                            ◀
                                          </span>
                                        )}
                                        {room.hasOpenProblem && (
                                          <CircleAlertIcon className="size-3 text-destructive animate-pulse shrink-0" />
                                        )}
                                        <span className="text-xs font-bold truncate leading-tight">
                                          {b.primaryGuestName}
                                        </span>
                                        {b.groupBookingId && (
                                          <span className="text-[8px] uppercase tracking-wider px-1 py-0.2 rounded bg-foreground/10 font-bold shrink-0">
                                            Group
                                          </span>
                                        )}
                                      </div>

                                      <div className="flex items-center gap-1 shrink-0">
                                        {b.balanceDue > 0 && isCheckedIn && (
                                          <span className="text-[9px] px-1 py-0 rounded-xs bg-red-600 text-white font-mono font-bold">
                                            Due {formatINR(b.balanceDue)}
                                          </span>
                                        )}
                                        {cols.isEndsAfter && (
                                          <span className="text-[9px] opacity-70">
                                            ▶
                                          </span>
                                        )}
                                      </div>
                                    </div>

                                    <div className="text-[10px] opacity-75 font-mono font-medium truncate leading-none">
                                      {formatISTTime(b.checkInAt)} →{" "}
                                      {formatISTTime(b.checkOutAt)}
                                    </div>
                                  </div>
                                </BookingHoverCard>
                              );
                            })}
                          </div>
                        ) : (
                          /* ── Day View: 24-Hour Percentage Canvas with 6-Hour Milestone Dividers ── */
                          <div className="flex-1 relative h-12">
                            {/* 24 Clickable Hour Cells */}
                            <div
                              className="absolute inset-0 grid"
                              style={{
                                gridTemplateColumns: `repeat(${headerColumns.length}, minmax(0, 1fr))`,
                              }}
                            >
                              {headerColumns.map((col) => (
                                <div
                                  key={col.id}
                                  onClick={() =>
                                    handleDateClick(col.date, room.id, true)
                                  }
                                  title={`Book Room ${room.number} at ${col.subLabel}`}
                                  className={cn(
                                    "border-r last:border-r-0 h-full cursor-pointer transition-colors hover:bg-primary/10",
                                    col.isMajorMilestone
                                      ? "border-r-border border-l-border/70 bg-muted/15"
                                      : "border-border/45",
                                    col.isToday && "bg-primary/[0.02]"
                                  )}
                                />
                              ))}
                            </div>

                            {/* Current Time Line */}
                            {nowPercent !== null && (
                              <div
                                suppressHydrationWarning
                                className="absolute top-0 bottom-0 pointer-events-none z-20"
                                style={{ left: `${nowPercent}%` }}
                              >
                                <div className="w-[1.5px] h-full bg-red-500/85 shadow-[0_0_4px_rgba(239,68,68,0.4)]" />
                              </div>
                            )}

                            {/* Maintenance Bars */}
                            {roomMaintenance.map((m) => {
                              const pos = calculatePosition(
                                m.startsAt,
                                m.endsAt
                              );
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
                                      setSelectedMaintenance({
                                        maintenance: m,
                                        room,
                                      });
                                    }}
                                    style={{
                                      left: `${pos.left}%`,
                                      width: `${pos.width}%`,
                                    }}
                                    className={cn(
                                      "absolute top-1.5 bottom-1.5 z-10 rounded-md border border-purple-400/80 dark:border-purple-600/70 border-l-[3px] border-l-purple-600 bg-maintenance-striped text-purple-950 dark:text-purple-100 cursor-pointer px-2 py-0.5 overflow-hidden flex items-center gap-1.5 transition-all hover:shadow-xs select-none",
                                      pos.isStartsBefore && "rounded-l-none",
                                      pos.isEndsAfter && "rounded-r-none"
                                    )}
                                  >
                                    <MaintenanceIcon className="size-3.5 shrink-0 text-purple-700 dark:text-purple-300" />
                                    <span className="text-xs font-bold truncate leading-none">
                                      {m.reason
                                        ? `Maintenance • ${m.reason}`
                                        : "Maintenance"}
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
                                ? "border border-blue-500/30 border-l-[3px] border-l-blue-600 bg-blue-500/14 hover:bg-blue-500/22 text-blue-950 dark:text-blue-100"
                                : isReserved
                                  ? "border border-amber-500/35 border-l-[3px] border-l-amber-500 bg-amber-500/16 hover:bg-amber-500/25 text-amber-950 dark:text-amber-100"
                                  : "border border-slate-400/30 border-l-[3px] border-l-slate-500 bg-slate-500/12 hover:bg-slate-500/20 text-slate-700 dark:text-slate-200";

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
                                      "absolute top-1.5 bottom-1.5 z-10 rounded-md cursor-pointer px-2 py-0.5 overflow-hidden flex flex-col justify-center gap-0.5 transition-all hover:z-20 hover:shadow-xs select-none backdrop-blur-[1px]",
                                      barStyle,
                                      pos.isStartsBefore && "rounded-l-none",
                                      pos.isEndsAfter && "rounded-r-none"
                                    )}
                                  >
                                    <div className="flex items-center justify-between gap-1.5 min-w-0">
                                      <div className="flex items-center gap-1 min-w-0">
                                        {pos.isStartsBefore && (
                                          <span className="text-[9px] opacity-70 shrink-0">
                                            ◀
                                          </span>
                                        )}
                                        {room.hasOpenProblem && (
                                          <CircleAlertIcon className="size-2.5 text-destructive animate-pulse shrink-0" />
                                        )}
                                        <span className="text-xs font-bold truncate leading-tight">
                                          {b.primaryGuestName}
                                        </span>
                                        {b.groupBookingId && (
                                          <span className="text-[8px] uppercase tracking-wider px-1 py-0.2 rounded bg-foreground/10 font-bold shrink-0">
                                            Group
                                          </span>
                                        )}
                                      </div>

                                      <div className="flex items-center gap-1 shrink-0">
                                        {b.balanceDue > 0 && isCheckedIn && (
                                          <span className="text-[9px] px-1 py-0 rounded-xs bg-red-600 text-white font-mono font-bold">
                                            Due {formatINR(b.balanceDue)}
                                          </span>
                                        )}
                                        {pos.isEndsAfter && (
                                          <span className="text-[9px] opacity-70">
                                            ▶
                                          </span>
                                        )}
                                      </div>
                                    </div>

                                    <div className="text-[10px] opacity-75 font-mono font-medium truncate leading-none">
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