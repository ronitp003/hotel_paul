"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatINR } from "@/lib/money";
import { formatISTDateTime, formatIST } from "@/lib/datetime";
import {
  GuestIcon,
  ProblemIcon,
  MaintenanceIcon,
  EditIcon,
  ChevronRightIcon,
  RoomIcon,
  CheckIcon,
  CalendarIcon,
} from "@/lib/icons";
import { cn } from "@/lib/utils";
import type { RoomWithStatus } from "@/server/services/room.service";
import type { Role } from "@/lib/constants";
import { LogProblemDialog } from "./log-problem-dialog";
import { CreateMaintenanceDialog } from "./create-maintenance-dialog";

interface RoomCardProps {
  room: RoomWithStatus;
  userRole?: Role;
  onEdit?: (room: RoomWithStatus) => void;
}

export function RoomCard({
  room,
  userRole = "RECEPTIONIST",
  onEdit,
}: RoomCardProps) {
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isProblemOpen, setIsProblemOpen] = useState(false);
  const [isMaintenanceOpen, setIsMaintenanceOpen] = useState(false);

  const isOwner = userRole === "OWNER";

  // Status card styling and tokens
  const style = !room.isActive
    ? {
      cardClass:
        "bg-stone-100/90 dark:bg-stone-900/40 border-stone-200 dark:border-stone-800 hover:border-stone-300 dark:hover:border-stone-700 hover:shadow-xs opacity-80",
      roomNumberClass: "text-stone-700 dark:text-stone-300",
      typeNameClass: "text-stone-500 dark:text-stone-400",
      priceClass: "text-stone-700 dark:text-stone-300",
      priceSuffixClass: "text-stone-500 dark:text-stone-400",
      statusBadgeClass:
        "bg-stone-500 text-white border-stone-500 shadow-2xs",
      statusDotClass: "bg-white",
      contextBoxClass:
        "bg-stone-200/60 dark:bg-stone-800/40 border-stone-300/60 dark:border-stone-700/50 text-stone-700 dark:text-stone-300",
      dividerClass: "border-stone-200 dark:border-stone-800",
      actionBtnClass:
        "text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 hover:bg-stone-200/60 dark:hover:bg-stone-800/60",
      label: "Disabled",
    }
    : room.status === "OCCUPIED"
      ? {
        cardClass:
          "bg-blue-50/90 dark:bg-blue-950/35 border-blue-200/90 dark:border-blue-800/60 hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-xs",
        roomNumberClass: "text-blue-950 dark:text-blue-100",
        typeNameClass: "text-blue-800/80 dark:text-blue-300/80",
        priceClass: "text-blue-950 dark:text-blue-100",
        priceSuffixClass: "text-blue-700/70 dark:text-blue-400/70",
        statusBadgeClass:
          "bg-blue-600 text-white dark:bg-blue-500 dark:text-blue-950 border-blue-600 dark:border-blue-500 shadow-2xs",
        statusDotClass: "bg-white dark:bg-blue-950",
        contextBoxClass:
          "bg-blue-100/70 dark:bg-blue-900/30 border-blue-200/80 dark:border-blue-800/50 text-blue-900 dark:text-blue-200",
        dividerClass: "border-blue-200/80 dark:border-blue-800/60",
        actionBtnClass:
          "text-blue-800 dark:text-blue-300 hover:text-blue-950 dark:hover:text-blue-100 hover:bg-blue-200/60 dark:hover:bg-blue-900/50",
        label: "Occupied",
      }
      : room.status === "RESERVED"
        ? {
          cardClass:
            "bg-amber-50/90 dark:bg-amber-950/35 border-amber-200/90 dark:border-amber-800/60 hover:border-amber-300 dark:hover:border-amber-700 hover:shadow-xs",
          roomNumberClass: "text-amber-950 dark:text-amber-100",
          typeNameClass: "text-amber-800/80 dark:text-amber-300/80",
          priceClass: "text-amber-950 dark:text-amber-100",
          priceSuffixClass: "text-amber-700/70 dark:text-amber-400/70",
          statusBadgeClass:
            "bg-amber-600 text-white dark:bg-amber-500 dark:text-amber-950 border-amber-600 dark:border-amber-500 shadow-2xs",
          statusDotClass: "bg-white dark:bg-amber-950",
          contextBoxClass:
            "bg-amber-100/70 dark:bg-amber-900/30 border-amber-200/80 dark:border-amber-800/50 text-amber-900 dark:text-amber-200",
          dividerClass: "border-amber-200/80 dark:border-amber-800/60",
          actionBtnClass:
            "text-amber-800 dark:text-amber-300 hover:text-amber-950 dark:hover:text-amber-100 hover:bg-amber-200/60 dark:hover:bg-amber-900/50",
          label: "Reserved",
        }
        : room.status === "MAINTENANCE"
          ? {
            cardClass:
              "bg-maintenance-striped border-purple-300/90 dark:border-purple-800/60 hover:border-purple-400 dark:hover:border-purple-700 hover:shadow-xs",
            roomNumberClass: "text-purple-950 dark:text-purple-100",
            typeNameClass: "text-purple-800/90 dark:text-purple-200",
            priceClass: "text-purple-950 dark:text-purple-100",
            priceSuffixClass: "text-purple-700/70 dark:text-purple-300/80",
            statusBadgeClass:
              "bg-purple-700 text-white dark:bg-purple-600 dark:text-white border-purple-700 dark:border-purple-600 shadow-2xs",
            statusDotClass: "bg-white",
            contextBoxClass:
              "bg-white/85 dark:bg-purple-950/70 backdrop-blur-xs border-purple-300/80 dark:border-purple-700/50 text-purple-950 dark:text-purple-200",
            dividerClass: "border-purple-300/80 dark:border-purple-800/60",
            actionBtnClass:
              "text-purple-900 dark:text-purple-200 hover:text-purple-950 dark:hover:text-purple-100 hover:bg-purple-200/60 dark:hover:bg-purple-900/60",
            label: "Maintenance",
          }
          : {
            cardClass:
              "bg-emerald-50/90 dark:bg-emerald-950/35 border-emerald-200/90 dark:border-emerald-800/60 hover:border-emerald-300 dark:hover:border-emerald-700 hover:shadow-xs",
            roomNumberClass: "text-emerald-950 dark:text-emerald-100",
            typeNameClass: "text-emerald-800/80 dark:text-emerald-300/80",
            priceClass: "text-emerald-950 dark:text-emerald-100",
            priceSuffixClass: "text-emerald-700/70 dark:text-emerald-400/70",
            statusBadgeClass:
              "bg-emerald-600 text-white dark:bg-emerald-500 dark:text-emerald-950 border-emerald-600 dark:border-emerald-500 shadow-2xs",
            statusDotClass: "bg-white dark:bg-emerald-950",
            contextBoxClass:
              "bg-emerald-100/70 dark:bg-emerald-900/30 border-emerald-200/80 dark:border-emerald-800/50 text-emerald-900 dark:text-emerald-200",
            dividerClass: "border-emerald-200/80 dark:border-emerald-800/60",
            actionBtnClass:
              "text-emerald-800 dark:text-emerald-300 hover:text-emerald-950 dark:hover:text-emerald-100 hover:bg-emerald-200/60 dark:hover:bg-emerald-900/50",
            label: "Available",
          };

  return (
    <>
      <Card
        tabIndex={0}
        onClick={() => {
          setIsDetailsOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setIsDetailsOpen(true);
          }
        }}
        className={cn(
          "relative overflow-hidden transition-all duration-150 ease-out cursor-pointer flex flex-col justify-between select-none group border rounded-xl py-0 gap-0 h-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none",
          style.cardClass
        )}
      >
        <CardContent className="p-3.5 sm:p-4 flex flex-col justify-between h-full">
          <div>
            {/* Top Row: Room Number & Status / Issue Badges */}
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <span
                  className={cn(
                    "text-2xl sm:text-3xl font-bold font-mono tracking-tight leading-none truncate block",
                    style.roomNumberClass
                  )}
                  title={`Room ${room.number}`}
                >
                  {room.number}
                </span>
                <p
                  className={cn(
                    "text-xs mt-1 truncate font-semibold",
                    style.typeNameClass
                  )}
                  title={room.typeName}
                >
                  {room.typeName}
                </p>
              </div>

              <div className="shrink-0 flex items-center gap-1.5 flex-wrap justify-end">
                {room.hasProblem && (
                  <span
                    title={`${room.openProblemsCount} unresolved problem(s)`}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-600 text-white shadow-2xs shrink-0"
                  >
                    <ProblemIcon
                      className="size-2.5 shrink-0"
                      aria-hidden="true"
                    />
                    <span>
                      {room.openProblemsCount > 1
                        ? `${room.openProblemsCount} Issues`
                        : "Issue"}
                    </span>
                  </span>
                )}
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border leading-tight shrink-0 shadow-2xs",
                    style.statusBadgeClass
                  )}
                >
                  <span
                    className={cn(
                      "size-1.5 rounded-full shrink-0",
                      style.statusDotClass
                    )}
                    aria-hidden="true"
                  />
                  <span>{style.label}</span>
                </span>
              </div>
            </div>

            {/* Pricing Row: Price / night */}
            <div className="flex items-baseline gap-1 mt-3">
              <span
                className={cn(
                  "text-xl sm:text-2xl font-bold font-mono tracking-tight tabular-nums",
                  style.priceClass
                )}
              >
                {formatINR(room.pricePerNight)}
              </span>
              <span
                className={cn(
                  "text-xs font-medium",
                  style.priceSuffixClass
                )}
              >
                / night
              </span>
            </div>

            {/* Contextual Status Information Block */}
            <div className="mt-3">
              {room.status === "OCCUPIED" ? (
                <div
                  className={cn(
                    "rounded-lg p-2.5 text-xs border space-y-1 min-h-[58px] flex flex-col justify-center",
                    style.contextBoxClass
                  )}
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <GuestIcon
                      className="size-3.5 shrink-0 opacity-80"
                      aria-hidden="true"
                    />
                    <span className="truncate font-semibold text-xs">
                      {room.currentBooking
                        ? room.currentBooking.guestName
                        : "Guest in room"}
                    </span>
                  </div>
                  {room.currentBooking && (
                    <div className="flex items-center justify-between text-[11px] opacity-85">
                      <span>
                        Checkout:{" "}
                        {formatIST(
                          new Date(room.currentBooking.checkOutAt),
                          "d MMM"
                        )}
                      </span>
                      <span className="font-mono text-[10px] font-semibold">
                        {room.currentBooking.reference}
                      </span>
                    </div>
                  )}
                  {room.hasProblem && (
                    <div className="pt-1 mt-1 border-t border-rose-300/50 dark:border-rose-700/50 flex items-center gap-1 text-[11px] text-rose-700 dark:text-rose-300 font-semibold truncate">
                      <ProblemIcon className="size-3 shrink-0" />
                      <span className="truncate">
                        {room.openProblems?.[0]?.description || "Issue reported"}
                      </span>
                    </div>
                  )}
                </div>
              ) : room.status === "RESERVED" ? (
                <div
                  className={cn(
                    "rounded-lg p-2.5 text-xs border space-y-1 min-h-[58px] flex flex-col justify-center",
                    style.contextBoxClass
                  )}
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <CalendarIcon
                      className="size-3.5 shrink-0 opacity-80"
                      aria-hidden="true"
                    />
                    <span className="truncate font-semibold text-xs">
                      {room.currentBooking
                        ? room.currentBooking.guestName
                        : "Reserved"}
                    </span>
                  </div>
                  {room.currentBooking && (
                    <div className="flex items-center justify-between text-[11px] opacity-85">
                      <span>
                        Arrival:{" "}
                        {formatIST(
                          new Date(room.currentBooking.checkInAt),
                          "d MMM"
                        )}
                      </span>
                      <span className="font-mono text-[10px] font-semibold">
                        {room.currentBooking.reference}
                      </span>
                    </div>
                  )}
                  {room.hasProblem && (
                    <div className="pt-1 mt-1 border-t border-rose-300/50 dark:border-rose-700/50 flex items-center gap-1 text-[11px] text-rose-700 dark:text-rose-300 font-semibold truncate">
                      <ProblemIcon className="size-3 shrink-0" />
                      <span className="truncate">
                        {room.openProblems?.[0]?.description || "Issue reported"}
                      </span>
                    </div>
                  )}
                </div>
              ) : room.status === "MAINTENANCE" ? (
                <div
                  className={cn(
                    "rounded-lg p-2.5 text-xs border space-y-1 min-h-[58px] flex flex-col justify-center",
                    style.contextBoxClass
                  )}
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <MaintenanceIcon
                      className="size-3.5 shrink-0 opacity-80"
                      aria-hidden="true"
                    />
                    <span
                      className="truncate font-semibold text-xs"
                      title={room.maintenanceReason || "Under maintenance"}
                    >
                      {room.maintenanceReason || "Under maintenance"}
                    </span>
                  </div>
                  <div className="text-[11px] opacity-85">
                    {room.activeMaintenance?.endsAt
                      ? `Until: ${formatIST(
                        new Date(room.activeMaintenance.endsAt),
                        "d MMM, hh:mm a"
                      )}`
                      : "Work in progress"}
                  </div>
                  {room.hasProblem && (
                    <div className="pt-1 mt-1 border-t border-rose-300/50 dark:border-rose-700/50 flex items-center gap-1 text-[11px] text-rose-700 dark:text-rose-300 font-semibold truncate">
                      <ProblemIcon className="size-3 shrink-0" />
                      <span className="truncate">
                        {room.openProblems?.[0]?.description || "Issue reported"}
                      </span>
                    </div>
                  )}
                </div>
              ) : !room.isActive ? (
                <div
                  className={cn(
                    "rounded-lg p-2.5 text-xs border space-y-1 min-h-[58px] flex flex-col justify-center",
                    style.contextBoxClass
                  )}
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <RoomIcon
                      className="size-3.5 shrink-0 opacity-80"
                      aria-hidden="true"
                    />
                    <span className="truncate font-semibold text-xs">
                      Inactive in system
                    </span>
                  </div>
                  <div className="text-[11px] opacity-75">
                    Archived from booking
                  </div>
                </div>
              ) : room.hasProblem ? (
                <div className="rounded-lg p-2.5 text-xs border bg-rose-500/15 dark:bg-rose-500/20 border-rose-500/30 text-rose-950 dark:text-rose-100 space-y-1 min-h-[58px] flex flex-col justify-center">
                  <div className="flex items-center gap-1.5 text-rose-700 dark:text-rose-300 font-bold text-[11px] uppercase tracking-wide">
                    <ProblemIcon
                      className="size-3.5 shrink-0"
                      aria-hidden="true"
                    />
                    <span>Inspection Needed</span>
                  </div>
                  <p
                    className="truncate font-semibold text-xs text-rose-900 dark:text-rose-200"
                    title={
                      room.openProblems?.[0]?.description || "Unresolved issue"
                    }
                  >
                    {room.openProblems?.[0]?.description ||
                      "Room requires inspection"}
                  </p>
                </div>
              ) : room.upcomingMaintenance &&
                room.upcomingMaintenance.length > 0 ? (
                <div
                  className={cn(
                    "rounded-lg p-2.5 text-xs border space-y-1 min-h-[58px] flex flex-col justify-center",
                    style.contextBoxClass
                  )}
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <MaintenanceIcon
                      className="size-3.5 shrink-0 opacity-80"
                      aria-hidden="true"
                    />
                    <span
                      className="truncate font-semibold text-xs"
                      title={room.upcomingMaintenance[0].reason}
                    >
                      Scheduled Maint
                    </span>
                  </div>
                  <div className="text-[11px] opacity-85">
                    Starts:{" "}
                    {formatIST(
                      new Date(room.upcomingMaintenance[0].startsAt),
                      "d MMM"
                    )}
                  </div>
                </div>
              ) : (
                <div
                  className={cn(
                    "rounded-lg p-2.5 text-xs border space-y-1 min-h-[58px] flex flex-col justify-center",
                    style.contextBoxClass
                  )}
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <CheckIcon
                      className="size-3.5 shrink-0 opacity-80"
                      aria-hidden="true"
                    />
                    <span className="truncate font-semibold text-xs">
                      Ready for check-in
                    </span>
                  </div>
                  <div className="text-[11px] opacity-85">Clean & inspected</div>
                </div>
              )}
            </div>
          </div>

          {/* Bottom Section: Subtle Divider & Minimal Actions */}
          <div
            className={cn(
              "mt-3.5 pt-2 border-t flex items-center text-xs",
              style.dividerClass,
              isOwner && onEdit ? "justify-between" : "justify-end"
            )}
            onClick={(e) => e.stopPropagation()}
          >
            {isOwner && onEdit && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onEdit(room)}
                className={cn(
                  "h-7 px-2 text-xs font-semibold rounded-md transition-colors gap-1 -ml-1 cursor-pointer",
                  style.actionBtnClass
                )}
              >
                <EditIcon className="size-3" aria-hidden="true" />
                <span>Edit</span>
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setIsDetailsOpen(true)}
              className={cn(
                "h-7 px-2 text-xs font-semibold rounded-md transition-colors gap-1 -mr-1 cursor-pointer",
                style.actionBtnClass
              )}
            >
              <span>View Details</span>
              <ChevronRightIcon
                className="size-3 opacity-80"
                aria-hidden="true"
              />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Quick Summary Dialog */}
      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <RoomIcon className="size-5" aria-hidden="true" />
              </div>
              <div className="space-y-0.5">
                <DialogTitle className="text-xl">
                  Room {room.number}
                </DialogTitle>
                <DialogDescription>
                  {room.typeName} • {formatINR(room.pricePerNight)} / night
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4 py-1">
            {/* 2-Column Key Metrics Card */}
            <div className="grid grid-cols-2 gap-3 p-3.5 rounded-xl bg-muted/30 border border-border">
              <div className="space-y-1">
                <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                  Current Status
                </span>
                <div>
                  <StatusBadge status={room.status} />
                </div>
              </div>
              <div className="space-y-1">
                <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                  Nightly Rate
                </span>
                <div className="text-sm font-bold text-foreground font-mono">
                  {formatINR(room.pricePerNight)}
                </div>
              </div>
              <div className="space-y-1">
                <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                  Room Category
                </span>
                <div className="text-sm font-semibold text-foreground truncate">
                  {room.typeName}
                </div>
              </div>
              <div className="space-y-1">
                <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                  Inventory State
                </span>
                <div className="text-sm font-semibold text-foreground">
                  {room.isActive ? "Active (Bookable)" : "Disabled (Archived)"}
                </div>
              </div>
            </div>

            {/* Occupied or Reserved Guest Details */}
            {(room.status === "OCCUPIED" || room.status === "RESERVED") &&
              room.currentBooking && (
                <div
                  className={cn(
                    "rounded-xl p-4 space-y-3 border",
                    room.status === "OCCUPIED"
                      ? "bg-status-occupied/5 border-status-occupied/20"
                      : "bg-status-reserved/5 border-status-reserved/25"
                  )}
                >
                  <div
                    className={cn(
                      "flex items-center justify-between pb-2 border-b",
                      room.status === "OCCUPIED"
                        ? "border-status-occupied/15"
                        : "border-status-reserved/20"
                    )}
                  >
                    <span
                      className={cn(
                        "text-xs font-bold uppercase tracking-wider",
                        room.status === "OCCUPIED"
                          ? "text-status-occupied"
                          : "text-status-reserved"
                      )}
                    >
                      {room.status === "OCCUPIED"
                        ? "Active Stay"
                        : "Upcoming Reservation"}
                    </span>
                    <span
                      className={cn(
                        "font-mono text-xs px-2 py-0.5 rounded font-semibold",
                        room.status === "OCCUPIED"
                          ? "bg-status-occupied/15 text-status-occupied"
                          : "bg-status-reserved/15 text-status-reserved"
                      )}
                    >
                      {room.currentBooking.reference}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-muted-foreground block text-[11px]">
                        Primary Guest
                      </span>
                      <span className="font-semibold text-foreground text-sm">
                        {room.currentBooking.guestName}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-[11px]">
                        {room.status === "OCCUPIED"
                          ? "Checked In"
                          : "Expected Check-In"}
                      </span>
                      <span className="font-medium text-foreground">
                        {formatISTDateTime(
                          new Date(room.currentBooking.checkInAt)
                        )}
                      </span>
                    </div>
                    <div className="sm:col-span-2">
                      <span className="text-muted-foreground block text-[11px]">
                        Scheduled Check-Out
                      </span>
                      <span className="font-medium text-foreground">
                        {formatISTDateTime(
                          new Date(room.currentBooking.checkOutAt)
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              )}

            {/* Maintenance Reason */}
            {room.status === "MAINTENANCE" && (
              <div className="rounded-xl bg-status-maintenance/10 border border-status-maintenance/20 p-4 space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-status-maintenance">
                  <MaintenanceIcon
                    className="size-4 shrink-0"
                    aria-hidden="true"
                  />
                  <span>Maintenance Record</span>
                </div>
                <p className="text-xs text-foreground font-medium">
                  {room.maintenanceReason ||
                    "Routine maintenance and inspection in progress."}
                </p>
              </div>
            )}

            {/* Scheduled Upcoming Maintenance */}
            {room.upcomingMaintenance && room.upcomingMaintenance.length > 0 && (
              <div className="rounded-xl bg-status-maintenance/10 border border-status-maintenance/20 p-4 space-y-2">
                <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-status-maintenance">
                  <div className="flex items-center gap-1.5">
                    <MaintenanceIcon
                      className="size-4 shrink-0"
                      aria-hidden="true"
                    />
                    <span>
                      Scheduled Maintenance ({room.upcomingMaintenance.length})
                    </span>
                  </div>
                </div>

                <div className="space-y-2 pt-0.5">
                  {room.upcomingMaintenance.map((m) => (
                    <div
                      key={m.id}
                      className="rounded-lg bg-card/90 border border-status-maintenance/25 p-2.5 space-y-1 text-xs shadow-2xs"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-foreground text-xs">
                          {m.reason}
                        </span>
                        <span className="text-[10px] font-mono text-status-maintenance font-bold shrink-0">
                          {formatIST(new Date(m.startsAt), "dd MMM, hh:mm a")} – {formatIST(new Date(m.endsAt), "dd MMM, hh:mm a")}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Open Problems */}
            {room.hasProblem && (
              <div className="rounded-xl bg-status-problem/10 border border-status-problem/20 p-4 space-y-2.5">
                <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-status-problem">
                  <ProblemIcon className="size-4 shrink-0" aria-hidden="true" />
                  <span>{room.openProblemsCount} Unresolved Issue(s)</span>
                </div>

                {room.openProblems && room.openProblems.length > 0 ? (
                  <div className="space-y-2 pt-0.5">
                    {room.openProblems.map((prob) => (
                      <div
                        key={prob.id}
                        className="rounded-lg bg-card/90 border border-status-problem/25 p-2.5 space-y-1 text-xs shadow-2xs"
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
                    Room requires front-desk or housekeeping inspection before
                    assigning to a walk-in guest.
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
                    setIsDetailsOpen(false);
                    setIsProblemOpen(true);
                  }}
                  className="flex-1 gap-1.5 text-xs text-destructive border-destructive/30 hover:bg-destructive/10"
                >
                  <ProblemIcon className="size-3.5" />
                  <span>Report Problem</span>
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={
                    room.status === "OCCUPIED" ||
                    room.status === "RESERVED" ||
                    room.status === "MAINTENANCE"
                  }
                  onClick={() => {
                    if (
                      room.status === "OCCUPIED" ||
                      room.status === "RESERVED" ||
                      room.status === "MAINTENANCE"
                    )
                      return;
                    setIsDetailsOpen(false);
                    setIsMaintenanceOpen(true);
                  }}
                  title={
                    room.status === "MAINTENANCE"
                      ? "Room is already under maintenance."
                      : room.status === "OCCUPIED"
                        ? "Room is currently occupied. Maintenance cannot be scheduled until check-out."
                        : room.status === "RESERVED"
                          ? "Room has an active reservation. Maintenance cannot be scheduled."
                          : "Schedule room maintenance"
                  }
                  className={cn(
                    "flex-1 gap-1.5 text-xs border-status-maintenance/30",
                    room.status === "OCCUPIED" ||
                      room.status === "RESERVED" ||
                      room.status === "MAINTENANCE"
                      ? "opacity-50 cursor-not-allowed bg-muted text-muted-foreground border-border hover:bg-muted"
                      : "text-status-maintenance hover:bg-status-maintenance/10"
                  )}
                >
                  <MaintenanceIcon className="size-3.5" />
                  <span>Maintenance</span>
                </Button>
              </div>
            </div>
          </div>

          <DialogFooter className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-2.5">
            <Link
              href={`/rooms/${room.id}`}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              Room Details
              <ChevronRightIcon className="size-3.5 ml-1" />
            </Link>

            <div className="flex items-center gap-2">
              {(room.status === "OCCUPIED" || room.status === "RESERVED") &&
                room.currentBooking && (
                  <Link
                    href={`/bookings/${room.currentBooking.id}`}
                    className={buttonVariants({ variant: "default", size: "sm" })}
                  >
                    View Booking
                  </Link>
                )}
              {/* <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setIsDetailsOpen(false)}
              >
                Close
              </Button> */}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Log Problem Dialog */}
      <LogProblemDialog
        open={isProblemOpen}
        onOpenChange={setIsProblemOpen}
        room={{ id: room.id, number: room.number }}
      />

      {/* Create Maintenance Dialog */}
      <CreateMaintenanceDialog
        open={isMaintenanceOpen}
        onOpenChange={setIsMaintenanceOpen}
        room={{ id: room.id, number: room.number }}
      />
    </>
  );
}
