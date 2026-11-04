"use client";

import React, { useMemo } from "react";
import {
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
} from "date-fns";
import {
  startOfISTDay,
  endOfISTDay,
  startOfISTMonth,
  endOfISTMonth,
  formatIST,
  formatISTTime,
  toIST,
} from "@/lib/datetime";
import { formatINR } from "@/lib/money";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  MaintenanceIcon,
  CircleAlertIcon,
  ChevronRightIcon,
} from "@/lib/icons";
import { BookingHoverCard } from "./booking-hover-card";
import { MaintenanceHoverCard } from "./maintenance-hover-card";
import type {
  CalendarBookingEvent,
  CalendarMaintenanceEvent,
  CalendarRoomItem,
} from "@/server/services/calendar.service";

interface CalendarMonthViewProps {
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  onDateClick?: (date: Date) => void;
  onViewDay?: (date: Date) => void;
  rooms: CalendarRoomItem[];
  bookings: CalendarBookingEvent[];
  maintenance: CalendarMaintenanceEvent[];
  onSelectBooking: (
    booking: CalendarBookingEvent,
    room?: CalendarRoomItem
  ) => void;
  onSelectMaintenance: (
    maintenance: CalendarMaintenanceEvent,
    room?: CalendarRoomItem
  ) => void;
}

const WEEKDAY_NAMES = [
  { mini: "M", short: "Mon" },
  { mini: "T", short: "Tue" },
  { mini: "W", short: "Wed" },
  { mini: "T", short: "Thu" },
  { mini: "F", short: "Fri" },
  { mini: "S", short: "Sat", isWeekend: true },
  { mini: "S", short: "Sun", isWeekend: true },
];

const STATUS_PRIORITY: Record<string, number> = {
  CHECKED_IN: 1,
  RESERVED: 2,
  CHECKED_OUT: 3,
};

