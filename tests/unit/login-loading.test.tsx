import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import LoginPage from "@/app/(auth)/login/page";
import { authClient } from "@/lib/auth-client";
import { toast } from "sonner";

// Mock next/navigation
const mockPush = vi.fn();
const mockRefresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    refresh: mockRefresh,
  }),
  useSearchParams: () => ({
    get: vi.fn().mockReturnValue(null),
  }),
}));

// Mock better-auth client
vi.mock("@/lib/auth-client", () => ({
  authClient: {
    signIn: {
      email: vi.fn(),
    },
  },
}));

// Mock sonner toast
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  },
}));

describe("Login Page Loading Feedback & Error Handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows 'Signing In...' with animated spinner and disables the button during submission", async () => {
    type SignInResult = Awaited<ReturnType<typeof authClient.signIn.email>>;
    let resolveAuth!: (val: SignInResult) => void;
    const authPromise = new Promise<SignInResult>((resolve) => {
      resolveAuth = resolve;
    });

    vi.mocked(authClient.signIn.email).mockReturnValue(authPromise);

    render(<LoginPage />);

    const emailInput = screen.getByLabelText(/staff email/i);
    const passwordInput = screen.getByLabelText(/^password$/i, {
      selector: "input",
    });
    const submitBtn = screen.getByRole("button", {
      name: /sign in to hotel desk/i,
    });

    expect(submitBtn).toBeEnabled();
    expect(screen.queryByText("Signing In...")).toBeNull();

    // Fill form
    fireEvent.change(emailInput, { target: { value: "staff@hotelpaul.in" } });
    fireEvent.change(passwordInput, { target: { value: "password123" } });

    // Submit form
    fireEvent.click(submitBtn);

    // Button should immediately show 'Signing In...', have a spinner, and be disabled
    expect(screen.getByRole("button", { name: /signing in\.\.\./i })).toBeDisabled();
    expect(screen.getByText("Signing In...")).toBeInTheDocument();
    expect(submitBtn.className).toContain("min-h-[40px]");

    // Input fields remain visible
    expect(emailInput).toBeVisible();
    expect(passwordInput).toBeVisible();

    // Ensure duplicate click does not call authClient again
    fireEvent.click(submitBtn);
    expect(authClient.signIn.email).toHaveBeenCalledTimes(1);

    // Resolve auth successfully
    resolveAuth({ data: { token: "abc" }, error: null } as unknown as SignInResult);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/dashboard");
      expect(toast.success).toHaveBeenCalledWith(
        "Welcome back to Hotel Desk",
        expect.objectContaining({
          description: expect.stringContaining("Signed in successfully"),
        })
      );
    });

    // Loading state should remain active while redirecting to the dashboard
    expect(screen.getByRole("button", { name: /signing in\.\.\./i })).toBeDisabled();
  });

  it("handles authentication failure gracefully: stops spinner, re-enables button, displays error toast, and preserves entered email", async () => {
    vi.mocked(authClient.signIn.email).mockResolvedValue({
      error: { message: "Invalid email or password. Please try again." },
    } as Awaited<ReturnType<typeof authClient.signIn.email>>);

    render(<LoginPage />);

    const emailInput = screen.getByLabelText(/staff email/i);
    const passwordInput = screen.getByLabelText(/^password$/i, {
      selector: "input",
    });
    const submitBtn = screen.getByRole("button", {
      name: /sign in to hotel desk/i,
    });

    fireEvent.change(emailInput, { target: { value: "owner@hotelpaul.in" } });
    fireEvent.change(passwordInput, { target: { value: "wrongpassword" } });

    fireEvent.click(submitBtn);

    // Wait for failure response
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "Sign in failed",
        expect.objectContaining({
          description: "Invalid email or password. Please try again.",
        })
      );
    });

    // Loading should stop and button should be restored to normal
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /sign in to hotel desk/i })
      ).toBeEnabled();
    });

    // Email must be preserved in the input field
    expect(emailInput).toHaveValue("owner@hotelpaul.in");

    // Allows the user to retry
    vi.mocked(authClient.signIn.email).mockResolvedValue({
      data: { token: "abc" },
      error: null,
    } as unknown as Awaited<ReturnType<typeof authClient.signIn.email>>);
    fireEvent.change(passwordInput, { target: { value: "correctpassword" } });
    fireEvent.click(screen.getByRole("button", { name: /sign in to hotel desk/i }));

    expect(authClient.signIn.email).toHaveBeenCalledTimes(2);
  });
});
