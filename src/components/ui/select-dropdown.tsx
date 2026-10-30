"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { ChevronDownIcon, CheckIcon } from "@/lib/icons";

export interface SelectDropdownOption<T extends string = string> {
  value: T;
  label: React.ReactNode;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  disabled?: boolean;
}

export interface SelectDropdownProps<T extends string = string> {
  value: T;
  onChange: (value: T) => void;
  options: SelectDropdownOption<T>[];
  placeholder?: string;
  label?: string; // Accessible aria-label
  groupLabel?: string; // Optional dropdown header label
  id?: string;
  name?: string;
  disabled?: boolean;
  error?: boolean | string;
  size?: "sm" | "default" | "lg";
  className?: string; // Custom classes on the trigger button
  contentClassName?: string; // Custom classes on popup container
  align?: "start" | "center" | "end";
  wrapperClassName?: string;
  modal?: boolean;
}

export function SelectDropdown<T extends string = string>({
  value,
  onChange,
  options,
  placeholder = "Select an option...",
  label,
  groupLabel,
  id,
  disabled = false,
  error = false,
  size = "default",
  className,
  contentClassName,
  wrapperClassName,
  modal = false,
  align = "start",
}: SelectDropdownProps<T>) {
  const selectedOption = options.find((opt) => opt.value === value);

  // Size styling presets
  const sizeClasses = {
    sm: "h-8 px-2.5 py-1 text-xs",
    default: "h-9 px-3 py-1.5 text-sm",
    lg: "h-10 px-3 py-2 text-sm",
  }[size];

  const hasError = Boolean(error);

  return (
    <div className={cn("relative w-full", wrapperClassName)}>
      <DropdownMenu modal={modal}>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            id={id}
            variant="outline"
            aria-label={label || (typeof selectedOption?.label === "string" ? selectedOption.label : placeholder)}
            disabled={disabled}
            className={cn(
              "flex w-full items-center justify-between gap-2 rounded-md border border-input bg-background font-medium text-foreground shadow-xs hover:bg-muted/60 hover:border-border transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer text-left select-none",
              sizeClasses,
              hasError && "border-destructive focus-visible:ring-destructive",
              disabled && "opacity-50 pointer-events-none cursor-not-allowed",
              className
            )}
          >
            <div className="flex items-center gap-2 min-w-0 flex-1">
              {selectedOption?.icon && (
                <span className="shrink-0 text-muted-foreground flex items-center">
                  {selectedOption.icon}
                </span>
              )}
              <span
                className={cn(
                  "truncate font-medium",
                  !selectedOption && "text-muted-foreground font-normal"
                )}
              >
                {selectedOption ? selectedOption.label : placeholder}
              </span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0 ml-auto">
              {selectedOption?.badge && (
                <span className="shrink-0">{selectedOption.badge}</span>
              )}
              <ChevronDownIcon className="size-3.5 text-muted-foreground shrink-0 transition-transform duration-200" />
            </div>
          </Button>
        }
      />
      <DropdownMenuContent
        align={align}
        sideOffset={6}
        className={cn(
          "w-(--anchor-width) min-w-[200px] max-h-64 overflow-y-auto p-1.5 shadow-lg border border-border bg-popover z-50 rounded-lg custom-scrollbar",
          contentClassName
        )}
      >
        {groupLabel && (
          <DropdownMenuGroup>
            <DropdownMenuLabel className="px-2.5 py-1 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              {groupLabel}
            </DropdownMenuLabel>
          </DropdownMenuGroup>
        )}
        <DropdownMenuGroup>
          {options.map((option) => {
            const isSelected = option.value === value;
            return (
              <DropdownMenuItem
                key={option.value}
                onClick={() => {
                  if (!option.disabled) {
                    onChange(option.value);
                  }
                }}
                disabled={option.disabled}
                className={cn(
                  "flex items-center justify-between gap-2 px-2.5 py-2 cursor-pointer text-sm rounded-md transition-colors",
                  isSelected
                    ? "bg-primary/10 text-primary font-semibold"
                    : "text-foreground hover:bg-muted",
                  option.disabled && "opacity-50 pointer-events-none"
                )}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className="size-4 flex items-center justify-center shrink-0">
                    {isSelected && (
                      <CheckIcon className="size-3.5 text-primary stroke-[2.5]" />
                    )}
                  </div>
                  {option.icon && (
                    <span className="shrink-0 text-muted-foreground flex items-center">
                      {option.icon}
                    </span>
                  )}
                  <span className="truncate">{option.label}</span>
                </div>
                {option.badge && (
                  <span className="shrink-0">{option.badge}</span>
                )}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  </div>
);
}
