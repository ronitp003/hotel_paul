"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  RoomIcon,
  SpinnerIcon,
  EyeIcon,
  EyeOffIcon,
  ProblemIcon,
} from "@/lib/icons";
import { toast } from "sonner";
import { getSafeRedirectUrl } from "@/lib/utils";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = getSafeRedirectUrl(searchParams.get("redirect"));
  const errorParam = searchParams.get("error");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(
    errorParam === "deactivated"
      ? "Your staff account has been deactivated. Please contact the owner."
      : ""
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setErrorMessage("");

    if (!email.trim() || !password) {
      const msg = "Please enter both email and password.";
      setErrorMessage(msg);
      toast.error("Missing credentials", {
        description: msg,
      });
      return;
    }

    setLoading(true);

    try {
      const result = await authClient.signIn.email({
        email: email.trim(),
        password,
      });

      if (result.error) {
        const errorMsg =
          result.error.message || "Invalid email or password. Please try again.";
        setErrorMessage(errorMsg);
        toast.error("Sign in failed", {
          description: errorMsg,
        });
        setLoading(false);
      } else {
        toast.success("Welcome back to Hotel Desk", {
          description: "Signed in successfully. Redirecting to dashboard...",
        });
        // Keep loading true while redirecting to the destination dashboard
        router.push(redirectTo);
        router.refresh();
      }
    } catch {
      const errorMsg =
        "Unable to connect to authentication service. Please check your connection.";
      setErrorMessage(errorMsg);
      toast.error("Sign in failed", {
        description: errorMsg,
      });
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md shadow-md border-border">
      <CardHeader className="space-y-2 text-center pb-6">
        <div className="mx-auto size-12 rounded-xl bg-primary text-primary-foreground flex items-center justify-center shadow-xs">
          <RoomIcon className="size-6" aria-hidden="true" />
        </div>
        <CardTitle className="text-2xl font-bold tracking-tight text-foreground">
          Hotel Desk
        </CardTitle>
        <CardDescription className="text-sm text-muted-foreground">
          Sign in with your staff account to access front desk operations.
        </CardDescription>
      </CardHeader>

      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          {errorMessage && (
            <div
              className="flex items-start gap-2.5 p-3 rounded-md bg-destructive/10 border border-destructive/20 text-destructive text-sm"
              role="alert"
            >
              <ProblemIcon
                className="size-4 shrink-0 mt-0.5"
                aria-hidden="true"
              />
              <span>{errorMessage}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="email">Staff Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              disabled={loading}
              placeholder="staff@hotelpaul.in"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-10"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                required
                disabled={loading}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-10 pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                disabled={loading}
                className="absolute right-0 top-0 h-10 w-10 flex items-center justify-center text-muted-foreground hover:text-foreground focus:outline-hidden disabled:opacity-50 disabled:pointer-events-none"
                tabIndex={-1}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <EyeOffIcon className="size-4" aria-hidden="true" />
                ) : (
                  <EyeIcon className="size-4" aria-hidden="true" />
                )}
              </button>
            </div>
          </div>
        </CardContent>

        <CardFooter className="pt-2">
          <Button
            type="submit"
            disabled={loading}
            className="w-full h-10 min-h-[40px] gap-2 font-semibold transition-all duration-150"
          >
            {loading && (
              <SpinnerIcon className="size-4 animate-spin shrink-0" aria-hidden="true" />
            )}
            <span>{loading ? "Signing In..." : "Sign In to Hotel Desk"}</span>
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-background">
      <Suspense
        fallback={
          <Card className="w-full max-w-md p-8 text-center text-muted-foreground">
            Loading sign in...
          </Card>
        }
      >
        <LoginForm />
      </Suspense>
    </div>
  );
}
