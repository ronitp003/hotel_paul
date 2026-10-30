"use client";

import { useState, useTransition } from "react";
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
  ArrowRightIcon,
} from "@/lib/icons";
import { moveStockAction } from "@/server/actions/inventory.actions";
import { StockLocation } from "@/features/inventory/schemas";
import type { FormattedInventoryItem } from "@/server/services/inventory.service";
import { toast } from "sonner";

interface MoveStockDialogProps {
  items: FormattedInventoryItem[];
  preselectedItemId?: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type LocationSelection = StockLocation | "EXTERNAL";

const PRESETS = [
  {
    id: "RESTOCK",
    label: "Restock Store",
    from: "EXTERNAL" as LocationSelection,
    to: StockLocation.STORE as LocationSelection,
    desc: "Receive new stock from supplier into store",
  },
  {
    id: "ISSUE_ROOMS",
    label: "Issue to Rooms",
    from: StockLocation.STORE as LocationSelection,
    to: StockLocation.ROOMS as LocationSelection,
    desc: "Take clean items from store and place in rooms",
  },
  {
    id: "SEND_LAUNDRY",
    label: "Send to Laundry",
    from: StockLocation.ROOMS as LocationSelection,
    to: StockLocation.LAUNDRY as LocationSelection,
    desc: "Send soiled linen from rooms to laundry",
  },
  {
    id: "RECEIVE_LAUNDRY",
    label: "Receive from Laundry",
    from: StockLocation.LAUNDRY as LocationSelection,
    to: StockLocation.STORE as LocationSelection,
    desc: "Return cleaned linen back into store buffer",
  },
  {
    id: "MARK_DAMAGED",
    label: "Mark Damaged",
    from: StockLocation.ROOMS as LocationSelection,
    to: StockLocation.DAMAGED as LocationSelection,
    desc: "Report torn, stained, or broken items",
  },
  {
    id: "DISCARD",
    label: "Discard Damaged",
    from: StockLocation.DAMAGED as LocationSelection,
    to: "EXTERNAL" as LocationSelection,
    desc: "Permanently write-off or scrap damaged items",
  },
];

export function MoveStockDialog({
  items,
  preselectedItemId,
  open,
  onOpenChange,
}: MoveStockDialogProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [userSelectedItemId, setUserSelectedItemId] = useState<string | null>(null);
  const [activePreset, setActivePreset] = useState<string>("ISSUE_ROOMS");
  const [fromLoc, setFromLoc] = useState<LocationSelection>(StockLocation.STORE);
  const [toLoc, setToLoc] = useState<LocationSelection>(StockLocation.ROOMS);
  const [quantity, setQuantity] = useState("1");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const selectedItemId =
    userSelectedItemId ?? preselectedItemId ?? items[0]?.id ?? "";

  const selectedItem = items.find((i) => i.id === selectedItemId);

  const getSourceStock = (loc: LocationSelection): number | null => {
    if (!selectedItem || loc === "EXTERNAL") return null;
    switch (loc) {
      case StockLocation.STORE:
        return selectedItem.qtyStore;
      case StockLocation.ROOMS:
        return selectedItem.qtyRooms;
      case StockLocation.LAUNDRY:
        return selectedItem.qtyLaundry;
      case StockLocation.DAMAGED:
        return selectedItem.qtyDamaged;
      default:
        return 0;
    }
  };

  const currentAvailable = getSourceStock(fromLoc);

  const handleApplyPreset = (preset: (typeof PRESETS)[number]) => {
    setActivePreset(preset.id);
    setFromLoc(preset.from);
    setToLoc(preset.to);
    setError(null);
  };

  const handleQuantityChip = (qty: number) => {
    setQuantity(qty.toString());
  };

  const handleMaxQuantity = () => {
    if (currentAvailable !== null && currentAvailable > 0) {
      setQuantity(currentAvailable.toString());
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!selectedItem) {
      setError("Please select an inventory item.");
      return;
    }

    if (fromLoc === "EXTERNAL" && toLoc === "EXTERNAL") {
      setError("Both source and destination cannot be external.");
      return;
    }

    if (fromLoc === toLoc) {
      setError("Source and destination cannot be identical.");
      return;
    }

    const qtyVal = parseInt(quantity, 10);
    if (isNaN(qtyVal) || qtyVal <= 0) {
      setError("Quantity must be a positive number greater than 0.");
      return;
    }

    if (currentAvailable !== null && qtyVal > currentAvailable) {
      setError(
        `Cannot move ${qtyVal} ${selectedItem.unit}. Only ${currentAvailable} ${selectedItem.unit} available in ${fromLoc}.`
      );
      return;
    }

    const resolvedFrom = fromLoc === "EXTERNAL" ? null : fromLoc;
    const resolvedTo = toLoc === "EXTERNAL" ? null : toLoc;

    startTransition(async () => {
      const res = await moveStockAction({
        itemId: selectedItem.id,
        from: resolvedFrom,
        to: resolvedTo,
        quantity: qtyVal,
        note: note.trim() || undefined,
      });

      if (!res.ok) {
        setError(res.message || "Failed to record stock movement.");
        return;
      }

      toast.success(
        `Moved ${qtyVal} ${selectedItem.unit} of "${selectedItem.name}" successfully.`
      );
      setQuantity("1");
      setNote("");
      onOpenChange(false);
      router.refresh();
    });
  };

  // Build items dropdown
  const itemOptions: SelectDropdownOption[] = items.map((i) => ({
    value: i.id,
    label: (
      <div className="flex items-center justify-between gap-3 w-full">
        <span className="font-medium truncate">{i.name}</span>
        <span className="text-xs text-muted-foreground shrink-0">
          Store: {i.qtyStore} {i.unit}
        </span>
      </div>
    ),
  }));

  const fromOptions: SelectDropdownOption<LocationSelection>[] = [
    {
      value: "EXTERNAL",
      label: "Supplier / External Purchase",
    },
    {
      value: StockLocation.STORE,
      label: `Store Room (${selectedItem?.qtyStore ?? 0} ${selectedItem?.unit || "pcs"})`,
    },
    {
      value: StockLocation.ROOMS,
      label: `Guest Rooms (${selectedItem?.qtyRooms ?? 0} ${selectedItem?.unit || "pcs"})`,
    },
    {
      value: StockLocation.LAUNDRY,
      label: `Laundry Service (${selectedItem?.qtyLaundry ?? 0} ${selectedItem?.unit || "pcs"})`,
    },
    {
      value: StockLocation.DAMAGED,
      label: `Damaged Stock (${selectedItem?.qtyDamaged ?? 0} ${selectedItem?.unit || "pcs"})`,
    },
  ];

  const toOptions: SelectDropdownOption<LocationSelection>[] = [
    {
      value: StockLocation.STORE,
      label: `Store Room (${selectedItem?.qtyStore ?? 0} ${selectedItem?.unit || "pcs"})`,
    },
    {
      value: StockLocation.ROOMS,
      label: `Guest Rooms (${selectedItem?.qtyRooms ?? 0} ${selectedItem?.unit || "pcs"})`,
    },
    {
      value: StockLocation.LAUNDRY,
      label: `Laundry Service (${selectedItem?.qtyLaundry ?? 0} ${selectedItem?.unit || "pcs"})`,
    },
    {
      value: StockLocation.DAMAGED,
      label: `Damaged Stock (${selectedItem?.qtyDamaged ?? 0} ${selectedItem?.unit || "pcs"})`,
    },
    {
      value: "EXTERNAL",
      label: "Discard / Scrapped (Write-off)",
    },
  ];

  const parsedQty = parseInt(quantity, 10) || 0;

  return (
    <Dialog open={open} onOpenChange={(v) => !isPending && onOpenChange(v)}>
      <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-bold">
              <TransferIcon className="size-5 text-primary" />
              Move Inventory Stock
            </DialogTitle>
            <DialogDescription>
              Transfer items between store, rooms, laundry, and damaged counts with complete traceability.
            </DialogDescription>
          </DialogHeader>

          {error && (
            <Alert variant="destructive">
              <ProblemIcon className="size-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Item Selector */}
          <div className="space-y-1.5">
            <Label htmlFor="stock-item-select">
              Select Item <span className="text-destructive">*</span>
            </Label>
            <SelectDropdown
              value={selectedItemId}
              onChange={(val) => {
                setUserSelectedItemId(val);
                setError(null);
              }}
              options={itemOptions}
              disabled={isPending || items.length === 0}
              placeholder="Select an inventory item..."
            />
          </div>

          {selectedItem && (
            <div className="rounded-xl border border-border/70 p-3 bg-muted/30 space-y-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
                <span>Current Stock Distribution</span>
                <span>Unit: {selectedItem.unit}</span>
              </div>
              <div className="grid grid-cols-4 gap-2 text-center text-xs">
                <div className="rounded-lg bg-background p-2 border border-border/50">
                  <div className="text-muted-foreground text-[10px] uppercase font-bold tracking-wider">
                    Store
                  </div>
                  <div className="text-sm font-bold font-mono mt-0.5">
                    {selectedItem.qtyStore}
                  </div>
                </div>
                <div className="rounded-lg bg-background p-2 border border-border/50">
                  <div className="text-muted-foreground text-[10px] uppercase font-bold tracking-wider">
                    Rooms
                  </div>
                  <div className="text-sm font-bold font-mono mt-0.5">
                    {selectedItem.qtyRooms}
                  </div>
                </div>
                <div className="rounded-lg bg-background p-2 border border-border/50">
                  <div className="text-muted-foreground text-[10px] uppercase font-bold tracking-wider">
                    Laundry
                  </div>
                  <div className="text-sm font-bold font-mono mt-0.5">
                    {selectedItem.qtyLaundry}
                  </div>
                </div>
                <div className="rounded-lg bg-background p-2 border border-border/50">
                  <div className="text-muted-foreground text-[10px] uppercase font-bold tracking-wider text-rose-600 dark:text-rose-400">
                    Damaged
                  </div>
                  <div className="text-sm font-bold font-mono mt-0.5 text-rose-600 dark:text-rose-400">
                    {selectedItem.qtyDamaged}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Quick Presets */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Quick Action Presets</Label>
            <div className="flex flex-wrap gap-1.5">
              {PRESETS.map((preset) => {
                const isActive = activePreset === preset.id;
                return (
                  <Button
                    key={preset.id}
                    type="button"
                    variant={isActive ? "default" : "outline"}
                    size="sm"
                    className="h-7 text-xs font-medium"
                    onClick={() => handleApplyPreset(preset)}
                    disabled={isPending}
                  >
                    {preset.label}
                  </Button>
                );
              })}
            </div>
          </div>

          {/* Source and Destination Selectors */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div className="space-y-1.5">
              <Label>From (Source)</Label>
              <SelectDropdown<LocationSelection>
                value={fromLoc}
                onChange={(val) => {
                  setFromLoc(val);
                  setActivePreset("CUSTOM");
                  setError(null);
                }}
                options={fromOptions}
                disabled={isPending}
              />
              {currentAvailable !== null && (
                <div className="text-xs text-muted-foreground flex items-center justify-between">
                  <span>Available:</span>
                  <span className="font-mono font-medium text-foreground">
                    {currentAvailable} {selectedItem?.unit}
                  </span>
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>To (Destination)</Label>
              <SelectDropdown<LocationSelection>
                value={toLoc}
                onChange={(val) => {
                  setToLoc(val);
                  setActivePreset("CUSTOM");
                  setError(null);
                }}
                options={toOptions}
                disabled={isPending}
              />
            </div>
          </div>

          {/* Quantity Input with quick helpers */}
          <div className="space-y-1.5 pt-1">
            <div className="flex items-center justify-between">
              <Label htmlFor="movement-quantity">
                Quantity to Move <span className="text-destructive">*</span>
              </Label>
              {currentAvailable !== null && currentAvailable > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs text-primary px-1.5"
                  onClick={handleMaxQuantity}
                  disabled={isPending}
                >
                  Max ({currentAvailable})
                </Button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Input
                id="movement-quantity"
                type="number"
                inputMode="numeric"
                min="1"
                max={currentAvailable !== null ? currentAvailable : undefined}
                step="1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                disabled={isPending}
                required
                className="font-mono text-base font-semibold"
              />
              <div className="flex gap-1">
                {[1, 5, 10].map((step) => (
                  <Button
                    key={step}
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-9 px-2.5 text-xs font-mono"
                    onClick={() => handleQuantityChip(step)}
                    disabled={
                      isPending ||
                      (currentAvailable !== null && currentAvailable < step)
                    }
                  >
                    +{step}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          {/* Live Preview Bar */}
          {selectedItem && parsedQty > 0 && fromLoc !== toLoc && (
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-2.5 text-xs flex items-center justify-between">
              <span className="font-medium text-muted-foreground">Balance Preview:</span>
              <div className="flex items-center gap-2 font-mono font-medium">
                {fromLoc !== "EXTERNAL" && (
                  <span className="text-foreground">
                    {fromLoc}: {getSourceStock(fromLoc)} →{" "}
                    <span className="text-rose-600 dark:text-rose-400 font-bold">
                      {Math.max(0, (getSourceStock(fromLoc) || 0) - parsedQty)}
                    </span>
                  </span>
                )}
                <ArrowRightIcon className="size-3 text-muted-foreground" />
                {toLoc !== "EXTERNAL" && (
                  <span className="text-foreground">
                    {toLoc}: {getSourceStock(toLoc)} →{" "}
                    <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                      {(getSourceStock(toLoc) || 0) + parsedQty}
                    </span>
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Note Input */}
          <div className="space-y-1.5">
            <Label htmlFor="movement-note">Reason / Note (Optional)</Label>
            <Input
              id="movement-note"
              placeholder="e.g. Floor 2 routine restock, Cleanwell dry cleaner invoice, stained sheet"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              disabled={isPending}
              maxLength={255}
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={
                isPending ||
                !selectedItem ||
                parsedQty <= 0 ||
                (currentAvailable !== null && parsedQty > currentAvailable)
              }
            >
              {isPending && <SpinnerIcon className="size-4 animate-spin mr-2" />}
              Confirm Movement
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
