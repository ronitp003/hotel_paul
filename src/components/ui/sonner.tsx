"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Toaster as Sonner, type ToasterProps } from "sonner";
import {
  CircleCheckIcon,
  CircleAlertIcon,
  ProblemIcon,
  InfoIcon,
  SpinnerIcon,
  CloseIcon,
} from "@/lib/icons";

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme: nextTheme } = useTheme();
  const [domTheme, setDomTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const updateTheme = () => {
      const isDark = document.documentElement.classList.contains("dark");
      setDomTheme(isDark ? "dark" : "light");
    };

    updateTheme();

    const observer = new MutationObserver(updateTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => observer.disconnect();
  }, []);

  const theme =
    nextTheme && nextTheme !== "system"
      ? (nextTheme as ToasterProps["theme"])
      : domTheme;

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      position="top-right"
      className="toaster group"
      closeButton={true}
      duration={4000}
      visibleToasts={4}
      gap={8}
      richColors={false}
      offset={{ top: "1.25rem", right: "1.25rem" }}
      mobileOffset={{ top: "1rem", right: "1rem", left: "1rem" }}
      icons={{
        success: (
          <CircleCheckIcon
            className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400"
            aria-hidden="true"
          />
        ),
        info: (
          <InfoIcon
            className="size-4 shrink-0 text-[#0078D4] dark:text-[#2886DE]"
            aria-hidden="true"
          />
        ),
        warning: (
          <ProblemIcon
            className="size-4 shrink-0 text-amber-600 dark:text-amber-400"
            aria-hidden="true"
          />
        ),
        error: (
          <CircleAlertIcon
            className="size-4 shrink-0 text-rose-600 dark:text-rose-400"
            aria-hidden="true"
          />
        ),
        loading: (
          <SpinnerIcon
            className="size-4 shrink-0 animate-spin text-[#0078D4] dark:text-[#2886DE]"
            aria-hidden="true"
          />
        ),
        close: <CloseIcon className="size-3.5" aria-hidden="true" />,
      }}
      style={
        {
          "--normal-bg": "var(--card)",
          "--normal-text": "var(--card-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "0.75rem",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "hotel-toast group",
          title: "hotel-toast-title",
          description: "hotel-toast-description",
          actionButton: "hotel-toast-action",
          cancelButton: "hotel-toast-cancel",
          closeButton: "hotel-toast-close",
          success: "hotel-toast-success",
          error: "hotel-toast-error",
          warning: "hotel-toast-warning",
          info: "hotel-toast-info",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
export { toast } from "sonner";

