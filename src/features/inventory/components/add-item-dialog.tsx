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
import { SelectDropdown } from "@/components/ui/select-dropdown";
import { SpinnerIcon, AddIcon, ProblemIcon } from "@/lib/icons";
import { createInventoryItemAction } from "@/server/actions/inventory.actions";
import type { FormattedInventoryItem } from "@/server/services/inventory.service";
import { toast } from "sonner";

interface AddItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (item: FormattedInventoryItem) => void;
}

const COMMON_UNITS = [
  { value: "pcs", label: "Pieces (pcs)" },
  { value: "sets", label: "Sets (sets)" },
  { value: "bottles", label: "Bottles (bottles)" },
  { value: "rolls", label: "Rolls (rolls)" },
  { value: "packets", label: "Packets (packets)" },
  { value: "pairs", label: "Pairs (pairs)" },
  { value: "kg", label: "Kilograms (kg)" },
  { value: "custom", label: "Other / Custom" },
];

export function AddItemDialog({
  open,
  onOpenChange,
  onSuccess,
}: AddItemDialogProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [name, setName] = useState("");
  const [unitSelection, setUnitSelection] = useState("pcs");
  const [customUnit, setCustomUnit] = useState("");
  const [initialAvailableStock, setInitialAvailableStock] = useState("0");
  const [reorderLevel, setReorderLevel] = useState("");
  const [error, setError] = useState<string | null>(null);

  const resetForm = () => {
    setName("");
    setUnitSelection("pcs");
    setCustomUnit("");
    setInitialAvailableStock("0");
    setReorderLevel("");
    setError(null);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!isPending) {
      if (!nextOpen) resetForm();
      onOpenChange(nextOpen);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Item name is required.");
      return;
    }

    const resolvedUnit =
      unitSelection === "custom" ? customUnit.trim() : unitSelection;
    if (!resolvedUnit) {
      setError("Please specify a unit of measure.");
      return;
    }

    const initialStockVal = parseInt(initialAvailableStock, 10);
    if (isNaN(initialStockVal) || initialStockVal < 0) {
      setError("Initial available stock is required and cannot be negative.");
      return;
    }

    let alertLevelVal = 0;
    if (reorderLevel.trim() !== "") {
      alertLevelVal = parseInt(reorderLevel, 10);
      if (isNaN(alertLevelVal) || alertLevelVal < 0) {
        setError("Low stock alert level must be a non-negative number.");
        return;
      }
    }

    startTransition(async () => {
      const res = await createInventoryItemAction({
        name: trimmedName,
        unit: resolvedUnit,
        initialAvailableStock: initialStockVal,
        reorderLevel: alertLevelVal,
      });

      if (!res.ok) {
        setError(res.message || "Failed to create inventory item.");
        return;
      }

      const createdItem = res.data as FormattedInventoryItem;
      toast.success(`Inventory item "${trimmedName}" created successfully.`);
      onSuccess?.(createdItem);
      resetForm();
      onOpenChange(false);
      router.refresh();
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-bold">
              <AddIcon className="size-5 text-primary" />
              Add Inventory Item
            </DialogTitle>
            <DialogDescription>
              Create a new inventory item to track hotel amenities, linen, or room supplies.
            </DialogDescription>
          </DialogHeader>

          {error && (
            <Alert variant="destructive">
              <ProblemIcon className="size-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-3.5 py-1">
            {/* Item Name (required) */}
            <div className="space-y-1.5">
              <Label htmlFor="item-name">
                Item Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="item-name"
                placeholder="e.g. Bath Towel, Double Bedsheet, TV Remote"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isPending}
                required
                maxLength={100}
                autoFocus
              />
            </div>

            {/* Unit of Measure (required) */}
            <div className="space-y-1.5">
              <Label htmlFor="item-unit">
                Unit of Measure <span className="text-destructive">*</span>
              </Label>
              <SelectDropdown
                value={unitSelection}
                onChange={(val) => setUnitSelection(val)}
                options={COMMON_UNITS}
                disabled={isPending}
              />
            </div>

            {/* Custom Unit Input when Other / Custom is selected */}
            {unitSelection === "custom" && (
              <div className="space-y-1.5 animate-in fade-in-50 duration-200">
                <Label htmlFor="custom-unit">
                  Custom Unit Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="custom-unit"
                  placeholder="e.g. Liters, Cartons, Boxes"
                  value={customUnit}
                  onChange={(e) => setCustomUnit(e.target.value)}
                  disabled={isPending}
                  maxLength={20}
                  required
                />
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              {/* Initial Available Stock (required) */}
              <div className="space-y-1.5">
                <Label htmlFor="initial-stock">
                  Initial Available Stock <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="initial-stock"
                  type="number"
                  inputMode="numeric"
                  min="0"
                  step="1"
                  value={initialAvailableStock}
                  onChange={(e) => setInitialAvailableStock(e.target.value)}
                  disabled={isPending}
                  required
                />
                <p className="text-[11px] text-muted-foreground">
                  Starting stock ready for immediate use.
                </p>
              </div>

              {/* Low Stock Alert Level (optional) */}
              <div className="space-y-1.5">
                <Label htmlFor="reorder-level">
                  Low Stock Alert Level <span className="text-xs text-muted-foreground font-normal">(optional)</span>
                </Label>
                <Input
                  id="reorder-level"
                  type="number"
                  inputMode="numeric"
                  min="0"
                  step="1"
                  placeholder="e.g. 5 (or leave blank)"
                  value={reorderLevel}
                  onChange={(e) => setReorderLevel(e.target.value)}
                  disabled={isPending}
                />
                <p className="text-[11px] text-muted-foreground">
                  Alerts when available stock drops to this level.
                </p>
              </div>
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
            <Button type="submit" disabled={isPending}>
              {isPending && <SpinnerIcon className="size-4 animate-spin mr-2" />}
              Add Item
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
