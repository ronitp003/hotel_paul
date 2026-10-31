"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { CalendarIcon } from "@/lib/icons";

export interface DateInputProps {
  value: string; // ISO date string "YYYY-MM-DD"
  onChange: (value: string) => void; // Emits ISO date string "YYYY-MM-DD"
  min?: string; // "YYYY-MM-DD"
  max?: string; // "YYYY-MM-DD"
  disabled?: boolean;
  required?: boolean;
  className?: string;
  id?: string;
  name?: string;
  placeholder?: string;
}

/**
 * Converts "YYYY-MM-DD" to "DD/MM/YYYY"
 */
export function isoToDisplay(isoDate: string): string {
  if (!isoDate) return "";
  const match = isoDate.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return "";
  const [, y, m, d] = match;
  return `${d}/${m}/${y}`;
}

/**
 * Converts "DD/MM/YYYY" (or D/M/YYYY) to "YYYY-MM-DD"
 */
export function displayToIso(displayDate: string): string | null {
  if (!displayDate) return null;
  const match = displayDate.trim().match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
  if (!match) return null;
  const day = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const year = parseInt(match[3], 10);

  if (year < 1900 || year > 2100) return null;
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > 31) return null;

  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }

  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${year}-${pad(month)}-${pad(day)}`;
}

export function DateInput({
  value,
  onChange,
  min,
  max,
  disabled = false,
  required = false,
  className,
  id,
  name,
  placeholder = "DD/MM/YYYY",
}: DateInputProps) {
  const [prevValue, setPrevValue] = React.useState(value);
  const [displayVal, setDisplayVal] = React.useState(() => isoToDisplay(value));
  const hiddenInputRef = React.useRef<HTMLInputElement>(null);

  // Sync display value when incoming value prop changes from parent
  if (value !== prevValue) {
    setPrevValue(value);
    setDisplayVal(isoToDisplay(value));
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nextVal = e.target.value;
    const isDeleting = nextVal.length < displayVal.length;

    if (isDeleting) {
      setDisplayVal(nextVal);
      const iso = displayToIso(nextVal);
      if (iso) onChange(iso);
      else if (nextVal.trim() === "") onChange("");
      return;
    }

    // Auto-insert slash formatting for digits
    const digits = nextVal.replace(/\D/g, "").slice(0, 8);
    let formatted = digits;
    if (digits.length > 4) {
      formatted = `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
    } else if (digits.length > 2) {
      formatted = `${digits.slice(0, 2)}/${digits.slice(2)}`;
    }

    setDisplayVal(formatted);
    const iso = displayToIso(formatted);
    if (iso) {
      onChange(iso);
    }
  };

  const handleBlur = () => {
    const iso = displayToIso(displayVal);
    if (iso) {
      setDisplayVal(isoToDisplay(iso));
      onChange(iso);
    } else if (displayVal.trim() === "") {
      setDisplayVal("");
      onChange("");
    } else {
      // Revert to valid value from parent if incomplete/invalid
      setDisplayVal(isoToDisplay(value));
    }
  };

  const openCalendar = () => {
    if (disabled) return;
    if (hiddenInputRef.current) {
      if ("showPicker" in HTMLInputElement.prototype) {
        try {
          hiddenInputRef.current.showPicker();
        } catch {
          hiddenInputRef.current.focus();
        }
      } else {
        hiddenInputRef.current.focus();
      }
    }
  };

  return (
    <div className="relative flex items-center w-full">
      <input
        type="text"
        id={id}
        name={name}
        value={displayVal}
        onChange={handleInputChange}
        onBlur={handleBlur}
        placeholder={placeholder}
        disabled={disabled}
        required={required}
        inputMode="numeric"
        className={cn(
          "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 pr-9 font-mono",
          className
        )}
      />

      <button
        type="button"
        tabIndex={-1}
        onClick={openCalendar}
        disabled={disabled}
        title="Open calendar picker"
        className="absolute right-2 p-1 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
      >
        <CalendarIcon className="size-4" aria-hidden="true" />
      </button>

      {/* Hidden native date input to power system calendar picker */}
      <input
        type="date"
        ref={hiddenInputRef}
        value={value}
        min={min}
        max={max}
        onChange={(e) => {
          const picked = e.target.value;
          if (picked) {
            setDisplayVal(isoToDisplay(picked));
            onChange(picked);
          }
        }}
        tabIndex={-1}
        aria-hidden="true"
        className="sr-only pointer-events-none"
      />
    </div>
  );
}
