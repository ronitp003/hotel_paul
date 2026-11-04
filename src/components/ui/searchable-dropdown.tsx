"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { ChevronDownIcon, CheckIcon, SearchIcon } from "@/lib/icons";
import { Input } from "@/components/ui/input";

export interface SearchableDropdownOption {
  value: string;
  label: string;
  sublabel?: string;
  badge?: string;
  disabled?: boolean;
}

export interface SearchableDropdownProps {
  id?: string;
  label?: string;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  disabled?: boolean;
  value?: string;
  displayValue?: string;
  options: SearchableDropdownOption[];
  onSelect: (value: string) => void;
  className?: string;
  error?: boolean | string;
  retainValueDisplay?: boolean;
}

export function SearchableDropdown({
  id,
  label,
  placeholder = "Select an option...",
  searchPlaceholder = "Search...",
  emptyMessage = "No matching options found.",
  disabled = false,
  value,
  displayValue,
  options,
  onSelect,
  className,
  error = false,
  retainValueDisplay = true,
}: SearchableDropdownProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [highlightedIndex, setHighlightedIndex] = React.useState(-1);

  const containerRef = React.useRef<HTMLDivElement>(null);
  const searchInputRef = React.useRef<HTMLInputElement>(null);
  const listRef = React.useRef<HTMLDivElement>(null);

  const selectedOption = React.useMemo(
    () => options.find((opt) => opt.value === value),
    [options, value]
  );

  const filteredOptions = React.useMemo(() => {
    if (!search.trim()) return options;
    const q = search.toLowerCase();
    return options.filter(
      (opt) =>
        opt.label.toLowerCase().includes(q) ||
        (opt.sublabel && opt.sublabel.toLowerCase().includes(q)) ||
        (opt.badge && opt.badge.toLowerCase().includes(q))
    );
  }, [options, search]);

  // Close on outside click
  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setSearch("");
        setHighlightedIndex(-1);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const handleOpen = () => {
    if (disabled) return;
    setIsOpen((prev) => {
      const next = !prev;
      if (!next) {
        setSearch("");
        setHighlightedIndex(-1);
      }
      return next;
    });
  };

  const handleSelectOption = (opt: SearchableDropdownOption) => {
    if (opt.disabled) return;
    onSelect(opt.value);
    setIsOpen(false);
    setSearch("");
    setHighlightedIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;

    if (!isOpen) {
      if (e.key === "Enter" || e.key === "ArrowDown" || e.key === " ") {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    if (e.key === "Escape") {
      e.preventDefault();
      setIsOpen(false);
      setSearch("");
      setHighlightedIndex(-1);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        prev < filteredOptions.length - 1 ? prev + 1 : 0
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        prev > 0 ? prev - 1 : filteredOptions.length - 1
      );
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (
        highlightedIndex >= 0 &&
        highlightedIndex < filteredOptions.length
      ) {
        handleSelectOption(filteredOptions[highlightedIndex]);
      }
    }
  };

  const displayText =
    displayValue ||
    (retainValueDisplay && selectedOption ? selectedOption.label : null) ||
    placeholder;

  const isPlaceholder =
    !displayValue && (!retainValueDisplay || !selectedOption);

  return (
    <div
      ref={containerRef}
      className={cn("relative w-full text-left", className)}
      onKeyDown={handleKeyDown}
    >
      {label && (
        <label
          htmlFor={id}
          className="block text-xs font-semibold text-foreground mb-1.5"
        >
          {label}
        </label>
      )}

      {/* Trigger Button */}
      <button
        type="button"
        id={id}
        disabled={disabled}
        onClick={handleOpen}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className={cn(
          "w-full flex items-center justify-between gap-2 px-3 h-9 rounded-md border border-input bg-background text-xs font-medium text-foreground shadow-2xs transition-colors",
          "hover:bg-muted/50 focus:outline-none focus:ring-1 focus:ring-ring focus:border-ring",
          isPlaceholder && "text-muted-foreground font-normal",
          disabled && "opacity-50 cursor-not-allowed bg-muted/40",
          error && "border-destructive focus:ring-destructive focus:border-destructive"
        )}
      >
        <span className="truncate">{displayText}</span>
        <ChevronDownIcon
          className={cn(
            "size-3.5 text-muted-foreground shrink-0 transition-transform duration-150",
            isOpen && "rotate-180"
          )}
          aria-hidden="true"
        />
      </button>

      {/* Floating Dropdown Panel */}
      {isOpen && (
        <div className="absolute z-50 left-0 right-0 top-full mt-1.5 rounded-lg border border-border bg-popover text-popover-foreground shadow-lg p-1.5 space-y-1 animate-in fade-in-0 zoom-in-95 duration-100">
          {/* Search Box */}
          <div className="relative">
            <SearchIcon
              className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none"
              aria-hidden="true"
            />
            <Input
              ref={searchInputRef}
              type="text"
              autoFocus
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setHighlightedIndex(0);
              }}
              placeholder={searchPlaceholder}
              className="h-8 pl-8 pr-2 text-xs bg-background"
            />
          </div>

          {/* Options List */}
          <div
            ref={listRef}
            role="listbox"
            className="max-h-52 overflow-y-auto space-y-0.5 custom-scrollbar pt-0.5"
          >
            {filteredOptions.length === 0 ? (
              <div className="p-3 text-center text-xs text-muted-foreground">
                {emptyMessage}
              </div>
            ) : (
              filteredOptions.map((opt, idx) => {
                const isSelected = opt.value === value;
                const isHighlighted = idx === highlightedIndex;

                return (
                  <button
                    key={opt.value}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    disabled={opt.disabled}
                    onClick={() => handleSelectOption(opt)}
                    onMouseEnter={() => setHighlightedIndex(idx)}
                    className={cn(
                      "w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-md text-xs text-left transition-colors cursor-pointer",
                      isHighlighted && "bg-muted/80 text-foreground",
                      isSelected && "bg-primary/10 text-primary font-semibold",
                      opt.disabled &&
                        "opacity-50 cursor-not-allowed pointer-events-none"
                    )}
                  >
                    <div className="flex items-center gap-2 min-w-0 truncate">
                      <span className="truncate">{opt.label}</span>
                      {opt.sublabel && (
                        <span className="text-[11px] text-muted-foreground font-mono shrink-0">
                          {opt.sublabel}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {opt.badge && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-muted text-muted-foreground border border-border/60">
                          {opt.badge}
                        </span>
                      )}
                      {isSelected && (
                        <CheckIcon className="size-3 text-primary stroke-[3]" />
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

