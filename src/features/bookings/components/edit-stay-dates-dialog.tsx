"use client";

import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
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
import { DateInput } from "@/components/ui/date-input";
import { CalendarIcon, SpinnerIcon, ProblemIcon } from "@/lib/icons";
import { toISTInputString, fromISTInput } from "@/lib/datetime";
import { calculateStay } from "@/lib/stay";
import { updateBookingDatesAction } from "@/server/actions/booking.actions";

interface EditStayDatesDialogProps {
  bookingId: string;
  bookingRef: string;
  roomNumber: string;
  checkInAt: Date | string;
  checkOutAt: Date | string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

interface EditStayDatesFormProps {
  bookingId: string;
  bookingRef: string;
  roomNumber: string;
  checkInAt: Date | string;
  checkOutAt: Date | string;
  onClose: () => void;
  onSuccess?: () => void;
}

function EditStayDatesForm({
  bookingId,
  bookingRef,
  roomNumber,
  checkInAt,
  checkOutAt,
  onClose,
  onSuccess,
}: EditStayDatesFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const initialCheckInStr = useMemo(() => {
    return toISTInputString(new Date(checkInAt));
  }, [checkInAt]);

  const initialCheckOutStr = useMemo(() => {
    return toISTInputString(new Date(checkOutAt));
  }, [checkOutAt]);

  const [checkInDate, setCheckInDate] = useState(initialCheckInStr.slice(0, 10));
  const [checkInTime, setCheckInTime] = useState(initialCheckInStr.slice(11, 16));
  const [checkOutDate, setCheckOutDate] = useState(initialCheckOutStr.slice(0, 10));
  const [checkOutTime, setCheckOutTime] = useState(initialCheckOutStr.slice(11, 16));

  // Compute live duration
  const stayDuration = useMemo(() => {
    try {
      const inDate = fromISTInput(`${checkInDate}T${checkInTime || "12:00"}`);
      const outDate = fromISTInput(`${checkOutDate}T${checkOutTime || "12:00"}`);
      if (isNaN(inDate.getTime()) || isNaN(outDate.getTime())) return null;
      if (outDate <= inDate) return null;
      return calculateStay(inDate, outDate);
    } catch {
      return null;
    }
  }, [checkInDate, checkInTime, checkOutDate, checkOutTime]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      const inDate = fromISTInput(`${checkInDate}T${checkInTime || "12:00"}`);
      const outDate = fromISTInput(`${checkOutDate}T${checkOutTime || "12:00"}`);

      if (isNaN(inDate.getTime()) || isNaN(outDate.getTime())) {
        setError("Please enter valid dates and times.");
        return;
      }

      if (outDate.getTime() <= inDate.getTime()) {
        setError("Check-out date/time must be strictly after check-in date/time.");
        return;
      }

      startTransition(async () => {
        const res = await updateBookingDatesAction({
          bookingId,
          checkInAt: inDate,
          checkOutAt: outDate,
        });

        if (!res.ok) {
          setError(res.message || "Failed to update stay dates.");
          return;
        }

        toast.success("Stay dates updated successfully. Tariff and bill updated.");
        onClose();
        router.refresh();
        onSuccess?.();
      });
    } catch {
      setError("An unexpected error occurred while parsing dates.");
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2 text-base text-foreground">
          <CalendarIcon className="size-4 text-primary" />
          Modify Stay Dates — Room {roomNumber}
        </DialogTitle>
        <DialogDescription className="text-xs text-muted-foreground">
          Adjust check-in and check-out dates for booking{" "}
          <strong className="font-mono text-foreground">{bookingRef}</strong>. Stay days and room tariff will automatically recalculate.
        </DialogDescription>
      </DialogHeader>

      {error && (
        <div className="flex items-center gap-2 p-3 mt-3 bg-destructive/10 border border-destructive/30 rounded-lg text-xs text-destructive">
          <ProblemIcon className="size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="py-4 space-y-4">
        {/* Check-In Section */}
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-foreground">
            Check-In Date & Time
          </Label>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label htmlFor="edit-checkin-date" className="text-[11px] text-muted-foreground">
                Date (DD/MM/YYYY)
              </Label>
              <DateInput
                id="edit-checkin-date"
                value={checkInDate}
                onChange={setCheckInDate}
                className="h-8 text-xs mt-1"
                required
              />
            </div>
            <div>
              <Label htmlFor="edit-checkin-time" className="text-[11px] text-muted-foreground">
                Time
              </Label>
              <Input
                id="edit-checkin-time"
                type="time"
                value={checkInTime}
                onChange={(e) => setCheckInTime(e.target.value)}
                className="h-8 text-xs mt-1"
                required
              />
            </div>
          </div>
        </div>

        {/* Check-Out Section */}
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-foreground">
            Check-Out Date & Time
          </Label>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label htmlFor="edit-checkout-date" className="text-[11px] text-muted-foreground">
                Date (DD/MM/YYYY)
              </Label>
              <DateInput
                id="edit-checkout-date"
                value={checkOutDate}
                onChange={setCheckOutDate}
                className="h-8 text-xs mt-1"
                required
              />
            </div>
            <div>
              <Label htmlFor="edit-checkout-time" className="text-[11px] text-muted-foreground">
                Time
              </Label>
              <Input
                id="edit-checkout-time"
                type="time"
                value={checkOutTime}
                onChange={(e) => setCheckOutTime(e.target.value)}
                className="h-8 text-xs mt-1"
                required
              />
            </div>
          </div>
        </div>

        {/* Calculated duration feedback */}
        <div className="bg-muted/50 p-3 rounded-lg border border-border/80 flex items-center justify-between text-xs">
          <span className="text-muted-foreground font-medium">
            New Calculated Stay:
          </span>
          <span className="font-bold text-foreground font-mono">
            {stayDuration ? (
              `${stayDuration.days} day${stayDuration.days > 1 ? "s" : ""} (${stayDuration.hours}h)`
            ) : (
              <span className="text-destructive font-normal">Invalid date range</span>
            )}
          </span>
        </div>
      </div>

      <DialogFooter className="gap-2 sm:gap-0">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onClose}
          disabled={isPending}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          size="sm"
          disabled={isPending || !stayDuration}
        >
          {isPending ? (
            <>
              <SpinnerIcon className="size-3.5 animate-spin mr-1.5" />
              Saving...
            </>
          ) : (
            "Save & Recalculate Bill"
          )}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function EditStayDatesDialog({
  bookingId,
  bookingRef,
  roomNumber,
  checkInAt,
  checkOutAt,
  open,
  onOpenChange,
  onSuccess,
}: EditStayDatesDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {open && (
          <EditStayDatesForm
            bookingId={bookingId}
            bookingRef={bookingRef}
            roomNumber={roomNumber}
            checkInAt={checkInAt}
            checkOutAt={checkOutAt}
            onClose={() => onOpenChange(false)}
            onSuccess={onSuccess}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
