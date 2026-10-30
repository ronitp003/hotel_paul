"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { addPaymentAction } from "@/server/actions/billing.actions";
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
import { formatINR } from "@/lib/money";
import { cn } from "@/lib/utils";
import { SelectDropdown } from "@/components/ui/select-dropdown";

interface AddPaymentDialogProps {
  bookingId: string;
  bookingRef: string;
  balanceDue?: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultKind?: "PAYMENT" | "ADVANCE";
  onSuccess?: () => void;
}

export function AddPaymentDialog({
  bookingId,
  bookingRef,
  balanceDue,
  open,
  onOpenChange,
  defaultKind = "PAYMENT",
  onSuccess,
}: AddPaymentDialogProps) {
  const [isPending, startTransition] = useTransition();
  const [kind, setKind] = useState<"PAYMENT" | "ADVANCE">(defaultKind);
  const [mode, setMode] = useState<"CASH" | "UPI" | "CARD" | "BANK_TRANSFER">(
    "UPI"
  );
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

  const maxAllowed =
    balanceDue !== undefined ? Math.max(0, balanceDue) : undefined;
  const amtNum = parseFloat(amount) || 0;
  const isExceedingBalance = maxAllowed !== undefined && amtNum > maxAllowed;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isNaN(amtNum) || amtNum <= 0) {
      toast.error("Please enter a valid positive payment amount.");
      return;
    }

    if (maxAllowed !== undefined && amtNum > maxAllowed) {
      toast.error(
        `Payment amount cannot exceed remaining balance due of ${formatINR(maxAllowed)}.`
      );
      return;
    }

    startTransition(async () => {
      const res = await addPaymentAction({
        bookingId,
        kind: kind === "ADVANCE" ? "ADVANCE" : "PAYMENT",
        mode,
        amount: amtNum,
        note: note.trim() || undefined,
      });

      if (!res.ok) {
        toast.error(res.message || "Failed to record payment.");
        return;
      }

      toast.success("Payment recorded successfully.");
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
              Record Payment — {bookingRef}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Record a guest payment or advance transaction linked to this stay.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-4 text-xs">
            <div>
              <Label htmlFor="payment-kind" className="text-xs">
                Transaction Type
              </Label>
              <SelectDropdown
                id="payment-kind"
                value={kind}
                onChange={(val) => setKind(val as "PAYMENT" | "ADVANCE")}
                options={[
                  { value: "PAYMENT", label: "Stay Payment" },
                  { value: "ADVANCE", label: "Advance Deposit" },
                ]}
                size="sm"
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="payment-mode" className="text-xs">
                Payment Mode
              </Label>
              <SelectDropdown
                id="payment-mode"
                value={mode}
                onChange={(val) =>
                  setMode(val as "CASH" | "UPI" | "CARD" | "BANK_TRANSFER")
                }
                options={[
                  { value: "UPI", label: "UPI / QR Code" },
                  { value: "CASH", label: "Cash" },
                  { value: "CARD", label: "Credit / Debit Card" },
                  { value: "BANK_TRANSFER", label: "Bank Transfer / NEFT" },
                ]}
                size="sm"
                className="mt-1"
              />
            </div>

            <div>
              <div className="flex items-center justify-between">
                <Label htmlFor="payment-amt" className="text-xs">
                  Amount (₹)
                </Label>
                {maxAllowed !== undefined && (
                  <span className="text-[11px] text-muted-foreground font-medium">
                    Remaining Balance:{" "}
                    <strong className="text-foreground">
                      {formatINR(maxAllowed)}
                    </strong>
                  </span>
                )}
              </div>
              <Input
                id="payment-amt"
                type="number"
                step="0.01"
                min="0.01"
                max={maxAllowed}
                placeholder={maxAllowed !== undefined ? `Max ${maxAllowed}` : "0.00"}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className={cn(
                  "h-8 text-xs font-mono mt-1",
                  isExceedingBalance &&
                    "border-destructive focus-visible:ring-destructive"
                )}
                required
              />
              {isExceedingBalance && (
                <p className="text-[11px] text-destructive font-medium mt-1">
                  Amount cannot exceed remaining balance due of {formatINR(maxAllowed)}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="payment-note" className="text-xs">
                Reference / Note (Optional)
              </Label>
              <Input
                id="payment-note"
                placeholder="e.g. Transaction ID, GPay reference, receipt"
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
              variant="default"
              disabled={isPending || isExceedingBalance}
            >
              {isPending ? (
                <>
                  <SpinnerIcon className="size-3.5 animate-spin mr-1.5" />
                  Processing...
                </>
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

