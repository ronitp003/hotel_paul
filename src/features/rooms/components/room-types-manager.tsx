"use client";

import { useState } from "react";
import { useForm } from "@tanstack/react-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
  RoomIcon,
} from "@/lib/icons";
import { roomTypeSchema } from "../schemas";
import {
  createRoomTypeAction,
  updateRoomTypeAction,
  deleteRoomTypeAction,
} from "@/server/actions/room-type.actions";

export interface RoomTypeItem {
  id: string;
  name: string;
  _count?: {
    rooms: number;
  };
}

interface RoomTypesManagerProps {
  initialTypes: RoomTypeItem[];
}

export function RoomTypesManager({ initialTypes }: RoomTypesManagerProps) {
  const [types, setTypes] = useState<RoomTypeItem[]>(initialTypes);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingType, setEditingType] = useState<RoomTypeItem | null>(null);
  const [deletingType, setDeletingType] = useState<RoomTypeItem | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const addForm = useForm({
    defaultValues: {
      name: "",
    },
    validators: {
      onChange: roomTypeSchema,
    },
    onSubmit: async ({ value }) => {
      setActionError(null);
      const res = await createRoomTypeAction(value);
      if (!res.ok) {
        setActionError(res.message || "Failed to create room type.");
        return;
      }
      toast.success(`Room type "${value.name}" added successfully.`);
      setIsAddOpen(false);
      window.location.reload();
    },
  });

  const editForm = useForm({
    defaultValues: {
      name: editingType?.name || "",
    },
    validators: {
      onChange: roomTypeSchema,
    },
    onSubmit: async ({ value }) => {
      if (!editingType) return;
      setActionError(null);
      const res = await updateRoomTypeAction(editingType.id, value);
      if (!res.ok) {
        setActionError(res.message || "Failed to update room type.");
        return;
      }
      toast.success(`Room type updated to "${value.name}".`);
      setEditingType(null);
      window.location.reload();
    },
  });

  const handleDelete = async () => {
    if (!deletingType) return;
    setActionError(null);
    const res = await deleteRoomTypeAction(deletingType.id);
    if (!res.ok) {
      toast.error(res.message || "Cannot delete room type.");
      setDeletingType(null);
      return;
    }
    setTypes((prev) => prev.filter((t) => t.id !== deletingType.id));
    toast.success(`Room type "${deletingType.name}" deleted.`);
    setDeletingType(null);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div>
          <CardTitle>Room Categories & Types</CardTitle>
          <CardDescription>
            Classification categories (e.g. Standard, Deluxe AC, Suite) used for pricing and inventory.
          </CardDescription>
        </div>
        <Button
          onClick={() => {
            setActionError(null);
            addForm.reset();
            setIsAddOpen(true);
          }}
          size="sm"
          className="gap-1.5"
        >
          <AddIcon className="h-4 w-4" />
          Add Room Type
        </Button>
      </CardHeader>

      <CardContent className="space-y-4">
        {actionError && (
          <Alert variant="destructive">
            <CircleAlertIcon className="h-4 w-4" />
            <AlertDescription>{actionError}</AlertDescription>
          </Alert>
        )}

        <div className="rounded-md border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left font-medium text-muted-foreground">
                <th className="p-3">Category Name</th>
                <th className="p-3">Assigned Rooms</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {types.length === 0 ? (
                <tr>
                  <td colSpan={3} className="p-6 text-center text-muted-foreground">
                    No room types configured. Add your first room type above.
                  </td>
                </tr>
              ) : (
                types.map((type) => {
                  const roomCount = type._count?.rooms ?? 0;
                  return (
                    <tr key={type.id} className="hover:bg-muted/30 transition-colors">
                      <td className="p-3 font-medium flex items-center gap-2">
                        <RoomIcon className="h-4 w-4 text-muted-foreground" />
                        <span>{type.name}</span>
                      </td>
                      <td className="p-3">
                        <Badge variant="outline" className="font-mono">
                          {roomCount} {roomCount === 1 ? "room" : "rooms"}
                        </Badge>
                      </td>
                      <td className="p-3 text-right space-x-2">
                        <Button
                          variant="outline"
                          size="icon-sm"
                          title="Edit room type"
                          onClick={() => {
                            setActionError(null);
                            setEditingType(type);
                            editForm.setFieldValue("name", type.name);
                          }}
                        >
                          <EditIcon className="h-4 w-4" />
                        </Button>

                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="text-destructive hover:bg-destructive/10"
                          title={
                            roomCount > 0
                              ? "Cannot delete: rooms are assigned"
                              : "Delete room type"
                          }
                          disabled={roomCount > 0}
                          onClick={() => setDeletingType(type)}
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

      {/* Add Dialog */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Room Category</DialogTitle>
            <DialogDescription>
              Enter a unique name for the room category (e.g. &quot;Standard Non-AC&quot;, &quot;Executive Suite&quot;).
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

            <addForm.Field name="name">
              {(field) => {
                const error = field.state.meta.errors[0]?.message;
                return (
                  <div className="space-y-1.5">
                    <Label htmlFor="add-room-type-name">
                      Category Name <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="add-room-type-name"
                      placeholder="e.g. Deluxe AC"
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      aria-invalid={Boolean(error)}
                    />
                    {error && (
                      <p className="text-sm font-medium text-destructive">{error}</p>
                    )}
                  </div>
                );
              }}
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
                    Create Room Type
                  </Button>
                )}
              </addForm.Subscribe>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog
        open={Boolean(editingType)}
        onOpenChange={(open) => !open && setEditingType(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Room Category</DialogTitle>
            <DialogDescription>
              Update the name of this room category.
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

            <editForm.Field name="name">
              {(field) => {
                const error = field.state.meta.errors[0]?.message;
                return (
                  <div className="space-y-1.5">
                    <Label htmlFor="edit-room-type-name">
                      Category Name <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="edit-room-type-name"
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      aria-invalid={Boolean(error)}
                    />
                    {error && (
                      <p className="text-sm font-medium text-destructive">{error}</p>
                    )}
                  </div>
                );
              }}
            </editForm.Field>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditingType(null)}
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

      {/* Delete Dialog */}
      <AlertDialog
        open={Boolean(deletingType)}
        onOpenChange={(open) => !open && setDeletingType(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Room Category?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete category &quot;{deletingType?.name}&quot;? This operation cannot
              be undone. Categories with active rooms assigned cannot be deleted.
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