export function CalendarMonthView({
  selectedDate,
  onSelectDate,
  onDateClick,
  onViewDay,
  rooms,
  bookings,
  maintenance,
  onSelectBooking,
  onSelectMaintenance,
}: CalendarMonthViewProps) {
  const todayIST = useMemo(() => startOfISTDay(new Date()), []);

  // Fast room lookup map
  const roomMap = useMemo(() => {
    const map = new Map<string, CalendarRoomItem>();
    for (const r of rooms) {
      map.set(r.id, r);
    }
    return map;
  }, [rooms]);

  // Generate 7-column calendar grid dates (Monday-Sunday)
  const calendarDays = useMemo(() => {
    const monthStart = startOfISTMonth(selectedDate);
    const monthEnd = endOfISTMonth(selectedDate);
    const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

    return eachDayOfInterval({ start: gridStart, end: gridEnd });
  }, [selectedDate]);

  const weekRowsCount = useMemo(() => {
    return Math.max(1, Math.ceil(calendarDays.length / 7));
  }, [calendarDays.length]);

  // Pre-calculate day data for each cell
  const daysData = useMemo(() => {
    const totalRooms = rooms.length;

    return calendarDays.map((day) => {
      const dayStart = startOfISTDay(day);
      const dayEnd = endOfISTDay(day);
      const dayStartIso = dayStart.toISOString();
      const dayEndIso = dayEnd.toISOString();

      const dayBookings: CalendarBookingEvent[] = [];
      const occupiedRoomIds = new Set<string>();
      const reservedRoomIds = new Set<string>();

      for (const b of bookings) {
        if (!roomMap.has(b.roomId)) continue;
        if (b.checkInAt <= dayEndIso && b.checkOutAt >= dayStartIso) {
          dayBookings.push(b);
          if (b.status === "CHECKED_IN") {
            occupiedRoomIds.add(b.roomId);
          } else if (b.status === "RESERVED") {
            reservedRoomIds.add(b.roomId);
          }
        }
      }

      // Sort so CHECKED_IN and RESERVED always appear above CHECKED_OUT
      dayBookings.sort((a, b) => {
        const pA = STATUS_PRIORITY[a.status] ?? 99;
        const pB = STATUS_PRIORITY[b.status] ?? 99;
        return pA - pB;
      });

      const dayMaintenance: CalendarMaintenanceEvent[] = [];
      const maintenanceRoomIds = new Set<string>();

      for (const m of maintenance) {
        if (!roomMap.has(m.roomId)) continue;
        if (m.startsAt <= dayEndIso && m.endsAt >= dayStartIso) {
          dayMaintenance.push(m);
          maintenanceRoomIds.add(m.roomId);
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
      const occupancyRate =
        totalRooms > 0
          ? Math.round(((occupiedCount + reservedCount) / totalRooms) * 100)
          : 0;

      const isCurrentMonth = isSameMonth(toIST(day), toIST(selectedDate));
      const isToday = isSameDay(toIST(day), toIST(todayIST));
      const isSelected = isSameDay(toIST(day), toIST(selectedDate));
      const dayOfWeek = toIST(day).getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

      return {
        date: day,
        isCurrentMonth,
        isToday,
        isSelected,
        isWeekend,
        occupiedCount,
        reservedCount,
        maintenanceCount,
        availableCount,
        busyCount,
        occupancyRate,
        dayBookings,
        dayMaintenance,
      };
    });
  }, [
    calendarDays,
    rooms,
    bookings,
    maintenance,
    roomMap,
    selectedDate,
    todayIST,
  ]);

  // Selected day data for the Mobile/Tablet bottom agenda panel
  const selectedDayInfo = useMemo(() => {
    return (
      daysData.find((d) => isSameDay(toIST(d.date), toIST(selectedDate))) ||
      daysData[0]
    );
  }, [daysData, selectedDate]);

  return (
    <div className="flex flex-col gap-2.5 flex-1 min-h-0 h-full w-full">
      {/* Main Month Grid Card — Uses 1px solid gap over bg-border for crisp cell separation */}
      <div className="rounded-xl border border-border bg-border shadow-xs overflow-hidden flex flex-col flex-1 min-h-[380px] w-full">
        {/* Clean Weekday Header Row */}
        <div className="grid grid-cols-7 gap-px bg-border border-b border-border shrink-0 text-center">
          {WEEKDAY_NAMES.map((w) => (
            <div
              key={w.short}
              className={cn(
                "py-2 px-2 bg-muted/90 text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-center",
                w.isWeekend && "text-foreground/75 bg-muted"
              )}
            >
              <span className="sm:hidden">{w.mini}</span>
              <span className="hidden sm:inline">{w.short}</span>
            </div>
          ))}
        </div>

        {/* 7-Column Days Grid: gap-px guarantees visible 1px borders between every day block */}
        <div
          className="grid grid-cols-7 gap-px bg-border flex-1 min-h-0"
          style={{
            gridTemplateRows: `repeat(${weekRowsCount}, minmax(0, 1fr))`,
          }}
        >
          {daysData.map((d) => {
            const dayNumber = formatIST(d.date, "d");

            // Show at most 2 pills total so the "+X more" button is NEVER clipped
            const showMaintCount = d.dayMaintenance.length > 0 ? 1 : 0;
            const showBookingCount = showMaintCount > 0 ? 1 : 2;
            const totalEvents =
              d.dayBookings.length + d.dayMaintenance.length;
            const visibleCount =
              showMaintCount +
              Math.min(d.dayBookings.length, showBookingCount);
            const hiddenCount = Math.max(0, totalEvents - visibleCount);

            return (
              <div
                key={d.date.toISOString()}
                onClick={() => {
                  onSelectDate(d.date);
                  onDateClick?.(d.date);
                }}
                className={cn(
                  "p-1.5 sm:p-2 flex flex-col justify-between transition-colors cursor-pointer group/cell relative select-none overflow-hidden min-h-[64px] sm:min-h-[92px]",
                  // Clear visual contrast between current month, weekend, and outside-month cells
                  !d.isCurrentMonth
                    ? "bg-muted/40 text-muted-foreground/45 hover:bg-muted/60"
                    : d.isToday
                      ? "bg-primary/[0.04] hover:bg-primary/[0.07]"
                      : d.isWeekend
                        ? "bg-card/95 hover:bg-accent/40"
                        : "bg-card hover:bg-accent/40",
                  // Strong ring for selected or today cell
                  d.isSelected &&
                  "ring-2 ring-inset ring-primary z-10"
                )}
                title={`Click to book on ${formatIST(d.date, "dd MMM yyyy")}`}
              >
                {/* Top Header: Date Number + Clean Occupancy Pill */}
                <div className="flex items-center justify-between gap-1 shrink-0">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onViewDay) {
                          onViewDay(d.date);
                        } else {
                          onSelectDate(d.date);
                        }
                      }}
                      title={`View ${formatIST(d.date, "dd MMM")} timeline`}
                      className={cn(
                        "size-6 rounded-md flex items-center justify-center text-xs transition-colors cursor-pointer",
                        d.isToday
                          ? "bg-primary text-primary-foreground font-bold shadow-xs"
                          : d.isSelected
                            ? "bg-primary/15 text-primary font-bold"
                            : d.isCurrentMonth
                              ? "text-foreground font-bold hover:bg-muted"
                              : "text-muted-foreground/50 font-medium hover:bg-muted/60"
                      )}
                    >
                      {dayNumber}
                    </button>

                    {d.isToday && (
                      <span className="hidden xl:inline-block text-[9px] font-extrabold uppercase tracking-wider text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                        Today
                      </span>
                    )}
                  </div>

                  {/* Right Side: View Day Button */}
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      aria-label="View Day"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onViewDay) {
                          onViewDay(d.date);
                        } else {
                          onSelectDate(d.date);
                        }
                      }}

                      className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-primary/10 hover:bg-primary text-primary hover:text-primary-foreground shadow-2xs transition-all opacity-0 pointer-events-none group-hover/cell:opacity-100 group-hover/cell:pointer-events-auto focus-visible:opacity-100 focus-visible:pointer-events-auto"

                      title={`Open ${formatIST(d.date, "dd MMM")} Day Timeline`}
                    >
                      <span>View Day</span>
                      <ChevronRightIcon className="size-2.5" />
                    </button>
                  </div>
                </div>

                {/* Mobile-Only Dots (< md) */}
                <div className="flex md:hidden items-center justify-center gap-1 my-auto py-0.5 flex-wrap">
                  {d.occupiedCount > 0 && (
                    <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-blue-600 dark:text-blue-400">
                      <span className="size-1.5 rounded-full bg-blue-600" />
                      {d.occupiedCount}
                    </span>
                  )}
                  {d.reservedCount > 0 && (
                    <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-amber-600 dark:text-amber-400">
                      <span className="size-1.5 rounded-full bg-amber-500" />
                      {d.reservedCount}
                    </span>
                  )}
                  {d.maintenanceCount > 0 && (
                    <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-purple-600 dark:text-purple-400">
                      <span className="size-1.5 rounded-full bg-purple-600" />
                      {d.maintenanceCount}
                    </span>
                  )}
                </div>

                {/* Desktop/Tablet Events Container (md+) — Soft Tinted Pills with Left Accent Bar */}
                <div
                  className={cn(
                    "hidden md:flex flex-col gap-1 my-auto py-0.5 min-h-0",
                    !d.isCurrentMonth && "opacity-55"
                  )}
                >
                  {/* Maintenance Item */}
                  {d.dayMaintenance.slice(0, showMaintCount).map((m) => {
                    const room = roomMap.get(m.roomId);
                    return (
                      <MaintenanceHoverCard key={m.id} maintenance={m} room={room}>
                        <div
                          role="button"
                          tabIndex={0}
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectMaintenance(m, room);
                          }}
                          className="px-1.5 py-0.5 rounded-r border border-purple-400/80 dark:border-purple-600/70 border-l-2 border-l-purple-600 bg-maintenance-striped text-purple-950 dark:text-purple-100 text-[10px] font-medium truncate flex items-center gap-1 transition-colors"
                        >
                          <MaintenanceIcon className="size-2.5 shrink-0 text-purple-700 dark:text-purple-300" />
                          <span className="font-bold shrink-0">
                            {room ? `R${room.number}` : "Room"}
                          </span>
                          <span className="truncate opacity-85">
                            {m.reason || "Maintenance"}
                          </span>
                        </div>
                      </MaintenanceHoverCard>
                    );
                  })}

                  {/* Booking Items (Sorted: Checked-In -> Reserved -> Checked-Out) */}
                  {d.dayBookings.slice(0, showBookingCount).map((b) => {
                    const room = roomMap.get(b.roomId);
                    const isCheckedIn = b.status === "CHECKED_IN";
                    const isReserved = b.status === "RESERVED";

                    // Soft tinted surface with crisp left accent bar instead of heavy solid blocks
                    const pillStyle = isCheckedIn
                      ? "border-l-2 border-l-blue-600 bg-blue-500/12 hover:bg-blue-500/20 text-blue-950 dark:text-blue-100"
                      : isReserved
                        ? "border-l-2 border-l-amber-500 bg-amber-500/15 hover:bg-amber-500/25 text-amber-950 dark:text-amber-100"
                        : "border-l-2 border-l-slate-400 bg-slate-500/10 hover:bg-slate-500/18 text-slate-700 dark:text-slate-300";

                    return (
                      <BookingHoverCard key={b.id} booking={b} room={room}>
                        <div
                          role="button"
                          tabIndex={0}
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectBooking(b, room);
                          }}
                          className={cn(
                            "px-1.5 py-0.5 rounded-r text-[10px] truncate flex items-center justify-between gap-1 transition-colors",
                            pillStyle
                          )}
                        >
                          <div className="flex items-center gap-1 min-w-0">
                            {room?.hasOpenProblem && (
                              <CircleAlertIcon className="size-2.5 shrink-0 text-destructive animate-pulse" />
                            )}
                            <span className="font-bold shrink-0">
                              {room?.number ? `R${room.number}` : ""}
                            </span>
                            <span className="truncate font-medium opacity-90">
                              {b.primaryGuestName}
                            </span>
                          </div>

                          {b.balanceDue > 0 && isCheckedIn && (
                            <span className="size-1.5 rounded-full bg-red-600 shrink-0" title={`Balance Due: ${formatINR(b.balanceDue)}`} />
                          )}
                        </div>
                      </BookingHoverCard>
                    );
                  })}
                </div>

                {/* Bottom Footer: Overflow "+X more" Pill & Subtle Occupancy Bar */}
                <div className="hidden md:flex items-center justify-between gap-2 pt-0.5 shrink-0 min-h-[16px]">
                  {hiddenCount > 0 ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onViewDay) {
                          onViewDay(d.date);
                        } else {
                          onSelectDate(d.date);
                        }
                      }}
                      className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded bg-muted hover:bg-primary hover:text-primary-foreground text-foreground/80 text-[10px] font-bold transition-colors cursor-pointer"
                    >
                      <span>+{hiddenCount} more</span>
                      <ChevronRightIcon className="size-2.5" />
                    </button>
                  ) : (
                    <span />
                  )}

                  {/* Only show occupancy bar/rate on days that actually have active occupancy */}
                  {d.isCurrentMonth && d.occupancyRate > 0 && (
                    <div className="flex items-center gap-1.5 ml-auto">
                      <div className="w-10 h-1 bg-muted rounded-full overflow-hidden hidden xl:flex">
                        {d.occupiedCount > 0 && (
                          <div
                            className="bg-blue-600 h-full"
                            style={{
                              width: `${(d.occupiedCount / rooms.length) * 100}%`,
                            }}
                          />
                        )}
                        {d.reservedCount > 0 && (
                          <div
                            className="bg-amber-500 h-full"
                            style={{
                              width: `${(d.reservedCount / rooms.length) * 100}%`,
                            }}
                          />
                        )}
                      </div>
                      <span className="font-mono text-[9px] font-semibold text-muted-foreground">
                        {d.occupancyRate}%
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Mobile & Small Tablet Selected Day Agenda Drawer (< md screens) */}
      {selectedDayInfo && (
        <div className="md:hidden rounded-xl border border-border bg-card p-3 shadow-xs space-y-2.5 shrink-0">
          <div className="flex items-center justify-between gap-2 border-b border-border/60 pb-2">
            <div>
              <h3 className="text-xs font-bold text-foreground">
                {formatIST(selectedDayInfo.date, "EEEE, dd MMM yyyy")}
              </h3>
              <p className="text-[11px] text-muted-foreground">
                {selectedDayInfo.occupiedCount} Occupied •{" "}
                {selectedDayInfo.reservedCount} Reserved •{" "}
                {selectedDayInfo.availableCount} Free
              </p>
            </div>

            <div className="flex items-center gap-1.5">
              {onViewDay && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => onViewDay(selectedDayInfo.date)}
                >
                  Day View
                </Button>
              )}
              {onDateClick && (
                <Button
                  type="button"
                  size="sm"
                  className="h-7 px-2.5 text-xs font-semibold"
                  onClick={() => onDateClick(selectedDayInfo.date)}
                >
                  + Book
                </Button>
              )}
            </div>
          </div>

          {selectedDayInfo.dayBookings.length === 0 &&
            selectedDayInfo.dayMaintenance.length === 0 ? (
            <p className="text-xs text-muted-foreground py-2 text-center">
              No bookings or maintenance scheduled for this date.
            </p>
          ) : (
            <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
              {selectedDayInfo.dayMaintenance.map((m) => {
                const room = roomMap.get(m.roomId);
                return (
                  <div
                    key={m.id}
                    onClick={() => onSelectMaintenance(m, room)}
                    className="p-2 rounded-lg border-l-2 border-l-purple-600 border border-purple-400/80 dark:border-purple-600/70 bg-maintenance-striped text-purple-950 dark:text-purple-100 flex items-center justify-between gap-2 text-xs cursor-pointer"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <MaintenanceIcon className="size-3.5 text-purple-600 shrink-0" />
                      <span className="font-bold">
                        R{room?.number || "N/A"}
                      </span>
                      <span className="text-muted-foreground truncate">
                        {m.reason || "Maintenance"}
                      </span>
                    </div>
                    <ChevronRightIcon className="size-3.5 text-muted-foreground shrink-0" />
                  </div>
                );
              })}

              {selectedDayInfo.dayBookings.map((b) => {
                const room = roomMap.get(b.roomId);
                const isCheckedIn = b.status === "CHECKED_IN";
                const isReserved = b.status === "RESERVED";

                return (
                  <div
                    key={b.id}
                    onClick={() => onSelectBooking(b, room)}
                    className="p-2 rounded-lg border border-border bg-muted/30 hover:bg-muted/60 flex items-center justify-between gap-2 text-xs cursor-pointer"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className={cn(
                          "size-2 rounded-full shrink-0",
                          isCheckedIn
                            ? "bg-blue-600"
                            : isReserved
                              ? "bg-amber-500"
                              : "bg-slate-400"
                        )}
                      />
                      <span className="font-bold shrink-0">
                        R{room?.number}
                      </span>
                      <span className="font-medium truncate">
                        {b.primaryGuestName}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {b.balanceDue > 0 && isCheckedIn && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-600 text-white font-mono font-bold">
                          Due {formatINR(b.balanceDue)}
                        </span>
                      )}
                      <span className="text-[10px] font-mono text-muted-foreground">
                        {formatISTTime(b.checkInAt)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}