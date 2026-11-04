"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  RoomIcon,
  ChevronRightIcon,
  ProblemIcon,
  GuestIcon,
  ClockIcon,
} from "@/lib/icons";
import { formatISTDate } from "@/lib/datetime";
import { cn } from "@/lib/utils";
import type { RoomWithStatus } from "@/server/services/room.service";
import { RoomQuickDetailsDialog } from "@/features/rooms/components/room-quick-details-dialog";

interface RoomBoardProps {
  rooms: RoomWithStatus[];
  className?: string;
}

type StatusFilter = "ALL" | "AVAILABLE" | "OCCUPIED" | "RESERVED" | "MAINTENANCE";

export function RoomBoard({ rooms, className }: RoomBoardProps) {
  const [filter, setFilter] = useState<StatusFilter>("ALL");
  const [selectedRoom, setSelectedRoom] = useState<RoomWithStatus | null>(null);

  const totalCount = rooms.length;
  const availableCount = rooms.filter((r) => r.status === "AVAILABLE").length;
  const occupiedCount = rooms.filter((r) => r.status === "OCCUPIED").length;
  const reservedCount = rooms.filter((r) => r.status === "RESERVED").length;
  const maintenanceCount = rooms.filter((r) => r.status === "MAINTENANCE").length;

  const filteredRooms = rooms.filter((r) => {
    if (filter === "ALL") return true;
    if (filter === "AVAILABLE") return r.status === "AVAILABLE";
    if (filter === "OCCUPIED") return r.status === "OCCUPIED";
    if (filter === "RESERVED") return r.status === "RESERVED";
    if (filter === "MAINTENANCE") return r.status === "MAINTENANCE";
    return true;
  });

  return (
    <>
      <Card className={cn("flex flex-col shadow-xs border-border/80 overflow-hidden", className)}>
        {/* Room Board Header – Reduced Padding */}
        <CardHeader className="p-2.5 sm:px-3 pb-2 shrink-0 border-b border-border/60 gap-1.5">
          <div className="flex items-center justify-between gap-2">
            {/* Title & Icon */}
            <div className="flex items-center gap-2">
              <RoomIcon className="size-4 text-primary shrink-0" aria-hidden="true" />
              <CardTitle className="text-base font-semibold text-foreground tracking-tight">
                Room Board
              </CardTitle>
            </div>

            {/* Action Button: All Rooms (Navigates to Rooms page) */}
            <Link href="/rooms" className="shrink-0">
              <Button
                variant="outline"
                size="sm"
                className="text-xs h-6.5 px-2 font-medium gap-1 text-muted-foreground hover:text-foreground hover:bg-muted"
              >
                <span>All Rooms</span>
                <ChevronRightIcon className="size-3" aria-hidden="true" />
              </Button>
            </Link>
          </div>

          {/* Compact Horizontal Status Summary Pills in order: All Rooms, Available, Occupied, Reserved, Maintenance */}
          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
            {/* 1. All Rooms */}
            <button
              type="button"
              onClick={() => setFilter("ALL")}
              className={cn(
                "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium transition-colors cursor-pointer",
                filter === "ALL"
                  ? "bg-primary text-primary-foreground shadow-2xs"
                  : "bg-muted/70 text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <span>All Rooms</span>
              <span
                className={cn(
                  "px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold",
                  filter === "ALL" ? "bg-white/20 text-white" : "bg-background text-foreground"
                )}
              >
                {totalCount}
              </span>
            </button>

            {/* 2. Available */}
            <button
              type="button"
              onClick={() => setFilter("AVAILABLE")}
              className={cn(
                "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium transition-colors cursor-pointer",
                filter === "AVAILABLE"
                  ? "bg-emerald-600 text-white shadow-2xs"
                  : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20"
              )}
            >
              <span className="size-1.5 rounded-full bg-emerald-600 dark:bg-emerald-400" />
              <span>Available</span>
              <span
                className={cn(
                  "px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold",
                  filter === "AVAILABLE" ? "bg-white/20 text-white" : "bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-200"
                )}
              >
                {availableCount}
              </span>
            </button>

            {/* 3. Occupied */}
            <button
              type="button"
              onClick={() => setFilter("OCCUPIED")}
              className={cn(
                "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium transition-colors cursor-pointer",
                filter === "OCCUPIED"
                  ? "bg-blue-600 text-white shadow-2xs"
                  : "bg-blue-500/10 text-blue-700 dark:text-blue-300 hover:bg-blue-500/20"
              )}
            >
              <span className="size-1.5 rounded-full bg-blue-600 dark:bg-blue-400" />
              <span>Occupied</span>
              <span
                className={cn(
                  "px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold",
                  filter === "OCCUPIED" ? "bg-white/20 text-white" : "bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200"
                )}
              >
                {occupiedCount}
              </span>
            </button>

            {/* 4. Reserved */}
            <button
              type="button"
              onClick={() => setFilter("RESERVED")}
              className={cn(
                "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium transition-colors cursor-pointer",
                filter === "RESERVED"
                  ? "bg-amber-600 text-white shadow-2xs"
                  : "bg-amber-500/10 text-amber-700 dark:text-amber-300 hover:bg-amber-500/20"
              )}
            >
              <span className="size-1.5 rounded-full bg-amber-600 dark:bg-amber-400" />
              <span>Reserved</span>
              <span
                className={cn(
                  "px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold",
                  filter === "RESERVED" ? "bg-white/20 text-white" : "bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-200"
                )}
              >
                {reservedCount}
              </span>
            </button>

            {/* 5. Maintenance (Theme-matched Purple) */}
            <button
              type="button"
              onClick={() => setFilter("MAINTENANCE")}
              className={cn(
                "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium transition-colors cursor-pointer",
                filter === "MAINTENANCE"
                  ? "bg-purple-700 text-white shadow-2xs"
                  : "bg-purple-500/10 text-purple-700 dark:text-purple-300 hover:bg-purple-500/20"
              )}
            >
              <span className="size-1.5 rounded-full bg-purple-600 dark:bg-purple-400" />
              <span>Maintenance</span>
              <span
                className={cn(
                  "px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold",
                  filter === "MAINTENANCE" ? "bg-white/20 text-white" : "bg-purple-100 dark:bg-purple-900/50 text-purple-800 dark:text-purple-200"
                )}
              >
                {maintenanceCount}
              </span>
            </button>
          </div>
        </CardHeader>

        {/* Room Cards Grid (Scrollable, Reduced Padding) */}
        <CardContent className="p-2.5 sm:p-3 flex-1 min-h-0 overflow-y-auto">
          {filteredRooms.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted-foreground flex flex-col items-center justify-center h-full min-h-[200px]">
              No rooms found matching the selected filter.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2 sm:gap-2.5">
              {filteredRooms.map((room) => (
                <RoomBoardCard
                  key={room.id}
                  room={room}
                  onSelect={setSelectedRoom}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Room Details Modal (Quick Summary Dialog) */}
      <RoomQuickDetailsDialog
        room={selectedRoom}
        open={Boolean(selectedRoom)}
        onOpenChange={(open) => {
          if (!open) setSelectedRoom(null);
        }}
      />
    </>
  );
}

/**
 * Dedicated Room Board Card component.
 * Compact status board tile with full-background color styling matching operational status.
 * Maintenance theme matches the website predefined purple palette.
 * Unresolved issue shown as "Issue" badge at the top.
 * Clicking opens the Quick Summary Modal.
 */
function RoomBoardCard({
  room,
  onSelect,
}: {
  room: RoomWithStatus;
  onSelect: (room: RoomWithStatus) => void;
}) {
  const isOccupied = room.status === "OCCUPIED";
  const isAvailable = room.status === "AVAILABLE";
  const isMaintenance = room.status === "MAINTENANCE";
  const isReserved = room.status === "RESERVED";

  // Card theme styling tokens based on operational status
  const cardStyle = !room.isActive
    ? "bg-stone-100/90 dark:bg-stone-900/40 border-stone-300 dark:border-stone-800 text-stone-700 dark:text-stone-300 opacity-75"
    : isOccupied
    ? "bg-blue-50/95 dark:bg-blue-950/40 border-blue-200/90 dark:border-blue-800/60 text-blue-950 dark:text-blue-100 hover:border-blue-300 dark:hover:border-blue-700"
    : isAvailable
    ? "bg-emerald-50/95 dark:bg-emerald-950/40 border-emerald-200/90 dark:border-emerald-800/60 text-emerald-950 dark:text-emerald-100 hover:border-emerald-300 dark:hover:border-emerald-700"
    : isMaintenance
    ? "bg-purple-50/95 dark:bg-purple-950/40 border-purple-200/90 dark:border-purple-800/60 text-purple-950 dark:text-purple-100 bg-[repeating-linear-gradient(45deg,transparent,transparent_8px,rgba(168,85,247,0.08)_8px,rgba(168,85,247,0.08)_16px)] hover:border-purple-300 dark:hover:border-purple-700"
    : isReserved
    ? "bg-amber-50/95 dark:bg-amber-950/40 border-amber-200/90 dark:border-amber-800/60 text-amber-950 dark:text-amber-100 hover:border-amber-300 dark:hover:border-amber-700"
    : "bg-card border-border text-foreground";

  // Badge styling
  const badgeStyle = !room.isActive
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

  const statusLabel = !room.isActive
    ? "Disabled"
    : isOccupied
    ? "Occupied"
    : isAvailable
    ? "Available"
    : isMaintenance
    ? "Maintenance"
    : isReserved
    ? "Reserved"
    : room.status;

  const checkoutTime = room.currentBooking?.checkOutAt
    ? formatISTDate(room.currentBooking.checkOutAt)
    : null;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect(room)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(room);
        }
      }}
      className={cn(
        "rounded-lg border p-2.5 flex flex-col justify-between transition-all duration-150 hover:shadow-xs group cursor-pointer select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        cardStyle
      )}
    >
      <div>
        {/* Top Header: Room Number (Left) & Badges (Right: Issue badge + Status Badge) */}
        <div className="flex items-center justify-between gap-1.5">
          <span className="text-base sm:text-lg font-bold font-mono tracking-tight">
            {room.number}
          </span>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* Unresolved Problem: "Issue" badge at top */}
            {room.hasProblem && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase bg-rose-600 text-white dark:bg-rose-500 shadow-2xs">
                <ProblemIcon className="size-2.5 shrink-0" aria-hidden="true" />
                <span>Issue</span>
              </span>
            )}

            {/* Status Badge */}
            <span
              className={cn(
                "px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wide uppercase shrink-0 shadow-2xs",
                badgeStyle
              )}
            >
              {statusLabel}
            </span>
          </div>
        </div>

        {/* Room Type & Nightly Tariff */}
        <div className="flex items-center justify-between gap-1 text-[11px] opacity-80 mt-0.5 pb-1.5 border-b border-current/15">
          <span className="truncate font-medium">{room.typeName}</span>
          <span className="shrink-0 font-mono font-semibold">
            ₹{room.pricePerNight.toLocaleString("en-IN")}/nt
          </span>
        </div>

        {/* Middle Context Section */}
        <div className="pt-1.5 text-xs space-y-1">
          {isOccupied && (
            <>
              <div className="flex items-center gap-1 font-semibold truncate">
                <GuestIcon className="size-3 shrink-0 opacity-70" aria-hidden="true" />
                <span className="truncate">
                  {room.currentBooking?.guestName || "Guest"}
                </span>
              </div>
              {checkoutTime && (
                <div className="flex items-center gap-1 text-[11px] opacity-75">
                  <ClockIcon className="size-3 shrink-0" aria-hidden="true" />
                  <span>Out: {checkoutTime}</span>
                </div>
              )}
            </>
          )}

          {isAvailable && (
            <>
              {room.nextBooking ? (
                <>
                  <div className="flex items-center gap-1 font-medium truncate">
                    <span className="text-[10px] uppercase font-bold opacity-70">Next:</span>
                    <span className="truncate font-semibold">{room.nextBooking.guestName}</span>
                  </div>
                  <div className="text-[11px] opacity-75">
                    Arr: {formatISTDate(room.nextBooking.checkInAt)}
                  </div>
                </>
              ) : (
                <div className="text-[11px] font-medium opacity-80 py-0.5">
                  Vacant • Ready for check-in
                </div>
              )}
            </>
          )}

          {isMaintenance && (
            <>
              <div className="font-medium truncate text-[11px]">
                {room.maintenanceReason || "Scheduled Maintenance"}
              </div>
              {room.activeMaintenance?.endsAt && (
                <div className="text-[10px] opacity-75">
                  Until: {formatISTDate(room.activeMaintenance.endsAt)}
                </div>
              )}
            </>
          )}

          {isReserved && (
            <>
              <div className="flex items-center gap-1 font-semibold truncate">
                <GuestIcon className="size-3 shrink-0 opacity-70" aria-hidden="true" />
                <span className="truncate">
                  {room.currentBooking?.guestName || "Guest"}
                </span>
              </div>
              {room.currentBooking?.checkInAt && (
                <div className="text-[11px] opacity-75">
                  Arrival: {formatISTDate(room.currentBooking.checkInAt)}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
