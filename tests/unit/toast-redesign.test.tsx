import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { Toaster } from "@/components/ui/sonner";

import type { ToasterProps } from "sonner";

// Mock sonner Sonner primitive
let capturedToasterProps: ToasterProps | null = null;
vi.mock("sonner", () => ({
  Toaster: (props: ToasterProps) => {
    capturedToasterProps = props;
    return <div data-testid="sonner-toaster-mock" />;
  },
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  },
}));

describe("Toaster Component Redesign", () => {
  it("configures Toaster with top-right position, close button, hotel theme classes, and custom icons", () => {
    render(<Toaster />);

    expect(capturedToasterProps).not.toBeNull();
    if (!capturedToasterProps) return;

    expect(capturedToasterProps.position).toBe("top-right");
    expect(capturedToasterProps.closeButton).toBe(true);
    expect(capturedToasterProps.richColors).toBe(false);
    expect(capturedToasterProps.offset).toEqual({
      top: "1.25rem",
      right: "1.25rem",
    });

    // Check classNames applied to toasts
    expect(capturedToasterProps.toastOptions?.classNames).toMatchObject({
      toast: expect.stringContaining("hotel-toast"),
      title: "hotel-toast-title",
      description: "hotel-toast-description",
      closeButton: "hotel-toast-close",
      success: "hotel-toast-success",
      error: "hotel-toast-error",
      warning: "hotel-toast-warning",
      info: "hotel-toast-info",
    });

    // Verify custom icons are provided for all notification types
    expect(capturedToasterProps.icons?.success).toBeDefined();
    expect(capturedToasterProps.icons?.error).toBeDefined();
    expect(capturedToasterProps.icons?.warning).toBeDefined();
    expect(capturedToasterProps.icons?.info).toBeDefined();
    expect(capturedToasterProps.icons?.loading).toBeDefined();
    expect(capturedToasterProps.icons?.close).toBeDefined();
  });
});
