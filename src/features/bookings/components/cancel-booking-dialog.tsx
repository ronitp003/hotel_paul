"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { cancelBookingAction } from "@/server/actions/booking.actions";
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
import { CloseIcon, SpinnerIcon } from "@/lib/icons";

interface CancelBookingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  booking: {
    id: string;
    reference: string;
    roomNumber: string;
    guestName: string;
    totalPaid: number;
  };
  onSuccess?: () => void;
}

export function CancelBookingDialog({
  open,
  onOpenChange,
  booking,
  onSuccess,
}: CancelBookingDialogProps) {
  const [isPending, startTransition] = useTransition();
  const [reason, setReason] = useState("");

  const handleCancel = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const res = await cancelBookingAction({
        bookingId: booking.id,
        reason: reason.trim() || undefined,
      });

      if (!res.ok) {
        toast.error(res.message || "Failed to cancel booking.");
        return;
      }

      toast.success(`Booking ${booking.reference} has been cancelled.`);
      setReason("");
      onOpenChange(false);
      onSuccess?.();
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleCancel}>
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-xl bg-destructive/10 text-destructive flex items-center justify-center shrink-0">
                <CloseIcon className="size-5" aria-hidden="true" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold">
                  Cancel Reservation
                </DialogTitle>
                <DialogDescription className="text-xs">
                  Booking{" "}
                  <span className="font-mono font-semibold text-foreground">
                    {booking.reference}
                  </span>{" "}
                  for {booking.guestName}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="py-4 space-y-4">
            {booking.totalPaid > 0 && (
              <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-900 dark:text-amber-200">
                <strong>Advance Payment on Record:</strong> ₹
                {booking.totalPaid.toLocaleString("en-IN")}. Cancelling will
                free up Room {booking.roomNumber}. Advance payments can be
                refunded from the Payments section if required.
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="cancel-reason" className="text-xs font-semibold">
                Reason for Cancellation (optional)
              </Label>
              <Input
                id="cancel-reason"
                placeholder="e.g. Guest called to cancel, change of plans"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                disabled={isPending}
                className="text-xs"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Keep Reservation
            </Button>
            <Button
              type="submit"
              variant="destructive"
              size="sm"
              disabled={isPending}
              className="gap-1.5"
            >
              {isPending ? (
                <SpinnerIcon
                  className="size-3.5 animate-spin"
                  aria-hidden="true"
                />
              ) : (
                <CloseIcon className="size-3.5" aria-hidden="true" />
              )}
              Confirm Cancellation
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
