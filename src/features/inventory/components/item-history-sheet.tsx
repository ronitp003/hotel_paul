"use client";

import { useEffect, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { getItemMovementsAction } from "@/server/actions/inventory.actions";
import type {
  FormattedInventoryItem,
  FormattedInventoryMovement,
} from "@/server/services/inventory.service";
import { formatISTDateTime } from "@/lib/datetime";
import {
  HistoryIcon,
  RestockIcon,
  ProblemIcon,
  InventoryIcon,
  TransferIcon,
  CheckIcon,
} from "@/lib/icons";

interface ItemHistorySheetProps {
  item: FormattedInventoryItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ItemHistorySheet({
  item,
  open,
  onOpenChange,
}: ItemHistorySheetProps) {
  const [movements, setMovements] = useState<FormattedInventoryMovement[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !item) {
      return;
    }

    let isMounted = true;
    queueMicrotask(() => {
      if (isMounted) {
        setIsLoading(true);
        setError(null);
      }
    });

    getItemMovementsAction({ itemId: item.id })
      .then((res) => {
        if (!isMounted) return;
        if (res.ok && Array.isArray(res.data)) {
          setMovements(res.data as FormattedInventoryMovement[]);
        } else {
          setError(res.message || "Failed to load movement history.");
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        setError(err instanceof Error ? err.message : "Error loading history.");
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [open, item]);

  if (!item) return null;

  const renderActionBadge = (m: FormattedInventoryMovement) => {
    const act = m.actionType;

    if (act === "ADD_STOCK" || (!m.from && m.to === "STORE")) {
      return (
        <Badge
          variant="outline"
          className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 gap-1 font-semibold"
        >
          <RestockIcon className="size-3" />
          Add Stock (+{m.quantity} {item.unit})
        </Badge>
      );
    }

    if (act === "USE_STOCK" || (m.from === "STORE" && m.to === "ROOMS")) {
      return (
        <Badge
          variant="outline"
          className="bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30 gap-1 font-semibold"
        >
          <TransferIcon className="size-3" />
          Use / Issue Stock ({m.quantity} {item.unit})
        </Badge>
      );
    }

    if (act === "MARK_DAMAGED" || m.to === "DAMAGED") {
      return (
        <Badge
          variant="outline"
          className="bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/30 gap-1 font-semibold"
        >
          <ProblemIcon className="size-3" />
          Mark as Damaged ({m.quantity} {item.unit})
        </Badge>
      );
    }

    if (act === "MARK_DISCONTINUED" || m.to === "DISCONTINUED") {
      return (
        <Badge
          variant="outline"
          className="bg-zinc-500/10 text-zinc-700 dark:text-zinc-400 border-zinc-500/30 gap-1 font-semibold"
        >
          Discontinued ({m.quantity} {item.unit})
        </Badge>
      );
    }

    if (act === "RETURN_AVAILABLE" || m.to === "STORE") {
      return (
        <Badge
          variant="outline"
          className="bg-teal-500/10 text-teal-700 dark:text-teal-400 border-teal-500/30 gap-1 font-semibold"
        >
          <CheckIcon className="size-3" />
          Returned to Available (+{m.quantity} {item.unit})
        </Badge>
      );
    }

    // Fallback generic movement
    return (
      <Badge
        variant="outline"
        className="bg-muted text-muted-foreground border-border/60 gap-1 font-medium"
      >
        <span>{m.from || "External"}</span>
        <span>→</span>
        <span>{m.to || "External"}</span>
        <span className="font-mono">({m.quantity})</span>
      </Badge>
    );
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md w-full flex flex-col p-0">
        <div className="p-6 pb-4 border-b border-border/70 space-y-3">
          <SheetHeader className="p-0 space-y-1">
            <div className="flex items-center gap-2">
              <HistoryIcon className="size-5 text-primary shrink-0" />
              <SheetTitle className="text-xl font-bold truncate">
                {item.name}
              </SheetTitle>
            </div>
            <SheetDescription>
              Complete history of stock additions, usage, damages, and returns.
            </SheetDescription>
          </SheetHeader>

          {/* 4 Category Stock Overview */}
          <div className="grid grid-cols-4 gap-2 pt-1 text-center text-xs">
            <div className="rounded-lg bg-muted/40 p-2 border border-border/40">
              <div className="text-[10px] text-emerald-600 dark:text-emerald-400 uppercase font-bold">Available</div>
              <div className="font-mono font-bold text-sm mt-0.5">{item.available}</div>
            </div>
            <div className="rounded-lg bg-muted/40 p-2 border border-border/40">
              <div className="text-[10px] text-blue-600 dark:text-blue-400 uppercase font-bold">In Use</div>
              <div className="font-mono font-bold text-sm mt-0.5">{item.inUse}</div>
            </div>
            <div className="rounded-lg bg-muted/40 p-2 border border-border/40">
              <div className="text-[10px] text-rose-600 dark:text-rose-400 uppercase font-bold">Damaged</div>
              <div className="font-mono font-bold text-sm mt-0.5 text-rose-600 dark:text-rose-400">{item.damaged}</div>
            </div>
            <div className="rounded-lg bg-muted/40 p-2 border border-border/40">
              <div className="text-[10px] text-zinc-500 uppercase font-bold">Discont.</div>
              <div className="font-mono font-bold text-sm mt-0.5 text-zinc-500">{item.discontinued}</div>
            </div>
          </div>
        </div>

        {/* Scrollable history list */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          {isLoading && (
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="rounded-xl border border-border/60 p-3 space-y-2 bg-muted/10 animate-pulse"
                >
                  <div className="flex justify-between items-center">
                    <Skeleton className="h-5 w-28" />
                    <Skeleton className="h-4 w-20" />
                  </div>
                  <Skeleton className="h-3 w-36" />
                </div>
              ))}
            </div>
          )}

          {!isLoading && error && (
            <div className="p-4 rounded-xl border border-destructive/30 bg-destructive/5 text-destructive text-sm text-center">
              {error}
            </div>
          )}

          {!isLoading && !error && movements.length === 0 && (
            <div className="flex flex-col items-center justify-center text-center p-8 text-muted-foreground space-y-2">
              <InventoryIcon className="size-10 opacity-30" />
              <p className="text-sm font-medium">No stock movement history yet.</p>
              <p className="text-xs max-w-xs">
                Stock updates performed via &ldquo;Update Stock&rdquo; will be logged here.
              </p>
            </div>
          )}

          {!isLoading &&
            !error &&
            movements.map((m) => (
              <div
                key={m.id}
                className="rounded-xl border border-border/70 p-3.5 space-y-2 bg-card hover:border-foreground/20 transition-all text-xs"
              >
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div>{renderActionBadge(m)}</div>
                  <span className="text-[11px] font-mono text-muted-foreground">
                    {formatISTDateTime(m.doneAt)}
                  </span>
                </div>

                {/* Previous -> Updated Quantity Tracker */}
                <div className="flex items-center justify-between text-muted-foreground text-[11px] pt-0.5">
                  <span>
                    By <strong className="text-foreground">{m.doneByName}</strong>
                  </span>
                  {m.previousQty !== null && m.updatedQty !== null && (
                    <span className="font-mono text-[11px] bg-muted/50 px-1.5 py-0.5 rounded border border-border/30">
                      Level: <span className="font-medium text-foreground">{m.previousQty}</span> →{" "}
                      <span className="font-bold text-foreground">{m.updatedQty}</span> {item.unit}
                    </span>
                  )}
                </div>

                {/* Optional Note / Reason */}
                {m.note && (
                  <p className="text-xs text-foreground/90 bg-muted/30 p-2 rounded-md italic border border-border/30">
                    &ldquo;{m.note}&rdquo;
                  </p>
                )}
              </div>
            ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
