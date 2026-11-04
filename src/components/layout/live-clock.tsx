"use client";

import { useSyncExternalStore } from "react";
import { ClockIcon } from "@/lib/icons";
import { formatISTDate, formatISTTime, formatISTTimeWithSeconds } from "@/lib/datetime";

let currentSnapshot: string | null = null;
const listeners = new Set<() => void>();
let timerId: ReturnType<typeof setInterval> | null = null;

function subscribe(callback: () => void) {
  listeners.add(callback);

  if (timerId === null) {
    currentSnapshot = new Date().toISOString();
    timerId = setInterval(() => {
      currentSnapshot = new Date().toISOString();
      for (const listener of listeners) {
        listener();
      }
    }, 1000);
  }

  // Notify subscriber with current snapshot right after mounting
  callback();

  return () => {
    listeners.delete(callback);
    if (listeners.size === 0 && timerId !== null) {
      clearInterval(timerId);
      timerId = null;
      currentSnapshot = null;
    }
  };
}

function getSnapshot(): string | null {
  return currentSnapshot;
}

function getServerSnapshot(): string | null {
  return null;
}

export function LiveClock() {
  const isoTime = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot
  );

  if (!isoTime) {
    return (
      <div className="flex items-center gap-1.5 px-2 py-0.5 sm:px-3 sm:py-1 rounded-md bg-muted text-xs font-medium text-muted-foreground tabular-nums">
        <ClockIcon className="size-3.5 shrink-0" aria-hidden="true" />
        <span>--:-- IST</span>
      </div>
    );
  }

  const time = new Date(isoTime);

  return (
    <div
      className="flex items-center gap-1.5 sm:gap-2 px-2 py-0.5 sm:px-3 sm:py-1 rounded-md bg-muted/70 border border-border text-xs font-medium text-foreground tabular-nums shadow-xs"
      title={`Indian Standard Time: ${formatISTDate(time)}`}
    >
      <ClockIcon className="size-3.5 text-primary shrink-0" aria-hidden="true" />
      <span className="font-semibold hidden sm:inline">{formatISTTimeWithSeconds(time)}</span>
      <span className="font-semibold sm:hidden">{formatISTTime(time)}</span>
      <span className="hidden sm:inline text-muted-foreground border-l border-border pl-2">
        {formatISTDate(time)}
      </span>
      <span className="text-[10px] uppercase font-bold text-primary tracking-wider">
        IST
      </span>
    </div>
  );
}
