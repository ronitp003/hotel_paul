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
import { toast } from "sonner";

interface AddItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
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

export function AddItemDialog({ open, onOpenChange }: AddItemDialogProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [name, setName] = useState("");
  const [unitSelection, setUnitSelection] = useState("pcs");
  const [customUnit, setCustomUnit] = useState("");
  const [reorderLevel, setReorderLevel] = useState("10");
  const [initialQtyStore, setInitialQtyStore] = useState("0");
  const [error, setError] = useState<string | null>(null);

  const resetForm = () => {
    setName("");
    setUnitSelection("pcs");
    setCustomUnit("");
    setReorderLevel("10");
    setInitialQtyStore("0");
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
      setError("Please specify a unit.");
      return;
    }

    const reorderVal = parseInt(reorderLevel, 10);
    if (isNaN(reorderVal) || reorderVal < 0) {
      setError("Reorder level must be a non-negative number.");
      return;
    }

    const initialQtyVal = parseInt(initialQtyStore, 10);
    if (isNaN(initialQtyVal) || initialQtyVal < 0) {
      setError("Initial store stock cannot be negative.");
      return;
    }

    startTransition(async () => {
      const res = await createInventoryItemAction({
        name: trimmedName,
        unit: resolvedUnit,
        reorderLevel: reorderVal,
        initialQtyStore: initialQtyVal,
      });

      if (!res.ok) {
        setError(res.message || "Failed to create inventory item.");
        return;
      }

      toast.success(`Inventory item "${trimmedName}" created successfully.`);
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
              Create a new tracked inventory item (e.g. Towels, Bedsheets, Remotes, Water Bottles).
            </DialogDescription>
          </DialogHeader>

          {error && (
            <Alert variant="destructive">
              <ProblemIcon className="size-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-3 py-1">
            <div className="space-y-1.5">
              <Label htmlFor="item-name">
                Item Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="item-name"
                placeholder="e.g. Double Bedsheets, Bath Towel, TV Remote"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isPending}
                required
                maxLength={100}
                autoFocus
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="item-unit">Unit of Measure</Label>
                <SelectDropdown
                  value={unitSelection}
                  onChange={(val) => setUnitSelection(val)}
                  options={COMMON_UNITS}
                  disabled={isPending}
                />
              </div>

              {unitSelection === "custom" && (
                <div className="space-y-1.5">
                  <Label htmlFor="custom-unit">Custom Unit</Label>
                  <Input
                    id="custom-unit"
                    placeholder="e.g. packs, liters"
                    value={customUnit}
                    onChange={(e) => setCustomUnit(e.target.value)}
                    disabled={isPending}
                    maxLength={20}
                    required
                  />
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div className="space-y-1.5">
                <Label htmlFor="reorder-level">
                  Reorder Level <span className="text-xs text-muted-foreground font-normal">(Alert trigger)</span>
                </Label>
                <Input
                  id="reorder-level"
                  type="number"
                  inputMode="numeric"
                  min="0"
                  step="1"
                  value={reorderLevel}
                  onChange={(e) => setReorderLevel(e.target.value)}
                  disabled={isPending}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Flagged as Low Stock if store stock drops to or below this.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="initial-stock">Initial Store Stock</Label>
                <Input
                  id="initial-stock"
                  type="number"
                  inputMode="numeric"
                  min="0"
                  step="1"
                  value={initialQtyStore}
                  onChange={(e) => setInitialQtyStore(e.target.value)}
                  disabled={isPending}
                />
                <p className="text-xs text-muted-foreground">
                  Current stock physically present in the store room.
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
              Create Item
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
