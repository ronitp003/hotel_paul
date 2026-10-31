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
import { AddIcon, SpinnerIcon, SearchIcon, GuestIcon } from "@/lib/icons";
import { SelectDropdown } from "@/components/ui/select-dropdown";
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

  // Filters State (Active status is default)
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<"ALL" | Role>("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ACTIVE");

  const isFiltered = roleFilter !== "ALL" || statusFilter !== "ACTIVE" || search.trim() !== "";

  const handleResetFilters = () => {
    setRoleFilter("ALL");
    setStatusFilter("ACTIVE");
    setSearch("");
  };

  // Filtered Users
  const filteredStaff = initialStaff.filter((user) => {
    if (roleFilter !== "ALL" && user.role !== roleFilter) {
      return false;
    }
    if (statusFilter === "ACTIVE" && !user.isActive) {
      return false;
    }
    if (statusFilter === "INACTIVE" && user.isActive) {
      return false;
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      const matchName = user.name.toLowerCase().includes(q);
      const matchEmail = user.email.toLowerCase().includes(q);
      if (!matchName && !matchEmail) {
        return false;
      }
    }
    return true;
  });

  // Create Staff Modal State
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>(ROLES.RECEPTIONIST);

  // Reset Password Modal State
  const [resetModalUser, setResetModalUser] = useState<StaffMember | null>(
    null
  );
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
        toast.success(`User account for ${name} created successfully`);
        setCreateOpen(false);
        setName("");
        setEmail("");
        setPassword("");
        setRole(ROLES.RECEPTIONIST);
      } else {
        toast.error(res.message || "Failed to create user account");
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
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Users</h2>
          <p className="text-sm text-muted-foreground">
            Manage front desk access, employee roles, and account statuses. Public registration is
            disabled.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="gap-2 shrink-0">
          <AddIcon className="size-4" aria-hidden="true" />
          <span>Add User</span>
        </Button>
      </div>

      {/* Search and Filters Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search users by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-xs bg-background"
          />
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Role Filter Dropdown */}
          <div className="w-full sm:w-40">
            <SelectDropdown
              value={roleFilter}
              onChange={(val) => setRoleFilter(val as "ALL" | Role)}
              options={[
                { value: "ALL", label: "All Roles" },
                { value: ROLES.OWNER, label: "Owner" },
                { value: ROLES.RECEPTIONIST, label: "Receptionist" },
              ]}
              size="sm"
              groupLabel="Filter by Role"
            />
          </div>

          {/* Status Filter Dropdown */}
          <div className="w-full sm:w-40">
            <SelectDropdown
              value={statusFilter}
              onChange={(val) =>
                setStatusFilter(val as "ALL" | "ACTIVE" | "INACTIVE")
              }
              options={[
                { value: "ACTIVE", label: "Active" },
                { value: "ALL", label: "All Status" },
                { value: "INACTIVE", label: "Deactivated" },
              ]}
              size="sm"
              groupLabel="Filter by Status"
            />
          </div>

          {isFiltered && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleResetFilters}
              className="text-xs h-9 px-2.5 text-muted-foreground hover:text-foreground"
            >
              Reset
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted/50 border-b border-border text-muted-foreground font-medium">
                <tr>
                  <th className="px-4 py-3">User</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Created</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredStaff.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-sm text-muted-foreground">
                      <div className="flex flex-col items-center justify-center space-y-2">
                        <GuestIcon className="size-8 text-muted-foreground/50" />
                        <p className="font-medium text-foreground">No users found</p>
                        <p className="text-xs text-muted-foreground max-w-sm">
                          {statusFilter === "ACTIVE" && roleFilter === "ALL" && !search.trim()
                            ? "No active users found. Switch status filter to All Status or Deactivated."
                            : "No user accounts match the selected role or status filters."}
                        </p>
                        {isFiltered ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleResetFilters}
                            className="text-xs mt-2"
                          >
                            Reset Filters
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setStatusFilter("ALL")}
                            className="text-xs mt-2"
                          >
                            Show All Users
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredStaff.map((user) => {
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
                        <div className="text-xs text-muted-foreground">
                          {user.email}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          variant={
                            user.role === "OWNER" ? "default" : "secondary"
                          }
                        >
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
                            variant={
                              user.isActive ? "destructive" : "secondary"
                            }
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
                }))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Add User Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add New User</DialogTitle>
            <DialogDescription>
              Create credentials for a user to access Hotel Desk.
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
              <Label htmlFor="staff-password">
                Initial Password (min 8 chars)
              </Label>
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
              <SelectDropdown
                value={role}
                onChange={(val) => setRole(val as Role)}
                options={[
                  {
                    value: ROLES.RECEPTIONIST,
                    label: "RECEPTIONIST (Front desk, rooms, payments)",
                  },
                  {
                    value: ROLES.OWNER,
                    label: "OWNER (Full system access, settings, user management)",
                  },
                ]}
                disabled={isPending}
              />
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
                {isPending && (
                  <SpinnerIcon
                    className="size-4 animate-spin"
                    aria-hidden="true"
                  />
                )}
                <span>Create User Account</span>
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
              Set a new password for {resetModalUser?.name} (
              {resetModalUser?.email}). Active sessions will be terminated.
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
                {isPending && (
                  <SpinnerIcon
                    className="size-4 animate-spin"
                    aria-hidden="true"
                  />
                )}
                <span>Update Password</span>
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
