
"use client";

import { useState } from "react";
import { useForm } from "@tanstack/react-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

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

import {
  AddIcon,
  EditIcon,
  DeleteIcon,
  LoaderIcon,
  CircleAlertIcon,
  InfoIcon,
} from "@/lib/icons";

import { formatINR } from "@/lib/money";
import { gstSlabItemSchema } from "../schemas";

import {
  createGstSlabAction,
  updateGstSlabAction,
  toggleGstSlabAction,
  deleteGstSlabAction,
} from "@/server/actions/settings.actions";

export interface GstSlabItem {
  id: string;
  minRate: number;
  maxRate: number | null;
  percent: number;
  isActive: boolean;
}

interface GstSlabsManagerProps {
  initialSlabs: GstSlabItem[];
}

export function GstSlabsManager({
  initialSlabs,
}: GstSlabsManagerProps) {
  const [slabs, setSlabs] = useState<GstSlabItem[]>(initialSlabs);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingSlab, setEditingSlab] = useState<GstSlabItem | null>(null);
  const [deletingSlab, setDeletingSlab] = useState<GstSlabItem | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Form for Add Slab
  const addForm = useForm({
    defaultValues: {
      minRate:
        slabs.length > 0 && slabs[slabs.length - 1].maxRate !== null
          ? slabs[slabs.length - 1].maxRate!
          : 0,
      maxRate: null as number | null,
      percent: 18,
      isActive: true,
    },
    validators: {
      onSubmit: ({ value }) => {
        const parsed = gstSlabItemSchema.safeParse(value);

        if (!parsed.success) {
          return parsed.error.issues[0]?.message;
        }
      },
    },
    onSubmit: async ({ value }) => {
      setActionError(null);

      const res = await createGstSlabAction(value);

      if (!res.ok) {
        setActionError(res.message || "Failed to create GST slab.");
        return;
      }

      toast.success("GST slab added successfully.");
      setIsAddOpen(false);
      window.location.reload();
    },
  });

  // Form for Edit Slab
  const editForm = useForm({
    defaultValues: {
      minRate: editingSlab?.minRate ?? 0,
      maxRate: editingSlab?.maxRate ?? null,
      percent: editingSlab?.percent ?? 0,
      isActive: editingSlab?.isActive ?? true,
    },
    validators: {
      onSubmit: ({ value }) => {
        const parsed = gstSlabItemSchema.safeParse(value);

        if (!parsed.success) {
          return parsed.error.issues[0]?.message;
        }
      },
    },
    onSubmit: async ({ value }) => {
      if (!editingSlab) return;

      setActionError(null);

      const res = await updateGstSlabAction(editingSlab.id, value);

      if (!res.ok) {
        setActionError(res.message || "Failed to update GST slab.");
        return;
      }

      toast.success("GST slab updated successfully.");
      setEditingSlab(null);
      window.location.reload();
    },
  });

  // Toggle slab status
  const handleToggle = async (slab: GstSlabItem) => {
    setActionError(null);

    const newStatus = !slab.isActive;

    const res = await toggleGstSlabAction(slab.id, newStatus);

    if (!res.ok) {
      toast.error(res.message || "Cannot toggle GST slab status.");
      return;
    }

    setSlabs((prev) =>
      prev.map((s) =>
        s.id === slab.id ? { ...s, isActive: newStatus } : s
      )
    );

    toast.success(
      `GST slab ${newStatus ? "activated" : "deactivated"}.`
    );
  };

  // Delete slab
  const handleDelete = async () => {
    if (!deletingSlab) return;

    setActionError(null);

    const res = await deleteGstSlabAction(deletingSlab.id);

    if (!res.ok) {
      toast.error(res.message || "Cannot delete GST slab.");
      setDeletingSlab(null);
      return;
    }

    setSlabs((prev) =>
      prev.filter((s) => s.id !== deletingSlab.id)
    );

    toast.success("GST slab removed.");
    setDeletingSlab(null);
  };

  // Open edit dialog with selected slab values
  const handleEdit = (slab: GstSlabItem) => {
    setActionError(null);
    setEditingSlab(slab);

    editForm.setFieldValue("minRate", slab.minRate);
    editForm.setFieldValue("maxRate", slab.maxRate);
    editForm.setFieldValue("percent", slab.percent);
    editForm.setFieldValue("isActive", slab.isActive);
  };

  const getRangeText = (slab: GstSlabItem) => {
    if (slab.maxRate === null) {
      return `Above ${formatINR(slab.minRate)}`;
    }

    if (slab.minRate === 0) {
      return `Up to ${formatINR(slab.maxRate)}`;
    }

    return `${formatINR(slab.minRate)} to ${formatINR(slab.maxRate)}`;
  };

  return (
    <>
      <Card className="w-full min-w-0 overflow-hidden border-border/80 shadow-xs">
        {/* Header */}
        <CardHeader className="flex flex-col gap-3 px-4 pt-4 pb-3 sm:flex-row sm:items-center sm:justify-between sm:px-5 sm:pt-5">
          <div className="min-w-0 space-y-1">
            <CardTitle className="text-base font-semibold tracking-tight">
              GST Rate Slabs
            </CardTitle>

            <CardDescription className="text-sm leading-relaxed">
              Configurable tax percentage tiers based on actual room rate
              charged per night.
            </CardDescription>
          </div>

          <Button
            size="sm"
            className="w-full shrink-0 gap-1.5 sm:w-auto"
            onClick={() => {
              setActionError(null);
              setIsAddOpen(true);
            }}
          >
            <AddIcon className="h-4 w-4" />
            Add Slab
          </Button>
        </CardHeader>

        <CardContent className="min-w-0 space-y-4 px-4 pb-4 sm:px-5 sm:pb-5">
          {/* Action Error */}
          {actionError && !isAddOpen && !editingSlab && (
            <Alert variant="destructive" className="items-start gap-2">
              <CircleAlertIcon className="mt-0.5 h-4 w-4 shrink-0" />
              <AlertDescription className="min-w-0 break-words text-sm">
                {actionError}
              </AlertDescription>
            </Alert>
          )}

          {/* Boundary Rule */}
          <Alert className="items-start gap-2 border-border bg-muted/30 py-3 text-foreground">
            <InfoIcon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />

            <AlertDescription className="min-w-0 text-xs leading-relaxed text-muted-foreground">
              <strong className="font-semibold text-foreground">
                Boundary Rule:
              </strong>{" "}
              Slabs cover{" "}
              <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px] text-foreground">
                minRate &lt; rate ≤ maxRate
              </code>{" "}
              (with the first slab starting at ₹0 inclusive). Slabs must be
              continuous without overlaps or gaps. For example: ₹0 to ₹7,500
              is taxed at 5%, and ₹7,500.01+ is taxed at 18%.
            </AlertDescription>
          </Alert>

          {/* Desktop Table */}
          <div className="hidden overflow-hidden rounded-lg border border-border sm:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-left text-xs font-semibold text-muted-foreground">
                  <th className="px-4 py-3">
                    Room Rate Range (Per Night)
                  </th>
                  <th className="px-4 py-3">GST Rate</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-border">
                {slabs.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-4 py-10 text-center text-sm text-muted-foreground"
                    >
                      No GST slabs configured.
                    </td>
                  </tr>
                ) : (
                  slabs.map((slab) => (
                    <tr
                      key={slab.id}
                      className="transition-colors hover:bg-muted/30"
                    >
                      <td className="px-4 py-3 font-medium">
                        {getRangeText(slab)}
                      </td>

                      <td className="px-4 py-3 font-mono font-semibold tabular-nums">
                        {slab.percent}%
                      </td>

                      <td className="px-4 py-3">
                        <Badge
                          variant={slab.isActive ? "default" : "secondary"}
                          className="font-medium"
                        >
                          {slab.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1.5">
                          <Switch
                            checked={slab.isActive}
                            onCheckedChange={() => handleToggle(slab)}
                            aria-label={
                              slab.isActive
                                ? "Deactivate GST slab"
                                : "Activate GST slab"
                            }
                          />

                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            title="Edit slab"
                            aria-label="Edit slab"
                            onClick={() => handleEdit(slab)}
                          >
                            <EditIcon className="h-4 w-4" />
                          </Button>

                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                            title="Delete slab"
                            aria-label="Delete slab"
                            onClick={() => setDeletingSlab(slab)}
                          >
                            <DeleteIcon className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Slab Cards */}
          <div className="space-y-3 sm:hidden">
            {slabs.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border px-4 py-10 text-center">
                <p className="text-sm font-medium text-foreground">
                  No GST slabs configured
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Add a slab to configure your property&apos;s GST rates.
                </p>
              </div>
            ) : (
              slabs.map((slab) => (
                <div
                  key={slab.id}
                  className="min-w-0 rounded-lg border border-border bg-card p-3.5"
                >
                  <div className="flex min-w-0 items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <p className="text-xs font-medium text-muted-foreground">
                        Room Rate Range
                      </p>

                      <p className="break-words text-sm font-semibold">
                        {getRangeText(slab)}
                      </p>
                    </div>

                    <Badge
                      variant={slab.isActive ? "default" : "secondary"}
                      className="shrink-0 font-medium"
                    >
                      {slab.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </div>

                  <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
                    <div className="space-y-0.5">
                      <p className="text-xs text-muted-foreground">
                        GST Rate
                      </p>
                      <p className="font-mono text-base font-semibold tabular-nums">
                        {slab.percent}%
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <Switch
                        checked={slab.isActive}
                        onCheckedChange={() => handleToggle(slab)}
                        aria-label={
                          slab.isActive
                            ? "Deactivate GST slab"
                            : "Activate GST slab"
                        }
                      />

                      <Button
                        variant="outline"
                        size="icon"
                        className="h-9 w-9"
                        title="Edit slab"
                        aria-label="Edit slab"
                        onClick={() => handleEdit(slab)}
                      >
                        <EditIcon className="h-4 w-4" />
                      </Button>

                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 text-destructive hover:bg-destructive/10 hover:text-destructive"
                        title="Delete slab"
                        aria-label="Delete slab"
                        onClick={() => setDeletingSlab(slab)}
                      >
                        <DeleteIcon className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Add Slab Dialog */}
      <Dialog
        open={isAddOpen}
        onOpenChange={(open) => {
          setIsAddOpen(open);
          if (!open) setActionError(null);
        }}
      >
        <DialogContent className="max-h-[90dvh] w-[calc(100%-2rem)] overflow-y-auto sm:max-w-lg">
          <DialogHeader className="space-y-1.5">
            <DialogTitle>Add GST Rate Slab</DialogTitle>
            <DialogDescription className="text-sm leading-relaxed">
              Create a new tax rate tier. Slabs must be continuous with
              existing active slabs.
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              e.stopPropagation();
              addForm.handleSubmit();
            }}
            className="space-y-5"
          >
            {isAddOpen && actionError && (
              <Alert variant="destructive" className="items-start gap-2">
                <CircleAlertIcon className="mt-0.5 h-4 w-4 shrink-0" />
                <AlertDescription className="min-w-0 break-words text-sm">
                  {actionError}
                </AlertDescription>
              </Alert>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <addForm.Field name="minRate">
                {(field) => (
                  <div className="min-w-0 space-y-2">
                    <Label htmlFor="add-minRate">
                      Min Rate (₹)
                    </Label>
                    <Input
                      id="add-minRate"
                      type="number"
                      step="0.01"
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) =>
                        field.handleChange(parseFloat(e.target.value) || 0)
                      }
                      className="h-10"
                    />
                  </div>
                )}
              </addForm.Field>

              <addForm.Field name="maxRate">
                {(field) => (
                  <div className="min-w-0 space-y-2">
                    <Label htmlFor="add-maxRate">
                      Max Rate (₹)
                    </Label>
                    <Input
                      id="add-maxRate"
                      type="number"
                      step="0.01"
                      placeholder="No limit"
                      value={field.state.value ?? ""}
                      onBlur={field.handleBlur}
                      onChange={(e) => {
                        const val = e.target.value.trim();
                        field.handleChange(
                          val === "" ? null : parseFloat(val) || 0
                        );
                      }}
                      className="h-10"
                    />
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      Leave blank for no upper limit.
                    </p>
                  </div>
                )}
              </addForm.Field>
            </div>

            <addForm.Field name="percent">
              {(field) => (
                <div className="min-w-0 space-y-2">
                  <Label htmlFor="add-percent">
                    GST Percentage (%)
                  </Label>
                  <Input
                    id="add-percent"
                    type="number"
                    step="0.01"
                    min={0}
                    max={100}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) =>
                      field.handleChange(parseFloat(e.target.value) || 0)
                    }
                    className="h-10"
                  />
                </div>
              )}
            </addForm.Field>

            <DialogFooter className="flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:gap-2">
              <Button
                type="button"
                variant="outline"
                className="w-full sm:w-auto"
                onClick={() => setIsAddOpen(false)}
              >
                Cancel
              </Button>

              <addForm.Subscribe
                selector={(state) => [state.canSubmit, state.isSubmitting]}
              >
                {([canSubmit, isSubmitting]) => (
                  <Button
                    type="submit"
                    disabled={!canSubmit || isSubmitting}
                    className="w-full sm:w-auto"
                  >
                    {isSubmitting && (
                      <LoaderIcon className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Add GST Slab
                  </Button>
                )}
              </addForm.Subscribe>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Slab Dialog */}
      <Dialog
        open={Boolean(editingSlab)}
        onOpenChange={(open) => {
          if (!open) {
            setEditingSlab(null);
            setActionError(null);
          }
        }}
      >
        <DialogContent className="max-h-[90dvh] w-[calc(100%-2rem)] overflow-y-auto sm:max-w-lg">
          <DialogHeader className="space-y-1.5">
            <DialogTitle>Edit GST Rate Slab</DialogTitle>
            <DialogDescription className="text-sm leading-relaxed">
              Modify tier limits or GST percentage. Active slabs must remain
              continuous.
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              e.stopPropagation();
              editForm.handleSubmit();
            }}
            className="space-y-5"
          >
            {editingSlab && actionError && (
              <Alert variant="destructive" className="items-start gap-2">
                <CircleAlertIcon className="mt-0.5 h-4 w-4 shrink-0" />
                <AlertDescription className="min-w-0 break-words text-sm">
                  {actionError}
                </AlertDescription>
              </Alert>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <editForm.Field name="minRate">
                {(field) => (
                  <div className="min-w-0 space-y-2">
                    <Label htmlFor="edit-minRate">
                      Min Rate (₹)
                    </Label>
                    <Input
                      id="edit-minRate"
                      type="number"
                      step="0.01"
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) =>
                        field.handleChange(parseFloat(e.target.value) || 0)
                      }
                      className="h-10"
                    />
                  </div>
                )}
              </editForm.Field>

              <editForm.Field name="maxRate">
                {(field) => (
                  <div className="min-w-0 space-y-2">
                    <Label htmlFor="edit-maxRate">
                      Max Rate (₹)
                    </Label>
                    <Input
                      id="edit-maxRate"
                      type="number"
                      step="0.01"
                      placeholder="No limit"
                      value={field.state.value ?? ""}
                      onBlur={field.handleBlur}
                      onChange={(e) => {
                        const val = e.target.value.trim();
                        field.handleChange(
                          val === "" ? null : parseFloat(val) || 0
                        );
                      }}
                      className="h-10"
                    />
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      Leave blank for no upper limit.
                    </p>
                  </div>
                )}
              </editForm.Field>
            </div>

            <editForm.Field name="percent">
              {(field) => (
                <div className="min-w-0 space-y-2">
                  <Label htmlFor="edit-percent">
                    GST Percentage (%)
                  </Label>
                  <Input
                    id="edit-percent"
                    type="number"
                    step="0.01"
                    min={0}
                    max={100}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) =>
                      field.handleChange(parseFloat(e.target.value) || 0)
                    }
                    className="h-10"
                  />
                </div>
              )}
            </editForm.Field>

            <DialogFooter className="flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:gap-2">
              <Button
                type="button"
                variant="outline"
                className="w-full sm:w-auto"
                onClick={() => setEditingSlab(null)}
              >
                Cancel
              </Button>

              <editForm.Subscribe
                selector={(state) => [state.canSubmit, state.isSubmitting]}
              >
                {([canSubmit, isSubmitting]) => (
                  <Button
                    type="submit"
                    disabled={!canSubmit || isSubmitting}
                    className="w-full sm:w-auto"
                  >
                    {isSubmitting && (
                      <LoaderIcon className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Save Changes
                  </Button>
                )}
              </editForm.Subscribe>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog
        open={Boolean(deletingSlab)}
        onOpenChange={(open) => {
          if (!open) setDeletingSlab(null);
        }}
      >
        <AlertDialogContent className="w-[calc(100%-2rem)] sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete GST Rate Slab?
            </AlertDialogTitle>

            <AlertDialogDescription className="text-sm leading-relaxed">
              Are you sure you want to remove this GST rate slab? This action
              will fail if removing it leaves a gap between the remaining
              active GST slabs. Prefer deactivating instead of deleting where
              possible.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:gap-2">
            <AlertDialogCancel className="mt-0">
              Cancel
            </AlertDialogCancel>

            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Confirm Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
