"use client";

import * as React from "react";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import {
  MaintenanceIcon,
  RoomIcon,
  CalendarIcon,
} from "@/lib/icons";
import { formatISTDateTime } from "@/lib/datetime";
import type {
  CalendarMaintenanceEvent,
  CalendarRoomItem,
} from "@/server/services/calendar.service";

interface MaintenanceHoverCardProps {
  maintenance: CalendarMaintenanceEvent;
  room?: CalendarRoomItem;
  children: React.ReactElement<React.HTMLAttributes<HTMLElement>>;
}

export function MaintenanceHoverCard({
  maintenance,
  room,
  children,
}: MaintenanceHoverCardProps) {
  return (
    <Tooltip>
      <TooltipTrigger delay={150} render={children} />
      <TooltipContent
        side="top"
        align="center"
        sideOffset={8}
        className="w-72 p-3 space-y-2.5 z-50 shadow-2xl bg-popover/95 backdrop-blur-md border border-border rounded-xl text-xs select-none"
      >
        <div className="flex items-center justify-between gap-2 border-b border-border/60 pb-2">
          <div className="flex items-center gap-1.5 font-bold text-foreground">
            <MaintenanceIcon className="size-4 text-purple-600 dark:text-purple-400" />
            <span>Room Maintenance</span>
          </div>
          <Badge
            variant="outline"
            className="text-[10px] font-semibold px-2 py-0.5 bg-purple-600 text-white border-transparent"
          >
            Scheduled
          </Badge>
        </div>

        <div className="flex items-center gap-2 bg-muted/40 rounded-lg p-2 border border-border/50">
          <RoomIcon className="size-4 text-muted-foreground shrink-0" />
          <span className="font-bold text-foreground">
            Room {room?.number || maintenance.roomId}
          </span>
          {room?.typeName && (
            <span className="text-muted-foreground text-[11px]">
              ({room.typeName})
            </span>
          )}
        </div>

        <div>
          <span className="text-[11px] text-muted-foreground">Reason:</span>
          <p className="font-medium text-foreground mt-0.5">
            {maintenance.reason || "General maintenance"}
          </p>
        </div>

        <div className="space-y-1 text-[11px] bg-muted/20 rounded-lg p-2 border border-border/40">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="flex items-center gap-1">
              <CalendarIcon className="size-3" /> Start:
            </span>
            <span className="font-medium text-foreground">
              {formatISTDateTime(maintenance.startsAt)}
            </span>
          </div>
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="flex items-center gap-1">
              <CalendarIcon className="size-3" /> End:
            </span>
            <span className="font-medium text-foreground">
              {formatISTDateTime(maintenance.endsAt)}
            </span>
          </div>
        </div>

        <div className="text-[10px] text-center text-muted-foreground/80 pt-0.5 font-medium">
          Click to view maintenance details
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
