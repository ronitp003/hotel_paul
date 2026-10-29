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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { roomSchema } from "../schemas";
import { updateRoomAction } from "@/server/actions/room.actions";
import { CircleAlertIcon, LoaderIcon, RoomIcon } from "@/lib/icons";
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

  if (!room) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <RoomIcon className="size-4" aria-hidden="true" />
            </div>
            <div>
              <DialogTitle>Edit Room {room.number}</DialogTitle>
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
          className="space-y-4"
        >
          <div className="grid grid-cols-2 gap-4">
            <editForm.Field name="number">
              {(field) => (
                <div className="space-y-1.5">
                  <Label htmlFor="edit-room-number">Room Number *</Label>
                  <Input
                    id="edit-room-number"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                </div>
              )}
            </editForm.Field>

            <editForm.Field name="typeId">
              {(field) => (
                <div className="space-y-1.5">
                  <Label htmlFor="edit-room-type">Room Type *</Label>
                  <select
                    id="edit-room-type"
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
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

          <div className="grid grid-cols-2 gap-4 items-center">
            <editForm.Field name="pricePerNight">
              {(field) => (
                <div className="space-y-1.5">
                  <Label htmlFor="edit-room-price">Base Price / Night (₹) *</Label>
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
                  />
                </div>
              )}
            </editForm.Field>

            <editForm.Field name="isActive">
              {(field) => (
                <div className="flex items-center justify-between pt-6 pr-2">
                  <Label htmlFor="edit-room-active" className="cursor-pointer">
                    Active Status
                  </Label>
                  <Switch
                    id="edit-room-active"
                    checked={field.state.value}
                    onCheckedChange={field.handleChange}
                  />
                </div>
              )}
            </editForm.Field>
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <editForm.Subscribe
              selector={(state) => [state.canSubmit, state.isSubmitting]}
            >
              {([canSubmit, isSubmitting]) => (
                <Button type="submit" disabled={!canSubmit || isSubmitting}>
                  {isSubmitting && <LoaderIcon className="h-4 w-4 animate-spin mr-2" />}
                  Save Changes
                </Button>
              )}
            </editForm.Subscribe>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
