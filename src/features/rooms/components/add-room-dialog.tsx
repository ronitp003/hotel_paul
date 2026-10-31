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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { SelectDropdown } from "@/components/ui/select-dropdown";
import { roomSchema, bulkRoomsSchema } from "../schemas";
import {
  createRoomAction,
  bulkCreateRoomsAction,
} from "@/server/actions/room.actions";
import { formatINR } from "@/lib/money";
import { CircleAlertIcon, LoaderIcon, RoomIcon } from "@/lib/icons";

interface RoomTypeOption {
  id: string;
  name: string;
}

interface AddRoomDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roomTypes: RoomTypeOption[];
  onSuccess?: () => void;
}

export function AddRoomDialog({
  open,
  onOpenChange,
  roomTypes,
  onSuccess,
}: AddRoomDialogProps) {
  const [activeTab, setActiveTab] = useState<"single" | "bulk">("single");
  const [actionError, setActionError] = useState<string | null>(null);

  const defaultTypeId = roomTypes[0]?.id || "";

  // Single Room Form
  const singleForm = useForm({
    defaultValues: {
      number: "",
      typeId: defaultTypeId,
      pricePerNight: 2000,
      isActive: true,
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
      setActionError(null);
      const res = await createRoomAction(value);
      if (!res.ok) {
        setActionError(res.message || "Failed to create room.");
        return;
      }
      toast.success(`Room ${value.number} created successfully.`);
      onOpenChange(false);
      singleForm.reset();
      onSuccess?.();
    },
  });

  // Bulk Rooms Form
  const bulkForm = useForm({
    defaultValues: {
      prefix: "",
      startNumber: 101,
      endNumber: 110,
      typeId: defaultTypeId,
      pricePerNight: 2000,
      isActive: true,
    },
    validators: {
      onSubmit: ({ value }) => {
        const parsed = bulkRoomsSchema.safeParse(value);
        if (!parsed.success) {
          return parsed.error.issues[0]?.message;
        }
      },
    },
    onSubmit: async ({ value }) => {
      setActionError(null);
      const res = await bulkCreateRoomsAction(value);
      if (!res.ok) {
        setActionError(res.message || "Failed to bulk create rooms.");
        return;
      }
      const data = res.data as { count: number };
      toast.success(`Successfully created ${data?.count ?? "multiple"} rooms.`);
      onOpenChange(false);
      bulkForm.reset();
      onSuccess?.();
    },
  });

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
                Add Rooms to Inventory
              </DialogTitle>
              <DialogDescription>
                Create an individual room or add an entire floor/range in bulk.
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

        <Tabs
          value={activeTab}
          onValueChange={(val) => {
            setActionError(null);
            setActiveTab(val as "single" | "bulk");
          }}
          className="w-full"
        >
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="single">Single Room</TabsTrigger>
            <TabsTrigger value="bulk">Bulk by Range</TabsTrigger>
          </TabsList>

          {/* Single Room Tab */}
          <TabsContent value="single" className="space-y-4 pt-3">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                e.stopPropagation();
                singleForm.handleSubmit();
              }}
              className="space-y-4"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <singleForm.Field name="number">
                  {(field) => (
                    <div className="space-y-1.5">
                      <Label
                        htmlFor="single-room-number"
                        className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                      >
                        Room Number *
                      </Label>
                      <Input
                        id="single-room-number"
                        placeholder="e.g. 101, 204"
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e) => field.handleChange(e.target.value)}
                        className="h-10 font-mono text-base font-bold"
                        autoFocus
                      />
                    </div>
                  )}
                </singleForm.Field>

                <singleForm.Field name="typeId">
                  {(field) => (
                    <div className="space-y-1.5">
                      <Label
                        htmlFor="single-room-type"
                        className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                      >
                        Room Type *
                      </Label>
                      <SelectDropdown
                        id="single-room-type"
                        value={field.state.value}
                        onChange={(val) => field.handleChange(val)}
                        options={roomTypes.map((t) => ({
                          value: t.id,
                          label: t.name,
                        }))}
                        placeholder="Select room type..."
                        className="h-10 w-full"
                      />
                    </div>
                  )}
                </singleForm.Field>
              </div>

              <singleForm.Field name="pricePerNight">
                {(field) => (
                  <div className="space-y-1.5">
                    <Label
                      htmlFor="single-room-price"
                      className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                    >
                      Base Price / Night (₹) *
                    </Label>
                    <Input
                      id="single-room-price"
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
              </singleForm.Field>

              <singleForm.Field name="isActive">
                {(field) => (
                  <div className="flex items-center justify-between rounded-xl border border-border bg-muted/30 p-3.5 transition-colors">
                    <div className="space-y-0.5 pr-4">
                      <Label
                        htmlFor="single-room-active"
                        className="text-sm font-semibold text-foreground cursor-pointer"
                      >
                        Active for Booking
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Make this room immediately available on the front desk
                        for guest check-ins.
                      </p>
                    </div>
                    <Switch
                      id="single-room-active"
                      checked={field.state.value}
                      onCheckedChange={field.handleChange}
                    />
                  </div>
                )}
              </singleForm.Field>

              <DialogFooter className="pt-2 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                >
                  Cancel
                </Button>
                <singleForm.Subscribe
                  selector={(state) => [state.canSubmit, state.isSubmitting]}
                >
                  {([canSubmit, isSubmitting]) => (
                    <Button type="submit" disabled={!canSubmit || isSubmitting}>
                      {isSubmitting && (
                        <LoaderIcon className="h-4 w-4 animate-spin mr-1.5" />
                      )}
                      Create Room
                    </Button>
                  )}
                </singleForm.Subscribe>
              </DialogFooter>
            </form>
          </TabsContent>

          {/* Bulk Range Tab */}
          <TabsContent value="bulk" className="space-y-4 pt-3">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                e.stopPropagation();
                bulkForm.handleSubmit();
              }}
              className="space-y-4"
            >
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <bulkForm.Field name="prefix">
                  {(field) => (
                    <div className="space-y-1.5">
                      <Label
                        htmlFor="bulk-prefix"
                        className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                      >
                        Prefix (Optional)
                      </Label>
                      <Input
                        id="bulk-prefix"
                        placeholder="e.g. R- or G"
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e) => field.handleChange(e.target.value)}
                        className="h-10 font-mono"
                      />
                    </div>
                  )}
                </bulkForm.Field>

                <bulkForm.Field name="startNumber">
                  {(field) => (
                    <div className="space-y-1.5">
                      <Label
                        htmlFor="bulk-start"
                        className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                      >
                        Start No. *
                      </Label>
                      <Input
                        id="bulk-start"
                        type="number"
                        min="1"
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e) =>
                          field.handleChange(parseInt(e.target.value, 10) || 1)
                        }
                        className="h-10 font-mono"
                      />
                    </div>
                  )}
                </bulkForm.Field>

                <bulkForm.Field name="endNumber">
                  {(field) => (
                    <div className="space-y-1.5">
                      <Label
                        htmlFor="bulk-end"
                        className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                      >
                        End No. *
                      </Label>
                      <Input
                        id="bulk-end"
                        type="number"
                        min="1"
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e) =>
                          field.handleChange(parseInt(e.target.value, 10) || 1)
                        }
                        className="h-10 font-mono"
                      />
                    </div>
                  )}
                </bulkForm.Field>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <bulkForm.Field name="typeId">
                  {(field) => (
                    <div className="space-y-1.5">
                      <Label
                        htmlFor="bulk-type"
                        className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                      >
                        Room Type *
                      </Label>
                      <SelectDropdown
                        id="bulk-type"
                        value={field.state.value}
                        onChange={(val) => field.handleChange(val)}
                        options={roomTypes.map((t) => ({
                          value: t.id,
                          label: t.name,
                        }))}
                        placeholder="Select room type..."
                        className="h-10 w-full"
                      />
                    </div>
                  )}
                </bulkForm.Field>

                <bulkForm.Field name="pricePerNight">
                  {(field) => (
                    <div className="space-y-1.5">
                      <Label
                        htmlFor="bulk-price"
                        className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                      >
                        Price / Night (₹) *
                      </Label>
                      <Input
                        id="bulk-price"
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
                </bulkForm.Field>
              </div>

              {/* Dynamic Range Preview */}
              <bulkForm.Subscribe
                selector={(state) => [
                  state.values.prefix,
                  state.values.startNumber,
                  state.values.endNumber,
                  state.values.pricePerNight,
                ]}
              >
                {([prefix, start, end, price]) => {
                  const s = Number(start);
                  const e = Number(end);
                  const count = e >= s ? e - s + 1 : 0;
                  const sampleList =
                    count > 0 && count <= 8
                      ? Array.from(
                          { length: count },
                          (_, i) => `${prefix || ""}${s + i}`
                        ).join(", ")
                      : count > 8
                        ? `${prefix || ""}${s}, ${prefix || ""}${s + 1}, ... ${prefix || ""}${e}`
                        : "";

                  return (
                    <div className="rounded-xl bg-muted/40 border border-border p-3.5 text-xs space-y-1.5">
                      <div className="flex justify-between font-medium text-foreground">
                        <span className="text-muted-foreground font-semibold">
                          Batch Creation Preview:
                        </span>
                        <span className="font-bold text-primary">
                          {count} Rooms will be created
                        </span>
                      </div>
                      {count > 0 ? (
                        <p className="text-muted-foreground leading-relaxed">
                          Rooms:{" "}
                          <span className="font-mono font-semibold text-foreground">
                            {sampleList}
                          </span>
                          {" • "}Each configured at{" "}
                          <span className="font-mono font-semibold text-foreground">
                            {formatINR(price || 0)}
                          </span>
                          /night
                        </p>
                      ) : (
                        <p className="text-destructive font-medium">
                          End number must be greater than or equal to start
                          number.
                        </p>
                      )}
                    </div>
                  );
                }}
              </bulkForm.Subscribe>

              <DialogFooter className="pt-2 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                >
                  Cancel
                </Button>
                <bulkForm.Subscribe
                  selector={(state) => [state.canSubmit, state.isSubmitting]}
                >
                  {([canSubmit, isSubmitting]) => (
                    <Button type="submit" disabled={!canSubmit || isSubmitting}>
                      {isSubmitting && (
                        <LoaderIcon className="h-4 w-4 animate-spin mr-1.5" />
                      )}
                      Bulk Create Rooms
                    </Button>
                  )}
                </bulkForm.Subscribe>
              </DialogFooter>
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
