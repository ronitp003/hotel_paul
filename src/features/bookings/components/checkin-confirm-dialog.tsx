"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { checkInReservedBookingAction } from "@/server/actions/booking.actions";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckInIcon, SpinnerIcon, RoomIcon } from "@/lib/icons";

interface CheckInConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  booking: {
    id: string;
    reference: string;
    roomNumber: string;
    roomTypeName: string;
    guestName: string;
  };
  onSuccess?: () => void;
}

export function CheckInConfirmDialog({
  open,
  onOpenChange,
  booking,
  onSuccess,
}: CheckInConfirmDialogProps) {
  const [isPending, startTransition] = useTransition();

  const handleCheckIn = () => {
    startTransition(async () => {
      const res = await checkInReservedBookingAction({
        bookingId: booking.id,
      });

      if (!res.ok) {
        toast.error(res.message || "Failed to check in guest.");
        return;
      }

      toast.success(
        `${booking.guestName} has been checked into Room ${booking.roomNumber}!`
      );
      onOpenChange(false);
      onSuccess?.();
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <CheckInIcon className="size-5" aria-hidden="true" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold">
                Check In Guest
              </DialogTitle>
              <DialogDescription className="text-xs">
                Mark reservation{" "}
                <span className="font-mono font-semibold text-foreground">
                  {booking.reference}
                </span>{" "}
                as checked in
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="py-2 space-y-3">
          <div className="p-3.5 rounded-xl bg-muted/40 border border-border space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Guest</span>
              <span className="font-bold text-foreground text-sm">
                {booking.guestName}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground flex items-center gap-1.5">
                <RoomIcon
                  className="size-3.5 text-primary"
                  aria-hidden="true"
                />
                Room
              </span>
              <span className="font-semibold text-foreground">
                Room {booking.roomNumber} ({booking.roomTypeName})
              </span>
            </div>
          </div>

          <p className="text-xs text-muted-foreground leading-relaxed">
            Confirming check-in will set the stay status to{" "}
            <strong>Occupied</strong>, record the actual check-in timestamp as
            right now, and unlock stay charges and check-out invoicing.
          </p>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
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
            type="button"
            variant="default"
            size="sm"
            onClick={handleCheckIn}
            disabled={isPending}
            className="font-semibold gap-1.5"
          >
            {isPending ? (
              <SpinnerIcon
                className="size-3.5 animate-spin"
                aria-hidden="true"
              />
            ) : (
              <CheckInIcon className="size-3.5" aria-hidden="true" />
            )}
            Confirm Check-In
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
