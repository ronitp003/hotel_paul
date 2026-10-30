"use client";

import { useState, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { SelectDropdown } from "@/components/ui/select-dropdown";
import { logProblemAction } from "@/server/actions/room-maintenance.actions";
import { ProblemIcon, SpinnerIcon } from "@/lib/icons";
import { SEVERITIES, type Severity } from "@/lib/constants";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface LogProblemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  room?: { id: string; number: string };
  rooms?: Array<{ id: string; number: string }>;
  onSuccess?: () => void;
}

const SEVERITY_CONFIG: Record<
  Severity,
  { label: string; description: string; colorClass: string; activeClass: string }
> = {
  LOW: {
    label: "Low",
    description: "Minor cosmetic or non-urgent issue (e.g., bulb flicker, loose knob)",
    colorClass: "border-slate-300 text-slate-700 hover:border-slate-400 dark:border-slate-700 dark:text-slate-300",
    activeClass: "border-blue-500 bg-blue-500/10 text-blue-700 dark:text-blue-300 ring-2 ring-blue-500/30",
  },
  MEDIUM: {
    label: "Medium",
    description: "Noticeable defect, needs attention soon (e.g., tap dripping, TV remote)",
    colorClass: "border-slate-300 text-slate-700 hover:border-slate-400 dark:border-slate-700 dark:text-slate-300",
    activeClass: "border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-300 ring-2 ring-amber-500/30",
  },
  HIGH: {
    label: "High",
    description: "Impairs guest stay, requires quick fix (e.g., AC not cooling, geyser broken)",
    colorClass: "border-slate-300 text-slate-700 hover:border-slate-400 dark:border-slate-700 dark:text-slate-300",
    activeClass: "border-orange-500 bg-orange-500/10 text-orange-700 dark:text-orange-300 ring-2 ring-orange-500/30",
  },
  CRITICAL: {
    label: "Critical",
    description: "Uninhabitable or safety issue, room cannot be used (e.g., flood, lock broken)",
    colorClass: "border-slate-300 text-slate-700 hover:border-slate-400 dark:border-slate-700 dark:text-slate-300",
    activeClass: "border-destructive bg-destructive/10 text-destructive ring-2 ring-destructive/30",
  },
};

export function LogProblemDialog({
  open,
  onOpenChange,
  room,
  rooms = [],
  onSuccess,
}: LogProblemDialogProps) {
  const [selectedRoomId, setSelectedRoomId] = useState<string>(room?.id || "");
  const [severity, setSeverity] = useState<Severity>(SEVERITIES.MEDIUM);
  const [description, setDescription] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const activeRoomId = room?.id || selectedRoomId;
  const activeRoomNumber =
    room?.number || rooms.find((r) => r.id === activeRoomId)?.number || "";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeRoomId) {
      setErrorMsg("Please select a room.");
      return;
    }
    if (description.trim().length < 3) {
      setErrorMsg("Please describe the problem (at least 3 characters).");
      return;
    }

    setErrorMsg(null);
    startTransition(async () => {
      const res = await logProblemAction({
        roomId: activeRoomId,
        severity,
        description: description.trim(),
      });

      if (!res.ok) {
        setErrorMsg(res.message || "Failed to log problem");
        return;
      }

      toast.success(`Problem logged for Room ${activeRoomNumber}`, {
        description: `${severity} severity issue recorded.`,
      });
      setDescription("");
      onOpenChange(false);
      onSuccess?.();
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-xl bg-destructive/10 text-destructive flex items-center justify-center shrink-0">
                <ProblemIcon className="size-5" />
              </div>
              <div className="space-y-0.5">
                <DialogTitle className="text-lg">
                  {room ? `Report Problem — Room ${room.number}` : "Report Room Problem"}
                </DialogTitle>
                <DialogDescription>
                  Log a maintenance defect or inspection issue for front-desk and housekeeping tracking.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Room Selector if room is not pre-determined */}
            {!room && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">
                  Select Room <span className="text-destructive">*</span>
                </label>
                <SelectDropdown
                  value={selectedRoomId}
                  onChange={setSelectedRoomId}
                  options={rooms.map((r) => ({
                    value: r.id,
                    label: `Room ${r.number}`,
                  }))}
                  placeholder="Choose room..."
                />
              </div>
            )}

            {/* Severity Level Picker */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-foreground">
                Severity Level <span className="text-destructive">*</span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                {(Object.keys(SEVERITY_CONFIG) as Severity[]).map((key) => {
                  const cfg = SEVERITY_CONFIG[key];
                  const isSelected = severity === key;
                  return (
                    <button
                      type="button"
                      key={key}
                      onClick={() => setSeverity(key)}
                      className={cn(
                        "p-2.5 rounded-lg border text-left transition-all cursor-pointer flex flex-col justify-between",
                        isSelected ? cfg.activeClass : cfg.colorClass
                      )}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold">{cfg.label}</span>
                        {isSelected && (
                          <span className="size-2 rounded-full bg-current shrink-0" />
                        )}
                      </div>
                      <span className="text-[10px] leading-tight text-muted-foreground line-clamp-2">
                        {cfg.description}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Description Textarea */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <label className="font-semibold text-foreground">
                  Problem Description <span className="text-destructive">*</span>
                </label>
                <span className="text-muted-foreground text-[11px]">
                  {description.length}/500
                </span>
              </div>
              <Textarea
                placeholder="Describe what is damaged, malfunctioning, or requires replacement..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={500}
                rows={3}
                className="resize-none text-sm"
              />
            </div>

            {errorMsg && (
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-xs font-medium text-destructive">
                {errorMsg}
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
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
              disabled={isPending}
              className="gap-1.5"
            >
              {isPending && <SpinnerIcon className="size-3.5 animate-spin" />}
              <span>Submit Report</span>
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
