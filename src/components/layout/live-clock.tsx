"use client";

import { useSyncExternalStore } from "react";
import { ClockIcon } from "@/lib/icons";
import { formatISTDate, formatISTTimeWithSeconds } from "@/lib/datetime";

function subscribe(callback: () => void) {
  const interval = setInterval(callback, 1000);
  return () => clearInterval(interval);
}

function getSnapshot(): string {
  return new Date().toISOString();
}

function getServerSnapshot(): string | null {
  return null;
}

export function LiveClock() {
  const isoTime = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  if (!isoTime) {
    return (
      <div className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-muted text-xs font-medium text-muted-foreground tabular-nums">
        <ClockIcon className="size-3.5" aria-hidden="true" />
        <span>--:--:-- IST</span>
      </div>
    );
  }

  const time = new Date(isoTime);

  return (
    <div
      className="flex items-center gap-2 px-3 py-1 rounded-md bg-muted/70 border border-border text-xs font-medium text-foreground tabular-nums shadow-xs"
      title={`Indian Standard Time: ${formatISTDate(time)}`}
    >
      <ClockIcon className="size-3.5 text-primary" aria-hidden="true" />
      <span className="font-semibold">{formatISTTimeWithSeconds(time)}</span>
      <span className="hidden sm:inline text-muted-foreground border-l border-border pl-2">
        {formatISTDate(time)}
      </span>
      <span className="text-[10px] uppercase font-bold text-primary tracking-wider">
        IST
      </span>
    </div>
  );
}
