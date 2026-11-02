import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Validates and sanitizes a redirect target URL to prevent Open Redirect vulnerabilities (SEC-03).
 * Ensures the target is strictly an internal relative path on the same origin.
 */
export function getSafeRedirectUrl(target: string | null | undefined): string {
  if (!target || typeof target !== "string") {
    return "/dashboard";
  }

  const trimmed = target.trim();

  // Must begin with a single "/" and NOT start with "//" or "/\" or contain control characters
  if (
    trimmed.startsWith("/") &&
    !trimmed.startsWith("//") &&
    !trimmed.startsWith("/\\") &&
    !trimmed.includes("\r") &&
    !trimmed.includes("\n")
  ) {
    return trimmed;
  }

  return "/dashboard";
}

