"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  Suspense,
} from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { SpinnerIcon } from "@/lib/icons";

interface NavigationContextValue {
  isNavigating: boolean;
  targetPath: string | null;
  startNavigation: (href: string) => void;
  finishNavigation: () => void;
}

const NavigationContext = createContext<NavigationContextValue>({
  isNavigating: false,
  targetPath: null,
  startNavigation: () => {},
  finishNavigation: () => {},
});

export function useNavigationState() {
  return useContext(NavigationContext);
}

/**
 * RouteWatcher listens to Next.js App Router pathname & searchParams changes
 * within a Suspense boundary.
 */
function RouteWatcher({ onComplete }: { onComplete: () => void }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isFirstMount = useRef(true);

  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false;
      return;
    }
    onComplete();
  }, [pathname, searchParams, onComplete]);

  return null;
}

const DELAY_THRESHOLD_MS = 90; // Delay threshold to prevent flickering on instant/fast transitions
const CENTERED_INDICATOR_THRESHOLD_MS = 450; // Show subtle centered indicator on slower transitions
const SAFETY_TIMEOUT_MS = 12000; // Auto-cancel if navigation hangs or fails

export function NavigationProvider({ children }: { children: React.ReactNode }) {
  const [isNavigating, setIsNavigating] = useState(false);
  const [targetPath, setTargetPath] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);
  const [showCentered, setShowCentered] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isCompleting, setIsCompleting] = useState(false);

  const delayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const centeredTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const trickleIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const safetyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fadeoutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cleanupTimers = useCallback(() => {
    if (delayTimerRef.current) clearTimeout(delayTimerRef.current);
    if (centeredTimerRef.current) clearTimeout(centeredTimerRef.current);
    if (trickleIntervalRef.current) clearInterval(trickleIntervalRef.current);
    if (safetyTimerRef.current) clearTimeout(safetyTimerRef.current);
  }, []);

  const finishNavigation = useCallback(() => {
    cleanupTimers();

    setIsCompleting(true);
    setProgress(100);
    setShowCentered(false);

    fadeoutTimerRef.current = setTimeout(() => {
      setVisible(false);
      setIsNavigating(false);
      setTargetPath(null);
      setProgress(0);
      setIsCompleting(false);
    }, 200);
  }, [cleanupTimers]);

  const startNavigation = useCallback(
    (href: string) => {
      cleanupTimers();
      if (fadeoutTimerRef.current) clearTimeout(fadeoutTimerRef.current);

      setIsCompleting(false);
      setIsNavigating(true);
      setTargetPath(href);
      setProgress(20);

      // 1. Anti-flicker delay threshold before showing the progress bar
      delayTimerRef.current = setTimeout(() => {
        setVisible(true);

        // Trickle progress: 20% -> 40% -> 65% -> 80% -> 88%
        trickleIntervalRef.current = setInterval(() => {
          setProgress((prev) => {
            if (prev >= 88) return 88;
            if (prev < 40) return prev + 15;
            if (prev < 65) return prev + 10;
            if (prev < 80) return prev + 6;
            return prev + 2;
          });
        }, 180);
      }, DELAY_THRESHOLD_MS);

      // 2. Show subtle centered pill if navigation takes longer than 450ms
      centeredTimerRef.current = setTimeout(() => {
        setShowCentered(true);
      }, CENTERED_INDICATOR_THRESHOLD_MS);

      // 3. Safety timeout to prevent permanently stuck indicator
      safetyTimerRef.current = setTimeout(() => {
        finishNavigation();
      }, SAFETY_TIMEOUT_MS);
    },
    [cleanupTimers, finishNavigation]
  );

  // Global Link click listener: intercepts internal navigation links immediately
  useEffect(() => {
    function handleAnchorClick(e: MouseEvent) {
      const target = e.target as HTMLElement | null;
      if (!target) return;

      const anchor = target.closest("a");
      if (!anchor) return;

      const href = anchor.getAttribute("href");
      if (!href) return;

      // Ignore special links
      if (href.startsWith("#") || href.startsWith("javascript:")) return;
      if (anchor.getAttribute("target") && anchor.getAttribute("target") !== "_self") return;
      if (anchor.hasAttribute("download")) return;
      if (anchor.hasAttribute("data-no-loader")) return;

      // Ignore modified clicks (new tab / window)
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
      if (e.defaultPrevented) return;

      try {
        const targetUrl = new URL(anchor.href, window.location.href);

        // Only track same-origin navigation
        if (targetUrl.origin !== window.location.origin) return;

        // Ignore hash-only changes or exact current page clicks
        const currentUrl = new URL(window.location.href);
        if (
          targetUrl.pathname === currentUrl.pathname &&
          targetUrl.search === currentUrl.search
        ) {
          return;
        }

        startNavigation(targetUrl.pathname + targetUrl.search);
      } catch {
        // Ignore invalid URLs
      }
    }

    function handlePopState() {
      // Browser back/forward navigation
      startNavigation(window.location.pathname + window.location.search);
    }

    document.addEventListener("click", handleAnchorClick, true);
    window.addEventListener("popstate", handlePopState);

    return () => {
      document.removeEventListener("click", handleAnchorClick, true);
      window.removeEventListener("popstate", handlePopState);
      cleanupTimers();
      if (fadeoutTimerRef.current) clearTimeout(fadeoutTimerRef.current);
    };
  }, [startNavigation, cleanupTimers]);

  return (
    <NavigationContext.Provider
      value={{
        isNavigating,
        targetPath,
        startNavigation,
        finishNavigation,
      }}
    >
      {/* Route completion watcher wrapped in Suspense */}
      <Suspense fallback={null}>
        <RouteWatcher onComplete={finishNavigation} />
      </Suspense>

      {/* Top Global Progress Bar (Teal Theme) */}
      <div
        aria-hidden="true"
        className={cn(
          "fixed top-0 left-0 right-0 z-[9999] h-[3px] pointer-events-none transition-opacity duration-200",
          visible ? "opacity-100" : "opacity-0"
        )}
      >
        <div
          className="h-full bg-primary shadow-[0_0_10px_var(--primary)] transition-all ease-out relative"
          style={{
            width: `${progress}%`,
            transitionDuration: isCompleting ? "160ms" : "250ms",
          }}
        >
          {/* Leading glow flare */}
          <div className="absolute right-0 top-0 bottom-0 w-24 bg-gradient-to-r from-transparent via-white/40 to-white/70 dark:via-white/20 dark:to-white/50 blur-[1px]" />
        </div>
      </div>

      {/* Subtle Centered Loading Pill for Slower Page Loads (>450ms) */}
      {showCentered && (
        <div
          aria-live="polite"
          className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] pointer-events-none flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-card/95 backdrop-blur-md border border-border shadow-lg text-xs font-semibold text-foreground animate-in fade-in-0 slide-in-from-top-2 duration-150"
        >
          <SpinnerIcon className="size-3.5 text-primary animate-spin" />
          <span>Loading page...</span>
        </div>
      )}

      {children}
    </NavigationContext.Provider>
  );
}
