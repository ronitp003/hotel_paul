"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  UserIcon,
  KeyIcon,
  CircleAlertIcon,
  CircleCheckIcon,
  LoaderIcon,
  EyeIcon,
  EyeOffIcon,
} from "@/lib/icons";
import type { Role } from "@/lib/constants";
import {
  updateProfileAction,
  changePasswordAction,
} from "@/server/actions/user.actions";

interface ProfileViewProps {
  user: {
    id: string;
    name: string;
    email: string;
    role: Role;
    isActive: boolean;
  };
}

export function ProfileView({ user }: ProfileViewProps) {
  const router = useRouter();

  // Name form state
  const [name, setName] = useState(user.name);
  const [nameError, setNameError] = useState<string | null>(null);
  const [isUpdatingName, setIsUpdatingName] = useState(false);

  // Password form state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Handle name update
  const handleUpdateName = async (e: React.FormEvent) => {
    e.preventDefault();
    setNameError(null);

    const trimmed = name.trim();
    if (trimmed.length < 2) {
      setNameError("Name must be at least 2 characters.");
      return;
    }
    if (trimmed.length > 60) {
      setNameError("Name must be under 60 characters.");
      return;
    }

    try {
      setIsUpdatingName(true);
      const res = await updateProfileAction({ name: trimmed });

      if (!res.ok) {
        setNameError(res.message || "Failed to update profile name.");
        return;
      }

      toast.success("Name updated successfully.", {
        description: `Your display name has been changed to "${trimmed}".`,
      });
      router.refresh();
    } catch {
      setNameError("An unexpected error occurred while updating name.");
    } finally {
      setIsUpdatingName(false);
    }
  };

  // Handle password update
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);

    if (!currentPassword) {
      setPasswordError("Please enter your current password.");
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError("New password must be at least 8 characters long.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("New password and confirmation do not match.");
      return;
    }
    if (currentPassword === newPassword) {
      setPasswordError("New password cannot be the same as your current password.");
      return;
    }

    try {
      setIsChangingPassword(true);
      const res = await changePasswordAction({
        currentPassword,
        newPassword,
        confirmPassword,
      });

      if (!res.ok) {
        setPasswordError(res.message || "Failed to change password.");
        return;
      }

      toast.success("Password changed successfully.", {
        description: "Your login credentials have been updated.",
      });

      // Clear password fields
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch {
      setPasswordError("An unexpected error occurred while changing password.");
    } finally {
      setIsChangingPassword(false);
    }
  };

  const userInitial = (name || user.name || "U").charAt(0).toUpperCase();

  return (
    <div className="space-y-6">
      {/* Account Identity Card */}
      <Card className="border-border">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="size-16 rounded-full bg-primary/10 text-primary font-bold text-2xl flex items-center justify-center border border-primary/20 shrink-0">
                {userInitial}
              </div>
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-xl font-bold tracking-tight text-foreground truncate">
                    {name || user.name}
                  </h2>
                  <Badge variant={user.role === "OWNER" ? "default" : "secondary"}>
                    {user.role}
                  </Badge>
                  {user.isActive ? (
                    <Badge variant="outline" className="text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800">
                      Active
                    </Badge>
                  ) : (
                    <Badge variant="destructive">Deactivated</Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground truncate">{user.email}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Personal Details (Name) */}
        <Card className="border-border flex flex-col justify-between">
          <form onSubmit={handleUpdateName}>
            <CardHeader>
              <div className="flex items-center gap-2 text-primary font-semibold text-sm mb-1">
                <UserIcon className="size-4" aria-hidden="true" />
                <span>Personal Information</span>
              </div>
              <CardTitle className="text-lg">Display Name</CardTitle>
              <CardDescription>
                Update your display name visible across staff desk actions and logs.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              {nameError && (
                <Alert variant="destructive">
                  <CircleAlertIcon className="size-4" />
                  <AlertDescription>{nameError}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="display-name">Full Name</Label>
                <Input
                  id="display-name"
                  type="text"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (nameError) setNameError(null);
                  }}
                  placeholder="e.g. Soyab Aktar"
                  required
                  minLength={2}
                  maxLength={60}
                  disabled={isUpdatingName}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="account-email" className="text-muted-foreground">
                  Email Address
                </Label>
                <Input
                  id="account-email"
                  type="email"
                  value={user.email}
                  disabled
                  className="bg-muted text-muted-foreground cursor-not-allowed"
                />
                <p className="text-xs text-muted-foreground">
                  Login email is fixed to your staff credentials. Contact system administration to change your email.
                </p>
              </div>
            </CardContent>

            <CardFooter className="border-t border-border pt-4 mt-auto flex justify-end">
              <Button
                type="submit"
                disabled={isUpdatingName || name.trim() === user.name}
                className="w-full sm:w-auto"
              >
                {isUpdatingName ? (
                  <>
                    <LoaderIcon className="size-4 animate-spin mr-2" aria-hidden="true" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <CircleCheckIcon className="size-4 mr-2" aria-hidden="true" />
                    <span>Save Name</span>
                  </>
                )}
              </Button>
            </CardFooter>
          </form>
        </Card>

        {/* Change Password */}
        <Card className="border-border flex flex-col justify-between">
          <form onSubmit={handleChangePassword}>
            <CardHeader>
              <div className="flex items-center gap-2 text-primary font-semibold text-sm mb-1">
                <KeyIcon className="size-4" aria-hidden="true" />
                <span>Security & Credentials</span>
              </div>
              <CardTitle className="text-lg">Change Password</CardTitle>
              <CardDescription>
                Update your login password to ensure your account remains secure.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              {passwordError && (
                <Alert variant="destructive">
                  <CircleAlertIcon className="size-4" />
                  <AlertDescription>{passwordError}</AlertDescription>
                </Alert>
              )}

              {/* Current Password */}
              <div className="space-y-2">
                <Label htmlFor="current-password">Current Password</Label>
                <div className="relative">
                  <Input
                    id="current-password"
                    type={showCurrentPassword ? "text" : "password"}
                    value={currentPassword}
                    onChange={(e) => {
                      setCurrentPassword(e.target.value);
                      if (passwordError) setPasswordError(null);
                    }}
                    placeholder="Enter current password"
                    required
                    disabled={isChangingPassword}
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full px-3 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowCurrentPassword((prev) => !prev)}
                    aria-label={showCurrentPassword ? "Hide current password" : "Show current password"}
                  >
                    {showCurrentPassword ? (
                      <EyeOffIcon className="size-4" aria-hidden="true" />
                    ) : (
                      <EyeIcon className="size-4" aria-hidden="true" />
                    )}
                  </Button>
                </div>
              </div>

              {/* New Password */}
              <div className="space-y-2">
                <Label htmlFor="new-password">New Password</Label>
                <div className="relative">
                  <Input
                    id="new-password"
                    type={showNewPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => {
                      setNewPassword(e.target.value);
                      if (passwordError) setPasswordError(null);
                    }}
                    placeholder="At least 8 characters"
                    required
                    minLength={8}
                    disabled={isChangingPassword}
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full px-3 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowNewPassword((prev) => !prev)}
                    aria-label={showNewPassword ? "Hide new password" : "Show new password"}
                  >
                    {showNewPassword ? (
                      <EyeOffIcon className="size-4" aria-hidden="true" />
                    ) : (
                      <EyeIcon className="size-4" aria-hidden="true" />
                    )}
                  </Button>
                </div>
              </div>

              {/* Confirm Password */}
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm New Password</Label>
                <div className="relative">
                  <Input
                    id="confirm-password"
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      if (passwordError) setPasswordError(null);
                    }}
                    placeholder="Re-enter new password"
                    required
                    minLength={8}
                    disabled={isChangingPassword}
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full px-3 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowConfirmPassword((prev) => !prev)}
                    aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
                  >
                    {showConfirmPassword ? (
                      <EyeOffIcon className="size-4" aria-hidden="true" />
                    ) : (
                      <EyeIcon className="size-4" aria-hidden="true" />
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>

            <CardFooter className="border-t border-border pt-4 mt-auto flex justify-end">
              <Button
                type="submit"
                disabled={isChangingPassword || !currentPassword || !newPassword || !confirmPassword}
                className="w-full sm:w-auto"
              >
                {isChangingPassword ? (
                  <>
                    <LoaderIcon className="size-4 animate-spin mr-2" aria-hidden="true" />
                    <span>Updating Password...</span>
                  </>
                ) : (
                  <>
                    <KeyIcon className="size-4 mr-2" aria-hidden="true" />
                    <span>Update Password</span>
                  </>
                )}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}

