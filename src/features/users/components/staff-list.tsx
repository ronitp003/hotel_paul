"use client";

import { useState, useTransition } from "react";
import { formatISTDate } from "@/lib/datetime";
import { ROLES, type Role } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AddIcon, SpinnerIcon } from "@/lib/icons";
import {
  createStaffAction,
  resetPasswordAction,
  toggleStaffActiveAction,
} from "@/server/actions/user.actions";
import { toast } from "sonner";

interface StaffMember {
  id: string;
  name: string;
  email: string;
  role: Role;
  isActive: boolean;
  createdAt: Date;
}

interface StaffListProps {
  initialStaff: StaffMember[];
  currentUserId: string;
}

export function StaffList({ initialStaff, currentUserId }: StaffListProps) {
  const [isPending, startTransition] = useTransition();

  // Create Staff Modal State
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>(ROLES.RECEPTIONIST);

  // Reset Password Modal State
  const [resetModalUser, setResetModalUser] = useState<StaffMember | null>(null);
  const [newPassword, setNewPassword] = useState("");

  const handleCreateStaff = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const res = await createStaffAction({
        name,
        email,
        password,
        role,
      });

      if (res.ok) {
        toast.success(`Staff account for ${name} created successfully`);
        setCreateOpen(false);
        setName("");
        setEmail("");
        setPassword("");
        setRole(ROLES.RECEPTIONIST);
      } else {
        toast.error(res.message || "Failed to create staff account");
      }
    });
  };

  const handleResetPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetModalUser) return;

    startTransition(async () => {
      const res = await resetPasswordAction({
        userId: resetModalUser.id,
        newPassword,
      });

      if (res.ok) {
        toast.success(`Password for ${resetModalUser.name} reset successfully`);
        setResetModalUser(null);
        setNewPassword("");
      } else {
        toast.error(res.message || "Failed to reset password");
      }
    });
  };

  const handleToggleActive = (user: StaffMember) => {
    const nextState = !user.isActive;
    const actionText = nextState ? "activate" : "deactivate";

    startTransition(async () => {
      const res = await toggleStaffActiveAction({
        userId: user.id,
        isActive: nextState,
      });

      if (res.ok) {
        toast.success(`Account for ${user.name} has been ${actionText}d`);
      } else {
        toast.error(res.message || `Failed to ${actionText} account`);
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg font-semibold">Staff Accounts</h2>
          <p className="text-sm text-muted-foreground">
            Manage front desk access and employee roles. Public registration is disabled.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="gap-2">
          <AddIcon className="size-4" aria-hidden="true" />
          <span>Add Staff Member</span>
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted/50 border-b border-border text-muted-foreground font-medium">
                <tr>
                  <th className="px-4 py-3">Staff Member</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Created</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {initialStaff.map((user) => {
                  const isSelf = user.id === currentUserId;

                  return (
                    <tr key={user.id} className="hover:bg-muted/20">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-foreground flex items-center gap-2">
                          <span>{user.name}</span>
                          {isSelf && (
                            <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-normal">
                              You
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">{user.email}</div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={user.role === "OWNER" ? "default" : "secondary"}>
                          {user.role}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          variant="outline"
                          className={
                            user.isActive
                              ? "bg-status-available/10 text-status-available border-status-available/30"
                              : "bg-destructive/10 text-destructive border-destructive/30"
                          }
                        >
                          {user.isActive ? "Active" : "Deactivated"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {formatISTDate(user.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-right space-x-2">
                        <Button
                          variant="outline"
                          size="xs"
                          onClick={() => setResetModalUser(user)}
                          disabled={isPending}
                          title="Reset Password"
                        >
                          Reset Password
                        </Button>

                        {!isSelf && (
                          <Button
                            variant={user.isActive ? "destructive" : "secondary"}
                            size="xs"
                            onClick={() => handleToggleActive(user)}
                            disabled={isPending}
                          >
                            {user.isActive ? "Deactivate" : "Activate"}
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Add Staff Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Staff Member</DialogTitle>
            <DialogDescription>
              Create credentials for an employee to access Hotel Desk.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateStaff} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="staff-name">Full Name</Label>
              <Input
                id="staff-name"
                required
                disabled={isPending}
                placeholder="Ramesh Kumar"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="staff-email">Work Email</Label>
              <Input
                id="staff-email"
                type="email"
                required
                disabled={isPending}
                placeholder="ramesh@hotelpaul.in"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="staff-password">Initial Password (min 8 chars)</Label>
              <Input
                id="staff-password"
                type="password"
                required
                minLength={8}
                disabled={isPending}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="staff-role">Role</Label>
              <select
                id="staff-role"
                disabled={isPending}
                value={role}
                onChange={(e) => setRole(e.target.value as Role)}
                className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm font-medium focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value={ROLES.RECEPTIONIST}>RECEPTIONIST (Front desk, rooms, payments)</option>
                <option value={ROLES.OWNER}>OWNER (Full system access, settings, user management)</option>
              </select>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                disabled={isPending}
                onClick={() => setCreateOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isPending} className="gap-2">
                {isPending && <SpinnerIcon className="size-4 animate-spin" aria-hidden="true" />}
                <span>Create Staff Account</span>
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog
        open={!!resetModalUser}
        onOpenChange={(open) => !open && setResetModalUser(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription>
              Set a new password for {resetModalUser?.name} ({resetModalUser?.email}). Active sessions will be terminated.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleResetPassword} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="new-password">New Password</Label>
              <Input
                id="new-password"
                type="password"
                required
                minLength={8}
                disabled={isPending}
                placeholder="New secure password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                disabled={isPending}
                onClick={() => setResetModalUser(null)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isPending} className="gap-2">
                {isPending && <SpinnerIcon className="size-4 animate-spin" aria-hidden="true" />}
                <span>Update Password</span>
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
