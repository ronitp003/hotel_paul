"use client";

import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { SelectDropdown, type SelectDropdownOption } from "@/components/ui/select-dropdown";
import {
  SpinnerIcon,
  TransferIcon,
  ProblemIcon,
  CheckIcon,
} from "@/lib/icons";
import { updateStockAction } from "@/server/actions/inventory.actions";
import { StockActionType } from "@/features/inventory/schemas";
import type { FormattedInventoryItem } from "@/server/services/inventory.service";
import { toast } from "sonner";

interface UpdateStockDialogProps {
  items: FormattedInventoryItem[];
  preselectedItemId?: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (item: FormattedInventoryItem) => void;
}

const STOCK_ACTIONS: {
  value: StockActionType;
  label: string;
  description: string;
  badgeColor?: string;
}[] = [
  {
    value: StockActionType.ADD_STOCK,
    label: "Add Stock",
    description: "Receive new stock into Available inventory",
  },
  {
    value: StockActionType.USE_STOCK,
    label: "Use / Issue Stock",
    description: "Issue available stock for room turnover or guest use",
  },
  {
    value: StockActionType.MARK_DAMAGED,
    label: "Mark as Damaged",
    description: "Record stained, torn, or broken items as damaged",
  },
  {
    value: StockActionType.MARK_DISCONTINUED,
    label: "Mark as Discontinued",
    description: "Retire obsolete, expired, or decommissioned items",
  },
  {
    value: StockActionType.RETURN_AVAILABLE,
    label: "Return to Available Stock",
    description: "Return in-use or recovered items back to Available stock",
  },
];

