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
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { SpinnerIcon, EditIcon, ProblemIcon } from "@/lib/icons";
import { updateInventoryItemAction } from "@/server/actions/inventory.actions";
import type { FormattedInventoryItem } from "@/server/services/inventory.service";
import { toast } from "sonner";

interface EditItemDialogProps {
  item: FormattedInventoryItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface EditItemDialogFormProps {
  item: FormattedInventoryItem;
  onClose: () => void;
}

function EditItemDialogForm({ item, onClose }: EditItemDialogFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [name, setName] = useState(item.name);
  const [unit, setUnit] = useState(item.unit);
  const [reorderLevel, setReorderLevel] = useState(item.reorderLevel.toString());
  const [isActive, setIsActive] = useState(item.isActive);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Item name is required.");
      return;
    }

    const trimmedUnit = unit.trim();
    if (!trimmedUnit) {
      setError("Unit is required.");
      return;
    }

    const reorderVal = parseInt(reorderLevel, 10);
    if (isNaN(reorderVal) || reorderVal < 0) {
      setError("Reorder level must be a non-negative number.");
      return;
    }

    startTransition(async () => {
      const res = await updateInventoryItemAction({
        id: item.id,
        name: trimmedName,
        unit: trimmedUnit,
        reorderLevel: reorderVal,
        isActive,
      });

      if (!res.ok) {
        setError(res.message || "Failed to update inventory item.");
        return;
      }

      toast.success(`Inventory item "${trimmedName}" updated successfully.`);
      onClose();
      router.refresh();
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2 text-xl font-bold">
          <EditIcon className="size-5 text-primary" />
          Edit Inventory Item
        </DialogTitle>
        <DialogDescription>
          Update item specifications, unit of measure, reorder threshold, or active tracking status.
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
          <Label htmlFor="edit-item-name">
            Item Name <span className="text-destructive">*</span>
          </Label>
          <Input
            id="edit-item-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={isPending}
            required
            maxLength={100}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="edit-item-unit">
              Unit <span className="text-destructive">*</span>
            </Label>
            <Input
              id="edit-item-unit"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              disabled={isPending}
              required
              maxLength={20}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-reorder-level">Reorder Level</Label>
            <Input
              id="edit-reorder-level"
              type="number"
              inputMode="numeric"
              min="0"
              step="1"
              value={reorderLevel}
              onChange={(e) => setReorderLevel(e.target.value)}
              disabled={isPending}
              required
            />
          </div>
        </div>

        <div className="flex items-center justify-between rounded-lg border border-border/60 p-3 bg-muted/20">
          <div className="space-y-0.5">
            <Label htmlFor="edit-is-active" className="text-sm font-medium">
              Active for Operations
            </Label>
            <p className="text-xs text-muted-foreground">
              Inactive items are hidden from quick movement lists and alerts.
            </p>
          </div>
          <Switch
            id="edit-is-active"
            checked={isActive}
            onCheckedChange={setIsActive}
            disabled={isPending}
          />
        </div>
      </div>

      <DialogFooter className="gap-2 sm:gap-0 pt-2">
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          disabled={isPending}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending && <SpinnerIcon className="size-4 animate-spin mr-2" />}
          Save Changes
        </Button>
      </DialogFooter>
    </form>
  );
}

export function EditItemDialog({
  item,
  open,
  onOpenChange,
}: EditItemDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[460px]">
        {item && (
          <EditItemDialogForm
            key={item.id}
            item={item}
            onClose={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
