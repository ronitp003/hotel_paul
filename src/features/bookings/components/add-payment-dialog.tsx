"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { addPaymentAction, refundPaymentAction } from "@/server/actions/billing.actions";
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
import { PaymentIcon, SpinnerIcon } from "@/lib/icons";

interface AddPaymentDialogProps {
  bookingId: string;
  bookingRef: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultKind?: "PAYMENT" | "REFUND" | "ADVANCE";
  onSuccess?: () => void;
}

export function AddPaymentDialog({
  bookingId,
  bookingRef,
  open,
  onOpenChange,
  defaultKind = "PAYMENT",
  onSuccess,
}: AddPaymentDialogProps) {
  const [isPending, startTransition] = useTransition();
  const [kind, setKind] = useState<"PAYMENT" | "REFUND" | "ADVANCE">(defaultKind);
  const [mode, setMode] = useState<"CASH" | "UPI" | "CARD" | "BANK_TRANSFER">("UPI");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amtNum = parseFloat(amount);
    if (isNaN(amtNum) || amtNum <= 0) {
      toast.error("Please enter a valid positive payment amount.");
      return;
    }

    startTransition(async () => {
      let res;
      if (kind === "REFUND") {
        res = await refundPaymentAction({
          bookingId,
          mode,
          amount: amtNum,
          note: note.trim() || undefined,
        });
      } else {
        res = await addPaymentAction({
          bookingId,
          kind: kind === "ADVANCE" ? "ADVANCE" : "PAYMENT",
          mode,
          amount: amtNum,
          note: note.trim() || undefined,
        });
      }

      if (!res.ok) {
        toast.error(res.message || "Failed to record transaction.");
        return;
      }

      toast.success(
        kind === "REFUND"
          ? "Refund recorded successfully."
          : "Payment recorded successfully."
      );
      setAmount("");
      setNote("");
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
              <PaymentIcon className="size-4 text-primary" />
              {kind === "REFUND" ? "Issue Refund" : "Record Payment"} — {bookingRef}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Record a guest payment or refund transaction linked to this stay.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-4 text-xs">
            <div>
              <Label htmlFor="payment-kind" className="text-xs">
                Transaction Type
              </Label>
              <select
                id="payment-kind"
                value={kind}
                onChange={(e) =>
                  setKind(e.target.value as "PAYMENT" | "REFUND" | "ADVANCE")
                }
                className="flex h-8 w-full rounded-md border border-input bg-background px-3 py-1 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring mt-1 font-medium"
              >
                <option value="PAYMENT">Stay Payment</option>
                <option value="ADVANCE">Advance Deposit</option>
                <option value="REFUND">Refund</option>
              </select>
            </div>

            <div>
              <Label htmlFor="payment-mode" className="text-xs">
                Payment Mode
              </Label>
              <select
                id="payment-mode"
                value={mode}
                onChange={(e) =>
                  setMode(
                    e.target.value as
                      | "CASH"
                      | "UPI"
                      | "CARD"
                      | "BANK_TRANSFER"
                  )
                }
                className="flex h-8 w-full rounded-md border border-input bg-background px-3 py-1 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring mt-1 font-medium"
              >
                <option value="UPI">UPI / QR Code</option>
                <option value="CASH">Cash</option>
                <option value="CARD">Credit / Debit Card</option>
                <option value="BANK_TRANSFER">Bank Transfer / NEFT</option>
              </select>
            </div>

            <div>
              <Label htmlFor="payment-amt" className="text-xs">
                Amount (₹)
              </Label>
              <Input
                id="payment-amt"
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

            <div>
              <Label htmlFor="payment-note" className="text-xs">
                Reference / Note (Optional)
              </Label>
              <Input
                id="payment-note"
                placeholder="e.g. Transaction ID, GPay reference, reason"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="h-8 text-xs mt-1"
              />
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
            <Button
              type="submit"
              size="sm"
              variant={kind === "REFUND" ? "destructive" : "default"}
              disabled={isPending}
            >
              {isPending ? (
                <>
                  <SpinnerIcon className="size-3.5 animate-spin mr-1.5" />
                  Processing...
                </>
              ) : kind === "REFUND" ? (
                "Issue Refund"
              ) : (
                "Record Payment"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
