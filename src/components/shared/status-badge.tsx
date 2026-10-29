import { cn } from "@/lib/utils";
import {
  CheckIcon,
  RoomIcon,
  CalendarIcon,
  MaintenanceIcon,
  ProblemIcon,
  CloseIcon,
} from "@/lib/icons";

export type StatusType =
  | "OCCUPIED"
  | "AVAILABLE"
  | "RESERVED"
  | "MAINTENANCE"
  | "PROBLEM"
  | "UNAVAILABLE"
  | "CHECKED_IN"
  | "CHECKED_OUT"
  | "CANCELLED";

interface StatusBadgeProps {
  status: StatusType;
  label?: string;
  className?: string;
}

export function StatusBadge({ status, label, className }: StatusBadgeProps) {
  let displayLabel = label;
  let bgClass = "bg-muted text-muted-foreground border-border";
  let Icon = CheckIcon;

  switch (status) {
    case "OCCUPIED":
    case "CHECKED_IN":
      displayLabel = displayLabel || "Occupied";
      bgClass = "bg-status-occupied/15 text-status-occupied border-status-occupied/30";
      Icon = RoomIcon;
      break;
    case "AVAILABLE":
      displayLabel = displayLabel || "Available";
      bgClass = "bg-status-available/15 text-status-available border-status-available/30";
      Icon = CheckIcon;
      break;
    case "RESERVED":
      displayLabel = displayLabel || "Reserved";
      bgClass = "bg-status-reserved/15 text-status-reserved border-status-reserved/30";
      Icon = CalendarIcon;
      break;
    case "MAINTENANCE":
      displayLabel = displayLabel || "Under Maintenance";
      bgClass = "bg-status-maintenance/15 text-status-maintenance border-status-maintenance/30";
      Icon = MaintenanceIcon;
      break;
    case "PROBLEM":
      displayLabel = displayLabel || "Open Problem";
      bgClass = "bg-status-problem/15 text-status-problem border-status-problem/30";
      Icon = ProblemIcon;
      break;
    case "UNAVAILABLE":
    case "CANCELLED":
      displayLabel = displayLabel || "Unavailable";
      bgClass = "bg-status-unavailable/15 text-status-unavailable border-status-unavailable/30";
      Icon = CloseIcon;
      break;
    case "CHECKED_OUT":
      displayLabel = displayLabel || "Checked Out";
      bgClass = "bg-muted text-muted-foreground border-border";
      Icon = CheckIcon;
      break;
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border tracking-wide whitespace-nowrap",
        bgClass,
        className
      )}
    >
      <Icon className="size-3.5 shrink-0" aria-hidden="true" />
      <span>{displayLabel}</span>
    </span>
  );
}
