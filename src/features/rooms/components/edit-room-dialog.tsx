"use client";

import { useState } from "react";
import { useForm } from "@tanstack/react-form";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { roomSchema } from "../schemas";
import {
  updateRoomAction,
  deleteRoomAction,
} from "@/server/actions/room.actions";
import { CircleAlertIcon, LoaderIcon, RoomIcon, DeleteIcon } from "@/lib/icons";
import type { RoomWithStatus } from "@/server/services/room.service";

interface RoomTypeOption {
  id: string;
  name: string;
}

interface EditRoomDialogProps {
  room: RoomWithStatus | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roomTypes: RoomTypeOption[];
  onSuccess?: () => void;
}

export function EditRoomDialog({
  room,
  open,
  onOpenChange,
  roomTypes,
  onSuccess,
}: EditRoomDialogProps) {
  const [actionError, setActionError] = useState<string | null>(null);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const editForm = useForm({
    defaultValues: {
      number: room?.number ?? "",
      typeId: room?.typeId ?? roomTypes[0]?.id ?? "",
      pricePerNight: room?.pricePerNight ?? 2000,
      isActive: room?.isActive ?? true,
    },
    validators: {
      onSubmit: ({ value }) => {
        const parsed = roomSchema.safeParse(value);
        if (!parsed.success) {
          return parsed.error.issues[0]?.message;
        }
      },
    },
    onSubmit: async ({ value }) => {
      if (!room) return;
      setActionError(null);
      const res = await updateRoomAction(room.id, value);
      if (!res.ok) {
        setActionError(res.message || "Failed to update room.");
        return;
      }
      toast.success(`Room ${value.number} updated successfully.`);
      onOpenChange(false);
      onSuccess?.();
    },
  });

  const handleDelete = async () => {
    if (!room) return;
    setActionError(null);
    setIsDeleting(true);
    const res = await deleteRoomAction(room.id);
    setIsDeleting(false);
    if (!res.ok) {
      setActionError(res.message || "Failed to delete room.");
      setIsDeleteConfirmOpen(false);
      return;
    }
    toast.success(`Room ${room.number} deleted successfully.`);
    setIsDeleteConfirmOpen(false);
    onOpenChange(false);
    onSuccess?.();
  };

  if (!room) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <RoomIcon className="size-5" aria-hidden="true" />
            </div>
            <div className="space-y-0.5">
              <DialogTitle className="text-xl">
                Edit Room {room.number}
              </DialogTitle>
              <DialogDescription>
                Modify room number, assigned category, and standard pricing.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {actionError && (
          <Alert variant="destructive">
            <CircleAlertIcon className="h-4 w-4" />
            <AlertDescription>{actionError}</AlertDescription>
          </Alert>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            editForm.handleSubmit();
          }}
          className="space-y-4 pt-1"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <editForm.Field name="number">
              {(field) => (
                <div className="space-y-1.5">
                  <Label
                    htmlFor="edit-room-number"
                    className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                  >
                    Room Number *
                  </Label>
                  <Input
                    id="edit-room-number"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    className="h-10 font-mono text-base font-bold"
                  />
                </div>
              )}
            </editForm.Field>

            <editForm.Field name="typeId">
              {(field) => (
                <div className="space-y-1.5">
                  <Label
                    htmlFor="edit-room-type"
                    className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                  >
                    Room Type *
                  </Label>
                  <select
                    id="edit-room-type"
                    className="flex h-10 w-full rounded-md border border-input bg-card px-3 py-2 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring text-foreground"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                  >
                    {roomTypes.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </editForm.Field>
          </div>

          <editForm.Field name="pricePerNight">
            {(field) => (
              <div className="space-y-1.5">
                <Label
                  htmlFor="edit-room-price"
                  className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                >
                  Base Price / Night (₹) *
                </Label>
                <Input
                  id="edit-room-price"
                  type="number"
                  step="50"
                  min="0"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) =>
                    field.handleChange(parseFloat(e.target.value) || 0)
                  }
                  className="h-10 font-mono"
                />
              </div>
            )}
          </editForm.Field>

          <editForm.Field name="isActive">
            {(field) => (
              <div className="flex items-center justify-between rounded-xl border border-border bg-muted/30 p-3.5 transition-colors">
                <div className="space-y-0.5 pr-4">
                  <Label
                    htmlFor="edit-room-active"
                    className="text-sm font-semibold text-foreground cursor-pointer"
                  >
                    Active in Inventory
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    When active, this room is visible on the front desk and
                    bookable for guests.
                  </p>
                </div>
                <Switch
                  id="edit-room-active"
                  checked={field.state.value}
                  onCheckedChange={field.handleChange}
                />
              </div>
            )}
          </editForm.Field>

          <DialogFooter className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-2.5">
            <Button
              type="button"
              variant="destructive"
              size="sm"
              className="gap-1.5 w-full sm:w-auto"
              onClick={() => setIsDeleteConfirmOpen(true)}
            >
              <DeleteIcon className="size-4" aria-hidden="true" />
              <span>Delete Room</span>
            </Button>

            <div className="flex items-center justify-end gap-2 w-full sm:w-auto">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <editForm.Subscribe
                selector={(state) => [state.canSubmit, state.isSubmitting]}
              >
                {([canSubmit, isSubmitting]) => (
                  <Button
                    type="submit"
                    size="sm"
                    disabled={!canSubmit || isSubmitting}
                  >
                    {isSubmitting && (
                      <LoaderIcon className="h-4 w-4 animate-spin mr-1.5" />
                    )}
                    Save Changes
                  </Button>
                )}
              </editForm.Subscribe>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>

      {/* Delete Confirmation Alert Dialog */}
      <AlertDialog
        open={isDeleteConfirmOpen}
        onOpenChange={setIsDeleteConfirmOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Room {room.number}?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete Room{" "}
              <strong>{room.number}</strong>? This action permanently removes
              the room from inventory. Rooms with historical bookings,
              maintenance records, or problems cannot be deleted and should be
              disabled instead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            >
              {isDeleting && (
                <LoaderIcon className="size-4 animate-spin mr-1.5" />
              )}
              Confirm Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
