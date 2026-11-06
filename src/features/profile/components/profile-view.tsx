
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

  // --------------------------------------------------
  // Name form state
  // --------------------------------------------------

  const [name, setName] = useState(user.name);
  const [nameError, setNameError] = useState<string | null>(null);
  const [isUpdatingName, setIsUpdatingName] = useState(false);

  // --------------------------------------------------
  // Password form state
  // --------------------------------------------------

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // --------------------------------------------------
  // Derived values
  // --------------------------------------------------

  const trimmedName = name.trim();

  const hasNameChanges = trimmedName !== user.name;

  const userInitial = (
    trimmedName || user.name || "U"
  ).charAt(0).toUpperCase();

  // --------------------------------------------------
  // Update name
  // --------------------------------------------------

  const handleUpdateName = async (e: React.FormEvent) => {
    e.preventDefault();
    setNameError(null);

    if (trimmedName.length < 2) {
      setNameError("Name must be at least 2 characters.");
      return;
    }

    if (trimmedName.length > 60) {
      setNameError("Name must be under 60 characters.");
      return;
    }

    try {
      setIsUpdatingName(true);

      const res = await updateProfileAction({
        name: trimmedName,
      });

      if (!res.ok) {
        setNameError(res.message || "Failed to update profile name.");
        return;
      }

      toast.success("Name updated successfully.", {
        description: `Your display name has been changed to "${trimmedName}".`,
      });

      router.refresh();
    } catch {
      setNameError(
        "An unexpected error occurred while updating name."
      );
    } finally {
      setIsUpdatingName(false);
    }
  };

  // --------------------------------------------------
  // Change password
  // --------------------------------------------------

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);

    if (!currentPassword) {
      setPasswordError("Please enter your current password.");
      return;
    }

    if (newPassword.length < 8) {
      setPasswordError(
        "New password must be at least 8 characters long."
      );
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError(
        "New password and confirmation do not match."
      );
      return;
    }

    if (currentPassword === newPassword) {
      setPasswordError(
        "New password cannot be the same as your current password."
      );
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
        setPasswordError(
          res.message || "Failed to change password."
        );
        return;
      }

      toast.success("Password changed successfully.", {
        description: "Your login credentials have been updated.",
      });

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");

      setShowCurrentPassword(false);
      setShowNewPassword(false);
      setShowConfirmPassword(false);
    } catch {
      setPasswordError(
        "An unexpected error occurred while changing password."
      );
    } finally {
      setIsChangingPassword(false);
    }
  };

  // --------------------------------------------------
  // Password field helper
  // --------------------------------------------------

  const passwordInputClass =
    "h-10 w-full pr-11 text-sm";

  const passwordToggleClass =
    "absolute right-0 top-0 h-10 w-10 text-muted-foreground hover:text-foreground";

  // --------------------------------------------------
  // UI
  // --------------------------------------------------

  return (
    <div className="w-full space-y-5 sm:space-y-6">

      {/* ================================================
          ACCOUNT IDENTITY
      ================================================= */}

      <Card className="overflow-hidden border-border/70 shadow-sm">
        <CardContent className="p-4 sm:p-5 lg:p-6">

          <div className="flex min-w-0 items-center gap-3 sm:gap-4">

            {/* Avatar */}

            <div
              className="
                flex size-12 shrink-0 items-center justify-center
                rounded-full border border-primary/20
                bg-primary/10 text-xl font-semibold text-primary
                sm:size-16 sm:text-2xl
              "
              aria-hidden="true"
            >
              {userInitial}
            </div>

            {/* User information */}

            <div className="min-w-0 flex-1 space-y-1.5">

              <div className="flex flex-wrap items-center gap-2">

                <h2 className="min-w-0 max-w-full truncate text-base font-semibold tracking-tight text-foreground sm:text-lg">
                  {name || user.name}
                </h2>

                <Badge
                  variant={
                    user.role === "OWNER"
                      ? "default"
                      : "secondary"
                  }
                  className="shrink-0 text-[10px] font-medium uppercase tracking-wide"
                >
                  {user.role}
                </Badge>

                {user.isActive ? (
                  <Badge
                    variant="outline"
                    className="
                      shrink-0 border-emerald-300
                      bg-emerald-50 text-emerald-700
                      dark:border-emerald-800
                      dark:bg-emerald-950/30
                      dark:text-emerald-400
                    "
                  >
                    <span className="mr-1.5 size-1.5 rounded-full bg-emerald-500" />
                    Active
                  </Badge>
                ) : (
                  <Badge
                    variant="destructive"
                    className="shrink-0"
                  >
                    Deactivated
                  </Badge>
                )}

              </div>

              <p className="truncate text-sm text-muted-foreground">
                {user.email}
              </p>

            </div>
          </div>

        </CardContent>
      </Card>


      {/* ================================================
          PROFILE SETTINGS GRID
      ================================================= */}

      <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-2 lg:gap-5">

        {/* ================================================
            PERSONAL INFORMATION
        ================================================= */}

        <Card className="flex h-full min-w-0 flex-col overflow-hidden border-border/70 shadow-sm">

          <form
            onSubmit={handleUpdateName}
            className="flex h-full flex-1 flex-col"
          >

            {/* Header */}

            <CardHeader className="space-y-1.5 p-4 pb-4 sm:p-5 sm:pb-4">

              <div className="flex items-center gap-2 text-sm font-semibold text-primary">
                <UserIcon
                  className="size-4 shrink-0"
                  aria-hidden="true"
                />
                <span>Personal Information</span>
              </div>

              <CardTitle className="text-base font-semibold tracking-tight sm:text-lg">
                Display Name
              </CardTitle>

              <CardDescription className="text-sm leading-relaxed">
                Update your display name visible across staff desk
                actions and logs.
              </CardDescription>

            </CardHeader>


            {/* Form fields */}

            <CardContent className="flex-1 space-y-4 px-4 pb-5 pt-0 sm:px-5">

              {nameError && (
                <Alert
                  variant="destructive"
                  className="items-start py-3"
                >
                  <CircleAlertIcon
                    className="mt-0.5 size-4 shrink-0"
                    aria-hidden="true"
                  />
                  <AlertDescription className="text-sm leading-relaxed">
                    {nameError}
                  </AlertDescription>
                </Alert>
              )}

              {/* Full name */}

              <div className="space-y-2">

                <Label
                  htmlFor="display-name"
                  className="text-sm font-medium"
                >
                  Full Name
                </Label>

                <Input
                  id="display-name"
                  type="text"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (nameError) setNameError(null);
                  }}
                  placeholder="Enter your full name"
                  required
                  minLength={2}
                  maxLength={60}
                  disabled={isUpdatingName}
                  autoComplete="name"
                  className="h-10 w-full text-sm"
                />

              </div>


              {/* Email address */}

              <div className="space-y-2">

                <Label
                  htmlFor="account-email"
                  className="text-sm font-medium"
                >
                  Email Address
                </Label>

                <Input
                  id="account-email"
                  type="email"
                  value={user.email}
                  disabled
                  readOnly
                  autoComplete="email"
                  className="
                    h-10 w-full bg-muted/60 text-sm
                    text-muted-foreground opacity-100
                    cursor-not-allowed
                  "
                />

                <p className="text-xs leading-relaxed text-muted-foreground">
                  Your login email is fixed to your staff
                  credentials. Contact system administration
                  to change it.
                </p>

              </div>

            </CardContent>


            {/* Footer */}

            <CardFooter
              className="
                mt-auto flex flex-col-reverse gap-3
                border-t border-border/70
                bg-muted/20 p-4
                sm:flex-row sm:justify-end sm:p-5
              "
            >

              <Button
                type="submit"
                disabled={
                  isUpdatingName ||
                  !hasNameChanges ||
                  trimmedName.length < 2
                }
                className="h-10 w-full sm:w-auto"
              >
                {isUpdatingName ? (
                  <>
                    <LoaderIcon
                      className="mr-2 size-4 animate-spin"
                      aria-hidden="true"
                    />
                    Saving...
                  </>
                ) : (
                  <>
                    <CircleCheckIcon
                      className="mr-2 size-4"
                      aria-hidden="true"
                    />
                    Save Name
                  </>
                )}
              </Button>

            </CardFooter>

          </form>
        </Card>


        {/* ================================================
            SECURITY & CREDENTIALS
        ================================================= */}

        <Card className="flex h-full min-w-0 flex-col overflow-hidden border-border/70 shadow-sm">

          <form
            onSubmit={handleChangePassword}
            className="flex h-full flex-1 flex-col"
          >

            {/* Header */}

            <CardHeader className="space-y-1.5 p-4 pb-4 sm:p-5 sm:pb-4">

              <div className="flex items-center gap-2 text-sm font-semibold text-primary">
                <KeyIcon
                  className="size-4 shrink-0"
                  aria-hidden="true"
                />
                <span>Security & Credentials</span>
              </div>

              <CardTitle className="text-base font-semibold tracking-tight sm:text-lg">
                Change Password
              </CardTitle>

              <CardDescription className="text-sm leading-relaxed">
                Update your login password to ensure your
                account remains secure.
              </CardDescription>

            </CardHeader>


            {/* Password fields */}

            <CardContent className="flex-1 space-y-4 px-4 pb-5 pt-0 sm:px-5">

              {passwordError && (
                <Alert
                  variant="destructive"
                  className="items-start py-3"
                >
                  <CircleAlertIcon
                    className="mt-0.5 size-4 shrink-0"
                    aria-hidden="true"
                  />
                  <AlertDescription className="text-sm leading-relaxed">
                    {passwordError}
                  </AlertDescription>
                </Alert>
              )}


              {/* Current password */}

              <div className="space-y-2">

                <Label
                  htmlFor="current-password"
                  className="text-sm font-medium"
                >
                  Current Password
                </Label>

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
                    autoComplete="current-password"
                    className={passwordInputClass}
                  />

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className={passwordToggleClass}
                    onClick={() =>
                      setShowCurrentPassword((prev) => !prev)
                    }
                    disabled={isChangingPassword}
                    aria-label={
                      showCurrentPassword
                        ? "Hide current password"
                        : "Show current password"
                    }
                  >
                    {showCurrentPassword ? (
                      <EyeOffIcon
                        className="size-4"
                        aria-hidden="true"
                      />
                    ) : (
                      <EyeIcon
                        className="size-4"
                        aria-hidden="true"
                      />
                    )}
                  </Button>

                </div>

              </div>


              {/* New password */}

              <div className="space-y-2">

                <Label
                  htmlFor="new-password"
                  className="text-sm font-medium"
                >
                  New Password
                </Label>

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
                    autoComplete="new-password"
                    className={passwordInputClass}
                  />

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className={passwordToggleClass}
                    onClick={() =>
                      setShowNewPassword((prev) => !prev)
                    }
                    disabled={isChangingPassword}
                    aria-label={
                      showNewPassword
                        ? "Hide new password"
                        : "Show new password"
                    }
                  >
                    {showNewPassword ? (
                      <EyeOffIcon
                        className="size-4"
                        aria-hidden="true"
                      />
                    ) : (
                      <EyeIcon
                        className="size-4"
                        aria-hidden="true"
                      />
                    )}
                  </Button>

                </div>

              </div>


              {/* Confirm password */}

              <div className="space-y-2">

                <Label
                  htmlFor="confirm-password"
                  className="text-sm font-medium"
                >
                  Confirm New Password
                </Label>

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
                    autoComplete="new-password"
                    className={passwordInputClass}
                  />

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className={passwordToggleClass}
                    onClick={() =>
                      setShowConfirmPassword((prev) => !prev)
                    }
                    disabled={isChangingPassword}
                    aria-label={
                      showConfirmPassword
                        ? "Hide confirm password"
                        : "Show confirm password"
                    }
                  >
                    {showConfirmPassword ? (
                      <EyeOffIcon
                        className="size-4"
                        aria-hidden="true"
                      />
                    ) : (
                      <EyeIcon
                        className="size-4"
                        aria-hidden="true"
                      />
                    )}
                  </Button>

                </div>

              </div>

            </CardContent>


            {/* Footer */}

            <CardFooter
              className="
                mt-auto flex flex-col-reverse gap-3
                border-t border-border/70
                bg-muted/20 p-4
                sm:flex-row sm:justify-end sm:p-5
              "
            >

              <Button
                type="submit"
                disabled={
                  isChangingPassword ||
                  !currentPassword ||
                  !newPassword ||
                  !confirmPassword
                }
                className="h-10 w-full sm:w-auto"
              >
                {isChangingPassword ? (
                  <>
                    <LoaderIcon
                      className="mr-2 size-4 animate-spin"
                      aria-hidden="true"
                    />
                    Updating Password...
                  </>
                ) : (
                  <>
                    <KeyIcon
                      className="mr-2 size-4"
                      aria-hidden="true"
                    />
                    Update Password
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
