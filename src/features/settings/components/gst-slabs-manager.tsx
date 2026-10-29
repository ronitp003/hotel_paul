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

export function GstSlabsManager({ initialSlabs }: GstSlabsManagerProps) {
  const [slabs, setSlabs] = useState<GstSlabItem[]>(initialSlabs);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingSlab, setEditingSlab] = useState<GstSlabItem | null>(null);
  const [deletingSlab, setDeletingSlab] = useState<GstSlabItem | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Form for Add Slab
  const addForm = useForm({
    defaultValues: {
      minRate: slabs.length > 0 && slabs[slabs.length - 1].maxRate !== null
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

  const handleToggle = async (slab: GstSlabItem) => {
    setActionError(null);
    const newStatus = !slab.isActive;
    const res = await toggleGstSlabAction(slab.id, newStatus);
    if (!res.ok) {
      toast.error(res.message || "Cannot toggle GST slab status.");
      return;
    }
    setSlabs((prev) =>
      prev.map((s) => (s.id === slab.id ? { ...s, isActive: newStatus } : s))
    );
    toast.success(`GST slab ${newStatus ? "activated" : "deactivated"}.`);
  };

  const handleDelete = async () => {
    if (!deletingSlab) return;
    setActionError(null);
    const res = await deleteGstSlabAction(deletingSlab.id);
    if (!res.ok) {
      toast.error(res.message || "Cannot delete GST slab.");
      setDeletingSlab(null);
      return;
    }
    setSlabs((prev) => prev.filter((s) => s.id !== deletingSlab.id));
    toast.success("GST slab removed.");
    setDeletingSlab(null);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div>
          <CardTitle>GST Rate Slabs</CardTitle>
          <CardDescription>
            Configurable tax percentage tiers based on actual room rate charged per night.
          </CardDescription>
        </div>
        <Button
          onClick={() => {
            setActionError(null);
            setIsAddOpen(true);
          }}
          size="sm"
          className="gap-1.5"
        >
          <AddIcon className="h-4 w-4" />
          Add Slab
        </Button>
      </CardHeader>

      <CardContent className="space-y-4">
        {actionError && (
          <Alert variant="destructive">
            <CircleAlertIcon className="h-4 w-4" />
            <AlertDescription>{actionError}</AlertDescription>
          </Alert>
        )}

        <Alert className="bg-muted/50 border-border text-foreground">
          <InfoIcon className="h-4 w-4 text-muted-foreground" />
          <AlertDescription className="text-xs">
            <strong>Boundary Rule:</strong> Slabs cover <code>minRate &lt; rate &le; maxRate</code> (with the
            first slab starting at ₹0 inclusive). Slabs must be continuous without overlaps or gaps.
            For example: ₹0 to ₹7,500 is taxed at 5%, and ₹7,500.01+ is taxed at 18%.
          </AlertDescription>
        </Alert>

        <div className="rounded-md border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left font-medium text-muted-foreground">
                <th className="p-3">Room Rate Range (Per Night)</th>
                <th className="p-3">GST Rate</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {slabs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-6 text-center text-muted-foreground">
                    No GST slabs configured.
                  </td>
                </tr>
              ) : (
                slabs.map((slab) => {
                  const rangeText =
                    slab.maxRate === null
                      ? `Above ${formatINR(slab.minRate)}`
                      : slab.minRate === 0
                      ? `Up to ${formatINR(slab.maxRate)}`
                      : `${formatINR(slab.minRate)} to ${formatINR(slab.maxRate)}`;

                  return (
                    <tr key={slab.id} className="hover:bg-muted/30 transition-colors">
                      <td className="p-3 font-medium">{rangeText}</td>
                      <td className="p-3 font-mono font-semibold">{slab.percent}%</td>
                      <td className="p-3">
                        <Badge variant={slab.isActive ? "default" : "secondary"}>
                          {slab.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </td>
                      <td className="p-3 text-right space-x-2">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          title={slab.isActive ? "Deactivate" : "Activate"}
                          onClick={() => handleToggle(slab)}
                        >
                          <Switch checked={slab.isActive} aria-label="Toggle active" />
                        </Button>

                        <Button
                          variant="outline"
                          size="icon-sm"
                          title="Edit slab"
                          onClick={() => {
                            setActionError(null);
                            setEditingSlab(slab);
                            editForm.setFieldValue("minRate", slab.minRate);
                            editForm.setFieldValue("maxRate", slab.maxRate);
                            editForm.setFieldValue("percent", slab.percent);
                            editForm.setFieldValue("isActive", slab.isActive);
                          }}
                        >
                          <EditIcon className="h-4 w-4" />
                        </Button>

                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="text-destructive hover:bg-destructive/10"
                          title="Delete slab"
                          onClick={() => setDeletingSlab(slab)}
                        >
                          <DeleteIcon className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </CardContent>

      {/* Add Slab Dialog */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add GST Rate Slab</DialogTitle>
            <DialogDescription>
              Create a new tax rate tier. Slabs must be continuous with existing active slabs.
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              e.stopPropagation();
              addForm.handleSubmit();
            }}
            className="space-y-4"
          >
            {actionError && (
              <Alert variant="destructive">
                <CircleAlertIcon className="h-4 w-4" />
                <AlertDescription>{actionError}</AlertDescription>
              </Alert>
            )}

            <div className="grid grid-cols-2 gap-4">
              <addForm.Field name="minRate">
                {(field) => (
                  <div className="space-y-1.5">
                    <Label htmlFor="add-minRate">Min Rate (₹)</Label>
                    <Input
                      id="add-minRate"
                      type="number"
                      step="0.01"
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) =>
                        field.handleChange(parseFloat(e.target.value) || 0)
                      }
                    />
                  </div>
                )}
              </addForm.Field>

              <addForm.Field name="maxRate">
                {(field) => (
                  <div className="space-y-1.5">
                    <Label htmlFor="add-maxRate">Max Rate (₹)</Label>
                    <Input
                      id="add-maxRate"
                      type="number"
                      step="0.01"
                      placeholder="Leave blank for no limit"
                      value={field.state.value ?? ""}
                      onBlur={field.handleBlur}
                      onChange={(e) => {
                        const val = e.target.value.trim();
                        field.handleChange(val === "" ? null : parseFloat(val) || 0);
                      }}
                    />
                  </div>
                )}
              </addForm.Field>
            </div>

            <addForm.Field name="percent">
              {(field) => (
                <div className="space-y-1.5">
                  <Label htmlFor="add-percent">GST Percentage (%)</Label>
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
                  />
                </div>
              )}
            </addForm.Field>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsAddOpen(false)}
              >
                Cancel
              </Button>
              <addForm.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting]}>
                {([canSubmit, isSubmitting]) => (
                  <Button type="submit" disabled={!canSubmit || isSubmitting}>
                    {isSubmitting && <LoaderIcon className="h-4 w-4 animate-spin mr-2" />}
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
        onOpenChange={(open) => !open && setEditingSlab(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit GST Rate Slab</DialogTitle>
            <DialogDescription>
              Modify tier limits or GST percentage. Active slabs must remain continuous.
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              e.stopPropagation();
              editForm.handleSubmit();
            }}
            className="space-y-4"
          >
            {actionError && (
              <Alert variant="destructive">
                <CircleAlertIcon className="h-4 w-4" />
                <AlertDescription>{actionError}</AlertDescription>
              </Alert>
            )}

            <div className="grid grid-cols-2 gap-4">
              <editForm.Field name="minRate">
                {(field) => (
                  <div className="space-y-1.5">
                    <Label htmlFor="edit-minRate">Min Rate (₹)</Label>
                    <Input
                      id="edit-minRate"
                      type="number"
                      step="0.01"
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) =>
                        field.handleChange(parseFloat(e.target.value) || 0)
                      }
                    />
                  </div>
                )}
              </editForm.Field>

              <editForm.Field name="maxRate">
                {(field) => (
                  <div className="space-y-1.5">
                    <Label htmlFor="edit-maxRate">Max Rate (₹)</Label>
                    <Input
                      id="edit-maxRate"
                      type="number"
                      step="0.01"
                      placeholder="Leave blank for no limit"
                      value={field.state.value ?? ""}
                      onBlur={field.handleBlur}
                      onChange={(e) => {
                        const val = e.target.value.trim();
                        field.handleChange(val === "" ? null : parseFloat(val) || 0);
                      }}
                    />
                  </div>
                )}
              </editForm.Field>
            </div>

            <editForm.Field name="percent">
              {(field) => (
                <div className="space-y-1.5">
                  <Label htmlFor="edit-percent">GST Percentage (%)</Label>
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
                  />
                </div>
              )}
            </editForm.Field>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditingSlab(null)}
              >
                Cancel
              </Button>
              <editForm.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting]}>
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

      {/* Delete Confirmation Alert Dialog */}
      <AlertDialog
        open={Boolean(deletingSlab)}
        onOpenChange={(open) => !open && setDeletingSlab(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete GST Rate Slab?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove this GST rate slab? This action will fail if
              removing it leaves a gap between the remaining active GST slabs. Prefer deactivating
              instead of deleting where possible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            >
              Confirm Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
