"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { addChargeAction } from "@/server/actions/billing.actions";
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
import { AddIcon, SpinnerIcon } from "@/lib/icons";

interface AddChargeDialogProps {
  bookingId: string;
  bookingRef: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function AddChargeDialog({
  bookingId,
  bookingRef,
  open,
  onOpenChange,
  onSuccess,
}: AddChargeDialogProps) {
  const [isPending, startTransition] = useTransition();
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [isTaxable, setIsTaxable] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amtNum = parseFloat(amount);
    if (!description.trim()) {
      toast.error("Please enter charge description.");
      return;
    }
    if (isNaN(amtNum) || amtNum <= 0) {
      toast.error("Please enter a valid positive amount.");
      return;
    }

    startTransition(async () => {
      const res = await addChargeAction({
        bookingId,
        description: description.trim(),
        amount: amtNum,
        isTaxable,
      });

      if (!res.ok) {
        toast.error(res.message || "Failed to add charge.");
        return;
      }

      toast.success("Charge added successfully.");
      setDescription("");
      setAmount("");
      setIsTaxable(false);
      onOpenChange(false);
      onSuccess?.();
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <AddIcon className="size-4 text-primary" />
              Add Charge — {bookingRef}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Add extra service charges (food, laundry, extra mattress) to this stay.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-4 text-xs">
            <div>
              <Label htmlFor="charge-desc" className="text-xs">
                Description
              </Label>
              <Input
                id="charge-desc"
                placeholder="e.g. Dinner Service, Laundry, Extra Towels"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="h-8 text-xs mt-1"
                required
              />
            </div>

            <div>
              <Label htmlFor="charge-amount" className="text-xs">
                Amount (₹)
              </Label>
              <Input
                id="charge-amount"
                type="number"
                step="0.01"
                min="0.01"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="h-8 text-xs font-mono mt-1"
                required
              />
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="charge-is-taxable"
                checked={isTaxable}
                onChange={(e) => setIsTaxable(e.target.checked)}
                className="size-4 rounded border-border text-primary cursor-pointer"
              />
              <label htmlFor="charge-is-taxable" className="text-xs text-foreground cursor-pointer">
                Subject to GST (Taxable service)
              </label>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={isPending}>
              {isPending ? (
                <>
                  <SpinnerIcon className="size-3.5 animate-spin mr-1.5" />
                  Adding...
                </>
              ) : (
                "Add Charge"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
