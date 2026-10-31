"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatISTDateTime } from "@/lib/datetime";
import { MaintenanceIcon, CalendarIcon } from "@/lib/icons";
import type { CalendarMaintenanceEvent } from "@/server/services/calendar.service";

interface MaintenanceDetailDialogProps {
  maintenance: CalendarMaintenanceEvent | null;
  roomNumber?: string;
  isOpen: boolean;
  onClose: () => void;
}

export function MaintenanceDetailDialog({
  maintenance,
  roomNumber,
  isOpen,
  onClose,
}: MaintenanceDetailDialogProps) {
  if (!maintenance) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="space-y-1">
          <div className="flex items-center justify-between gap-2 pr-6">
            <span className="font-mono text-xs font-semibold text-muted-foreground tracking-wider">
              Room Maintenance
            </span>
            <Badge
              variant="secondary"
              className="text-[11px] font-semibold px-2 py-0.5 bg-purple-600 dark:bg-purple-700 text-white"
            >
              MAINTENANCE
            </Badge>
          </div>
          <DialogTitle className="text-lg font-bold flex items-center gap-2 text-foreground">
            <MaintenanceIcon className="size-5 text-purple-600 dark:text-purple-400 shrink-0" />
            <span>Room {roomNumber || "—"}</span>
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Room is scheduled or currently blocked for maintenance.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3.5 py-1 text-sm">
          {/* Reason */}
          <div className="p-3 rounded-lg border border-border bg-muted/40 space-y-1">
            <span className="text-xs font-semibold text-muted-foreground">Reason / Task</span>
            <p className="text-sm font-medium text-foreground">
              {maintenance.reason || "General maintenance and repairs"}
            </p>
          </div>

          {/* Timestamps */}
          <div className="grid grid-cols-2 gap-2.5 p-3 rounded-lg border border-border bg-card">
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <CalendarIcon className="size-3.5" />
                <span>Starts</span>
              </div>
              <p className="font-mono text-xs font-semibold text-foreground">
                {formatISTDateTime(maintenance.startsAt)}
              </p>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <CalendarIcon className="size-3.5" />
                <span>Ends</span>
              </div>
              <p className="font-mono text-xs font-semibold text-foreground">
                {formatISTDateTime(maintenance.endsAt)}
              </p>
            </div>
          </div>
        </div>

        <DialogFooter className="pt-2">
          <Button variant="outline" size="sm" onClick={onClose} className="w-full sm:w-auto">
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
