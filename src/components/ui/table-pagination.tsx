"use client";

import { Button } from "@/components/ui/button";
import { ChevronLeftIcon, ChevronRightIcon } from "@/lib/icons";
import { cn } from "@/lib/utils";

export interface TablePaginationProps {
  currentPage: number;
  totalRecords: number;
  pageSize?: number;
  onPageChange: (page: number) => void;
  recordLabel?: string;
  className?: string;
}

export function TablePagination({
  currentPage,
  totalRecords,
  pageSize = 10,
  onPageChange,
  recordLabel = "records",
  className,
}: TablePaginationProps) {
  const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);

  const startRecord = totalRecords === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const endRecord = Math.min(safePage * pageSize, totalRecords);

  const canGoPrev = safePage > 1;
  const canGoNext = safePage < totalPages && totalRecords > 0;

  // Generate page numbers for direct navigation
  const getPageNumbers = () => {
    if (totalPages <= 5) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    const pages: (number | "ellipsis")[] = [];
    if (safePage <= 3) {
      pages.push(1, 2, 3, 4, "ellipsis", totalPages);
    } else if (safePage >= totalPages - 2) {
      pages.push(
        1,
        "ellipsis",
        totalPages - 3,
        totalPages - 2,
        totalPages - 1,
        totalPages
      );
    } else {
      pages.push(
        1,
        "ellipsis",
        safePage - 1,
        safePage,
        safePage + 1,
        "ellipsis",
        totalPages
      );
    }
    return pages;
  };

  return (
    <div
      className={cn(
        "flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-border bg-card/60 text-xs text-muted-foreground",
        className
      )}
    >
      <div className="flex items-center gap-1.5 flex-wrap">
        <span>
          Showing{" "}
          <span className="font-semibold text-foreground font-mono">
            {startRecord}
          </span>
          {" "}&ndash;{" "}
          <span className="font-semibold text-foreground font-mono">
            {endRecord}
          </span>{" "}
          of{" "}
          <span className="font-semibold text-foreground font-mono">
            {totalRecords}
          </span>{" "}
          {recordLabel}
        </span>
        <span className="text-muted-foreground/50">&bull;</span>
        <span>
          Page{" "}
          <span className="font-semibold text-foreground font-mono">
            {safePage}
          </span>{" "}
          of{" "}
          <span className="font-semibold text-foreground font-mono">
            {totalPages}
          </span>
        </span>
      </div>

      <div className="flex items-center gap-1.5">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onPageChange(safePage - 1)}
          disabled={!canGoPrev}
          className="h-7 px-2 text-xs font-medium"
          aria-label="Previous Page"
        >
          <ChevronLeftIcon className="size-3.5 mr-1" />
          Previous
        </Button>

        <div className="hidden sm:flex items-center gap-1">
          {getPageNumbers().map((p, idx) => {
            if (p === "ellipsis") {
              return (
                <span
                  key={`ellipsis-${idx}`}
                  className="px-1 text-muted-foreground select-none"
                >
                  &hellip;
                </span>
              );
            }
            const isCurrent = p === safePage;
            return (
              <button
                key={p}
                type="button"
                onClick={() => onPageChange(p)}
                className={cn(
                  "size-7 rounded-md text-xs font-medium font-mono transition-colors",
                  isCurrent
                    ? "bg-primary text-primary-foreground font-bold shadow-xs"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
                aria-current={isCurrent ? "page" : undefined}
                aria-label={`Page ${p}`}
              >
                {p}
              </button>
            );
          })}
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onPageChange(safePage + 1)}
          disabled={!canGoNext}
          className="h-7 px-2 text-xs font-medium"
          aria-label="Next Page"
        >
          Next
          <ChevronRightIcon className="size-3.5 ml-1" />
        </Button>
      </div>
    </div>
  );
}
