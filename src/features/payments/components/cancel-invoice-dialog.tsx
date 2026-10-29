"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { cancelInvoiceAction } from "@/server/actions/invoice.actions";
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
import { ProblemIcon, SpinnerIcon } from "@/lib/icons";

interface CancelInvoiceDialogProps {
  invoiceId: string;
  displayNo: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function CancelInvoiceDialog({
  invoiceId,
  displayNo,
  open,
  onOpenChange,
  onSuccess,
}: CancelInvoiceDialogProps) {
  const [isPending, startTransition] = useTransition();
  const [reason, setReason] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (reason.trim().length < 5) {
      toast.error("Please provide a detailed reason (at least 5 characters).");
      return;
    }

    startTransition(async () => {
      const res = await cancelInvoiceAction({
        invoiceId,
        reason: reason.trim(),
      });

      if (!res.ok) {
        toast.error(res.message || "Failed to cancel invoice.");
        return;
      }

      toast.success(`Invoice ${displayNo} has been marked as cancelled.`);
      setReason("");
      onOpenChange(false);
      onSuccess?.();
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base text-red-600 dark:text-red-400">
              <ProblemIcon className="size-4 shrink-0" />
              Cancel Invoice — {displayNo}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Cancelling an invoice is an immutable owner-level audit action.
              The original invoice record will be preserved with your reason and
              timestamp.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-3 text-xs">
            <div>
              <Label htmlFor="cancel-reason" className="text-xs">
                Reason for Cancellation (Required)
              </Label>
              <Input
                id="cancel-reason"
                placeholder="e.g. Billing rate error, duplicate invoice generated, guest dispute resolved"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="h-9 text-xs mt-1"
                required
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
              Back
            </Button>
            <Button
              type="submit"
              variant="destructive"
              size="sm"
              disabled={isPending}
            >
              {isPending ? (
                <>
                  <SpinnerIcon className="size-3.5 animate-spin mr-1.5" />
                  Cancelling...
                </>
              ) : (
                "Confirm Cancellation"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
