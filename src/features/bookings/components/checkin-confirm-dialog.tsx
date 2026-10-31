"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { checkInReservedBookingAction, checkInGroupBookingAction } from "@/server/actions/booking.actions";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
    groupBookingId?: string | null;
    groupRooms?: Array<{
      id: string;
      roomNumber: string;
      roomTypeName: string;
      status: string;
    }>;
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
  const isGroup = Boolean(
    booking.groupBookingId &&
      booking.groupRooms &&
      booking.groupRooms.length > 1
  );

  const handleCheckIn = () => {
    startTransition(async () => {
      if (isGroup && booking.groupBookingId) {
        const res = await checkInGroupBookingAction({
          groupBookingId: booking.groupBookingId,
        });

        if (!res.ok) {
          toast.error(res.message || "Failed to check in group.");
          return;
        }

        const roomList = booking.groupRooms?.map((r) => r.roomNumber).join(", ") || "";
        toast.success(
          `${booking.guestName}'s group (${roomList ? `Rooms ${roomList}` : "all rooms"}) has been checked in!`
        );
        onOpenChange(false);
        onSuccess?.();
      } else {
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
      }
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
                {isGroup ? "Check In Group Reservation" : "Check In Guest"}
              </DialogTitle>
              <DialogDescription className="text-xs">
                {isGroup ? (
                  <span>
                    Mark all {booking.groupRooms?.length} rooms in group{" "}
                    <span className="font-mono font-semibold text-foreground">
                      {booking.groupBookingId}
                    </span>{" "}
                    as checked in
                  </span>
                ) : (
                  <span>
                    Mark reservation{" "}
                    <span className="font-mono font-semibold text-foreground">
                      {booking.reference}
                    </span>{" "}
                    as checked in
                  </span>
                )}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="py-2 space-y-3">
          <div className="p-3.5 rounded-xl bg-muted/40 border border-border space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Primary Guest</span>
              <span className="font-bold text-foreground text-sm">
                {booking.guestName}
              </span>
            </div>

            {isGroup && booking.groupRooms ? (
              <div className="space-y-1.5 pt-1 border-t border-border/60">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5 font-medium">
                    <RoomIcon className="size-3.5 text-primary" aria-hidden="true" />
                    Associated Rooms ({booking.groupRooms.length})
                  </span>
                  <Badge variant="secondary" className="text-[10px] uppercase font-bold">
                    Group Stay
                  </Badge>
                </div>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {booking.groupRooms.map((r) => (
                    <span
                      key={r.id}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-background border border-border/80 text-xs font-semibold text-foreground"
                    >
                      <span>Room {r.roomNumber}</span>
                      <span className="text-[10px] text-muted-foreground font-normal">
                        ({r.roomTypeName})
                      </span>
                    </span>
                  ))}
                </div>
              </div>
            ) : (
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
            )}
          </div>

          <p className="text-xs text-muted-foreground leading-relaxed">
            {isGroup
              ? `Confirming check-in will atomically check in all ${booking.groupRooms?.length} rooms belonging to this group, set their statuses to Occupied, and record the check-in time as right now.`
              : "Confirming check-in will set the stay status to Occupied, record the actual check-in timestamp as right now, and unlock stay charges and check-out invoicing."}
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
            {isGroup
              ? `Check In All ${booking.groupRooms?.length} Rooms`
              : "Confirm Check-In"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
