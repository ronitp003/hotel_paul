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
  toIST,
} from "@/lib/datetime";
import { cn } from "@/lib/utils";
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
  rooms: CalendarRoomItem[];
  bookings: CalendarBookingEvent[];
  maintenance: CalendarMaintenanceEvent[];
  onSelectBooking: (booking: CalendarBookingEvent, room?: CalendarRoomItem) => void;
  onSelectMaintenance: (
    maintenance: CalendarMaintenanceEvent,
    room?: CalendarRoomItem
  ) => void;
}

const WEEKDAY_NAMES = [
  { short: "Mon", full: "Monday" },
  { short: "Tue", full: "Tuesday" },
  { short: "Wed", full: "Wednesday" },
  { short: "Thu", full: "Thursday" },
  { short: "Fri", full: "Friday" },
  { short: "Sat", full: "Saturday", isWeekend: true },
  { short: "Sun", full: "Sunday", isWeekend: true },
];

export function CalendarMonthView({
  selectedDate,
  onSelectDate,
  rooms,
  bookings,
  maintenance,
  onSelectBooking,
  onSelectMaintenance,
}: CalendarMonthViewProps) {
  const todayIST = useMemo(() => startOfISTDay(new Date()), []);

  // Room lookup map for fast association
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

  // Pre-calculate day data (occupancy, bookings, maintenance) for each day cell
  const daysData = useMemo(() => {
    const totalRooms = rooms.length;

    return calendarDays.map((day) => {
      const dayStart = startOfISTDay(day);
      const dayEnd = endOfISTDay(day);
      const dayStartIso = dayStart.toISOString();
      const dayEndIso = dayEnd.toISOString();

      // Find overlapping bookings for filtered rooms
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

      // Find overlapping maintenance
      const dayMaintenance: CalendarMaintenanceEvent[] = [];
      const maintenanceRoomIds = new Set<string>();

      for (const m of maintenance) {
        if (!roomMap.has(m.roomId)) continue;
        if (m.startsAt <= dayEndIso && m.endsAt >= dayStartIso) {
          dayMaintenance.push(m);
          maintenanceRoomIds.add(m.roomId);
        }
      }

      // Counts (ensuring a room isn't double-counted across statuses)
      const occupiedCount = occupiedRoomIds.size;
      // Reserved only if not occupied
      let reservedCount = 0;
      for (const rid of reservedRoomIds) {
        if (!occupiedRoomIds.has(rid)) {
          reservedCount++;
        }
      }
      // Maintenance only if not occupied or reserved
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

      return {
        date: day,
        isCurrentMonth,
        isToday,
        isSelected,
        occupiedCount,
        reservedCount,
        maintenanceCount,
        availableCount,
        occupancyRate,
        dayBookings,
        dayMaintenance,
      };
    });
  }, [calendarDays, rooms, bookings, maintenance, roomMap, selectedDate, todayIST]);

  return (
    <div className="rounded-xl border border-border bg-card shadow-xs overflow-hidden">
      {/* Scrollable container for mobile/tablet screens */}
      <div className="overflow-x-auto custom-scrollbar">
        <div className="min-w-[760px] sm:min-w-0">
          {/* Weekday Header Row */}
          <div className="grid grid-cols-7 border-b border-border bg-muted/60 sticky top-0 z-10 text-center font-semibold text-xs text-foreground">
            {WEEKDAY_NAMES.map((w) => (
              <div
                key={w.short}
                className={cn(
                  "py-2.5 px-2 border-r border-border/60 last:border-r-0 flex items-center justify-center gap-1.5",
                  w.isWeekend && "bg-muted/80 text-muted-foreground"
                )}
              >
                <span>{w.short}</span>
                <span className="hidden md:inline text-[11px] font-normal text-muted-foreground">
                  ({w.full})
                </span>
              </div>
            ))}
          </div>

          {/* Calendar Grid (Days) */}
          <div className="grid grid-cols-7 divide-x divide-y divide-border/60 bg-muted/20">
            {daysData.map((d, index) => {
              const dayNumber = formatIST(d.date, "d");

              return (
                <div
                  key={d.date.toISOString()}
                  onClick={() => onSelectDate(d.date)}
                  className={cn(
                    "min-h-[115px] sm:min-h-[130px] p-2 flex flex-col justify-between transition-colors cursor-pointer group/cell relative select-none",
                    d.isCurrentMonth
                      ? "bg-card hover:bg-muted/40"
                      : "bg-muted/10 text-muted-foreground/60 hover:bg-muted/25",
                    d.isSelected && "ring-1.5 ring-primary/60 inset-0 z-5",
                    index % 7 === 0 && "border-l-0"
                  )}
                >
                  {/* Top Bar: Date Number + Occupancy Stats */}
                  <div className="flex items-center justify-between gap-1 mb-1.5">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={cn(
                          "size-6 rounded-full flex items-center justify-center text-xs font-bold transition-transform group-hover/cell:scale-105",
                          d.isToday
                            ? "bg-primary text-primary-foreground shadow-xs ring-2 ring-primary/20"
                            : d.isSelected
                            ? "bg-accent text-accent-foreground ring-1 ring-border"
                            : d.isCurrentMonth
                            ? "text-foreground font-semibold"
                            : "text-muted-foreground/50 font-normal"
                        )}
                      >
                        {dayNumber}
                      </span>
                      {d.isToday && (
                        <span className="hidden xl:inline text-[10px] font-bold text-primary uppercase tracking-wider">
                          Today
                        </span>
                      )}
                    </div>

                    {/* Compact Occupancy Info for this Day */}
                    {rooms.length > 0 && d.isCurrentMonth && (
                      <div
                        className="flex items-center gap-1 text-[10px] font-medium"
                        title={`${d.occupiedCount} Occupied • ${d.reservedCount} Reserved • ${d.availableCount} Available (${d.occupancyRate}% Occ)`}
                      >
                        {d.occupiedCount > 0 && (
                          <span className="inline-flex items-center px-1 py-0.2 rounded-xs bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold">
                            {d.occupiedCount}O
                          </span>
                        )}
                        {d.reservedCount > 0 && (
                          <span className="inline-flex items-center px-1 py-0.2 rounded-xs bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold">
                            {d.reservedCount}R
                          </span>
                        )}
                        <span className="text-[10px] font-mono text-muted-foreground/80 hidden sm:inline">
                          {d.availableCount} free
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Micro Occupancy Bar */}
                  {rooms.length > 0 && d.isCurrentMonth && (
                    <div className="w-full h-1 bg-muted rounded-full overflow-hidden flex mb-2">
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
                      {d.maintenanceCount > 0 && (
                        <div
                          className="bg-purple-600 dark:bg-purple-500 h-full"
                          style={{
                            width: `${(d.maintenanceCount / rooms.length) * 100}%`,
                          }}
                        />
                      )}
                    </div>
                  )}

                  {/* Events List (Bookings & Maintenance) */}
                  <div className="space-y-1 flex-1 overflow-hidden">
                    {/* Maintenance Items */}
                    {d.dayMaintenance.slice(0, 1).map((m) => {
                      const room = roomMap.get(m.roomId);
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
                              onSelectMaintenance(m, room);
                            }}
                            style={{
                              backgroundColor: "var(--maintenance-bg, #f3e8ff)",
                              backgroundImage:
                                "repeating-linear-gradient(-45deg, var(--maintenance-stripe, rgba(147, 51, 234, 0.22)), var(--maintenance-stripe, rgba(147, 51, 234, 0.22)) 6px, transparent 6px, transparent 12px)",
                            }}
                            className="px-1.5 py-0.5 rounded-md bg-maintenance-striped hover:opacity-95 text-purple-950 dark:text-purple-100 border border-purple-400 dark:border-purple-500 text-[10px] font-bold truncate flex items-center gap-1 shadow-xs transition-transform hover:scale-[1.01]"
                          >
                            <MaintenanceIcon className="size-2.5 shrink-0 text-purple-800 dark:text-purple-300" />
                            <span className="truncate text-purple-950 dark:text-purple-100">
                              {room ? `R${room.number}` : "Room"}:{" "}
                              {m.reason ? `Maintenance • ${m.reason}` : "Maintenance"}
                            </span>
                          </div>
                        </MaintenanceHoverCard>
                      );
                    })}

                    {/* Booking Items */}
                    {d.dayBookings.slice(0, 2).map((b) => {
                      const room = roomMap.get(b.roomId);
                      const isCheckedIn = b.status === "CHECKED_IN";
                      const isReserved = b.status === "RESERVED";

                      const badgeStyle = isCheckedIn
                        ? "bg-blue-600 hover:bg-blue-700 text-white"
                        : isReserved
                        ? "bg-amber-500 hover:bg-amber-600 text-white"
                        : "bg-slate-400 dark:bg-slate-600 text-white";

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
                              onSelectBooking(b, room);
                            }}
                            className={cn(
                              "px-1.5 py-0.5 rounded-md text-[10px] font-medium truncate flex items-center justify-between gap-1 shadow-xs transition-transform hover:scale-[1.01]",
                              badgeStyle
                            )}
                          >
                            <div className="flex items-center gap-1 min-w-0">
                              {room?.hasOpenProblem && (
                                <CircleAlertIcon className="size-2.5 shrink-0 text-red-200 animate-pulse" />
                              )}
                              <span className="font-bold shrink-0">
                                {room?.number ? `R${room.number}` : ""}
                              </span>
                              <span className="truncate opacity-95">
                                {b.primaryGuestName}
                              </span>
                            </div>

                            {b.balanceDue > 0 && isCheckedIn && (
                              <span className="text-[8px] bg-red-700 text-white px-1 py-0 rounded-xs font-mono font-bold shrink-0">
                                Due
                              </span>
                            )}
                          </div>
                        </BookingHoverCard>
                      );
                    })}

                    {/* More events indicator */}
                    {d.dayBookings.length + d.dayMaintenance.length > 2 && (
                      <div className="text-[10px] font-semibold text-muted-foreground hover:text-foreground transition-colors flex items-center gap-0.5 pt-0.5">
                        <span>
                          +{d.dayBookings.length + d.dayMaintenance.length - 2} more
                        </span>
                        <ChevronRightIcon className="size-2.5 opacity-60" />
                      </div>
                    )}
                  </div>

                  {/* Bottom Day Action Hint on Hover */}
                  <div className="pt-1 mt-auto flex items-center justify-between text-[10px] text-muted-foreground/60 group-hover/cell:text-primary transition-colors">
                    <span className="opacity-0 group-hover/cell:opacity-100 transition-opacity font-medium flex items-center gap-0.5">
                      View Day <ChevronRightIcon className="size-2.5" />
                    </span>
                    {d.occupancyRate > 0 && d.isCurrentMonth && (
                      <span className="font-mono text-[9px] font-semibold text-muted-foreground/70">
                        {d.occupancyRate}%
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