export function UpdateStockDialog({
  items,
  preselectedItemId,
  open,
  onOpenChange,
  onSuccess,
}: UpdateStockDialogProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [userSelectedItemId, setUserSelectedItemId] = useState<string | null>(null);
  const [actionType, setActionType] = useState<StockActionType>(StockActionType.USE_STOCK);
  const [quantity, setQuantity] = useState("1");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const selectedItemId =
    userSelectedItemId ?? preselectedItemId ?? items[0]?.id ?? "";

  const selectedItem = items.find((i) => i.id === selectedItemId);

  const itemOptions: SelectDropdownOption[] = useMemo(() => {
    return items.map((i) => ({
      value: i.id,
      label: `${i.name} (${i.available} ${i.unit} available)`,
    }));
  }, [items]);

  const actionOptions: SelectDropdownOption[] = useMemo(() => {
    return STOCK_ACTIONS.map((a) => ({
      value: a.value,
      label: a.label,
    }));
  }, []);

  const resetForm = () => {
    setUserSelectedItemId(null);
    setActionType(StockActionType.USE_STOCK);
    setQuantity("1");
    setNote("");
    setError(null);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!isPending) {
      if (!nextOpen) resetForm();
      onOpenChange(nextOpen);
    }
  };

  // Quick chips
  const handleQuantityChip = (delta: number) => {
    const current = parseInt(quantity, 10);
    const nextVal = (isNaN(current) || current <= 0 ? 0 : current) + delta;
    setQuantity(Math.max(1, nextVal).toString());
  };

  const handleMaxQuantity = () => {
    if (!selectedItem) return;
    let maxQty = 0;
    if (actionType === StockActionType.USE_STOCK) {
      maxQty = selectedItem.available;
    } else if (actionType === StockActionType.MARK_DAMAGED) {
      maxQty = selectedItem.available + selectedItem.inUse;
    } else if (actionType === StockActionType.MARK_DISCONTINUED) {
      maxQty = selectedItem.available + selectedItem.inUse + selectedItem.damaged;
    } else if (actionType === StockActionType.RETURN_AVAILABLE) {
      maxQty = selectedItem.inUse + selectedItem.damaged;
    }
    if (maxQty > 0) {
      setQuantity(maxQty.toString());
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!selectedItem) {
      setError("Please select an inventory item.");
      return;
    }

    const qtyVal = parseInt(quantity, 10);
    if (isNaN(qtyVal) || qtyVal <= 0) {
      setError("Please enter a valid quantity of at least 1.");
      return;
    }

    // Client validation for immediate feedback
    if (actionType === StockActionType.USE_STOCK && qtyVal > selectedItem.available) {
      setError(
        `Cannot issue ${qtyVal} ${selectedItem.unit}. Only ${selectedItem.available} ${selectedItem.unit} currently available.`
      );
      return;
    }

    if (
      actionType === StockActionType.MARK_DAMAGED &&
      qtyVal > selectedItem.available + selectedItem.inUse
    ) {
      setError(
        `Cannot mark ${qtyVal} ${selectedItem.unit} as damaged. Only ${
          selectedItem.available + selectedItem.inUse
        } ${selectedItem.unit} available or in use.`
      );
      return;
    }

    if (
      actionType === StockActionType.RETURN_AVAILABLE &&
      qtyVal > selectedItem.inUse + selectedItem.damaged
    ) {
      setError(
        `Cannot return ${qtyVal} ${selectedItem.unit}. Only ${
          selectedItem.inUse + selectedItem.damaged
        } ${selectedItem.unit} currently in use or damaged.`
      );
      return;
    }

    startTransition(async () => {
      const res = await updateStockAction({
        itemId: selectedItem.id,
        actionType,
        quantity: qtyVal,
        note: note.trim() || undefined,
      });

      if (!res.ok) {
        setError(res.message || "Failed to update stock.");
        return;
      }

      const actionLabel =
        STOCK_ACTIONS.find((a) => a.value === actionType)?.label ?? "Stock";
      toast.success(
        `${actionLabel}: Updated ${qtyVal} ${selectedItem.unit} for "${selectedItem.name}".`
      );
      const data = res.data as { item: FormattedInventoryItem } | undefined;
      if (data?.item) {
        onSuccess?.(data.item);
      }
      resetForm();
      onOpenChange(false);
      router.refresh();
    });
  };

  const selectedActionMeta = STOCK_ACTIONS.find((a) => a.value === actionType);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-bold">
              <TransferIcon className="size-5 text-primary" />
              Update Stock
            </DialogTitle>
            <DialogDescription>
              Adjust stock levels for daily hotel operations, guest room usage, or inventory write-offs.
            </DialogDescription>
          </DialogHeader>

          {error && (
            <Alert variant="destructive">
              <ProblemIcon className="size-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-4 py-1">
            {/* Item Selection */}
            <div className="space-y-1.5">
              <Label htmlFor="stock-item-select">Inventory Item</Label>
              <SelectDropdown
                value={selectedItemId}
                onChange={(val) => {
                  setUserSelectedItemId(val);
                  setError(null);
                }}
                options={itemOptions}
                placeholder="Choose an inventory item..."
                disabled={isPending}
              />
            </div>

            {/* Current Stock Information */}
            {selectedItem && (
              <div className="rounded-xl border border-border/70 bg-muted/20 p-3 space-y-2">
                <div className="text-xs font-semibold text-muted-foreground flex items-center justify-between">
                  <span>Current Stock Status</span>
                  <span className="font-mono text-[11px] font-normal">
                    Unit: {selectedItem.unit}
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-2 text-center text-xs">
                  <div className="rounded-lg bg-background p-2 border border-border/50 shadow-xs">
                    <div className="text-[10px] text-emerald-600 dark:text-emerald-400 uppercase font-bold">
                      Available
                    </div>
                    <div className="font-mono font-bold text-sm mt-0.5 text-foreground">
                      {selectedItem.available}
                    </div>
                  </div>
                  <div className="rounded-lg bg-background p-2 border border-border/50 shadow-xs">
                    <div className="text-[10px] text-blue-600 dark:text-blue-400 uppercase font-bold">
                      In Use
                    </div>
                    <div className="font-mono font-bold text-sm mt-0.5 text-foreground">
                      {selectedItem.inUse}
                    </div>
                  </div>
                  <div className="rounded-lg bg-background p-2 border border-border/50 shadow-xs">
                    <div className="text-[10px] text-rose-600 dark:text-rose-400 uppercase font-bold">
                      Damaged
                    </div>
                    <div className="font-mono font-bold text-sm mt-0.5 text-foreground">
                      {selectedItem.damaged}
                    </div>
                  </div>
                  <div className="rounded-lg bg-background p-2 border border-border/50 shadow-xs">
                    <div className="text-[10px] text-zinc-500 uppercase font-bold">
                      Discontinued
                    </div>
                    <div className="font-mono font-bold text-sm mt-0.5 text-foreground">
                      {selectedItem.discontinued}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Action Selection */}
            <div className="space-y-1.5">
              <Label htmlFor="stock-action-select">Stock Action</Label>
              <SelectDropdown
                value={actionType}
                onChange={(val) => {
                  setActionType(val as StockActionType);
                  setError(null);
                }}
                options={actionOptions}
                disabled={isPending}
              />
              {selectedActionMeta && (
                <p className="text-xs text-muted-foreground mt-1">
                  {selectedActionMeta.description}
                </p>
              )}
            </div>

            {/* Quantity Input with helper chips */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="stock-qty">Quantity ({selectedItem?.unit || "units"})</Label>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleQuantityChip(1)}
                    className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground"
                  >
                    +1
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuantityChip(5)}
                    className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground"
                  >
                    +5
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuantityChip(10)}
                    className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground"
                  >
                    +10
                  </button>
                  {actionType !== StockActionType.ADD_STOCK && (
                    <button
                      type="button"
                      onClick={handleMaxQuantity}
                      className="text-[11px] font-semibold px-1.5 py-0.5 rounded bg-primary/10 hover:bg-primary/20 text-primary"
                    >
                      Max
                    </button>
                  )}
                </div>
              </div>
              <Input
                id="stock-qty"
                type="number"
                inputMode="numeric"
                min="1"
                step="1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                disabled={isPending}
                required
              />
            </div>

            {/* Optional Note / Reason */}
            <div className="space-y-1.5">
              <Label htmlFor="stock-note">
                Note / Reason <span className="text-xs text-muted-foreground font-normal">(optional)</span>
              </Label>
              <Input
                id="stock-note"
                placeholder="e.g. Daily housekeeping restock, Damaged by spill, End of season write-off"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                disabled={isPending}
                maxLength={255}
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending || !selectedItem}>
              {isPending ? (
                <SpinnerIcon className="size-4 animate-spin mr-2" />
              ) : (
                <CheckIcon className="size-4 mr-1.5" />
              )}
              Confirm Update
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
