import Link from "next/link";
import { type ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { ChevronRightIcon } from "@/lib/icons";
import { cn } from "@/lib/utils";

export interface StatCardProps {
  title: string;
  value: ReactNode;
  icon: ReactNode;
  hint?: ReactNode;
  href?: string;
  badge?: ReactNode;
  className?: string;
  size?: "default" | "compact";
}

export function StatCard({
  title,
  value,
  icon,
  hint,
  href,
  badge,
  className,
  size = "default",
}: StatCardProps) {
  const isCompact = size === "compact";

  const content = (
    <Card
      className={cn(
        "flex flex-col justify-between transition-all hover:border-foreground/20",
        isCompact ? "p-3 py-2.5 sm:p-3" : "p-4",
        href && "cursor-pointer group",
        className
      )}
    >
      <div>
        <div className="flex items-center justify-between gap-2 text-muted-foreground">
          <span
            className={cn(
              "font-medium uppercase tracking-wider truncate",
              isCompact ? "text-[11px]" : "text-xs"
            )}
          >
            {title}
          </span>
          <div className="text-muted-foreground group-hover:text-primary transition-colors shrink-0">
            {icon}
          </div>
        </div>

        <div
          className={cn(
            "flex items-baseline justify-between gap-2 flex-wrap",
            isCompact ? "mt-1.5" : "mt-3"
          )}
        >
          <div
            className={cn(
              "font-bold font-mono tracking-tight text-foreground",
              isCompact ? "text-xl sm:text-2xl" : "text-2xl sm:text-3xl"
            )}
          >
            {value}
          </div>
          {badge && <div>{badge}</div>}
        </div>
      </div>

      <div
        className={cn(
          "flex items-center justify-between text-muted-foreground border-t border-border/50",
          isCompact ? "mt-2 pt-1.5 text-[11px]" : "mt-3 pt-2.5 text-xs"
        )}
      >
        <div className="truncate">{hint || <span className="opacity-0">-</span>}</div>
        {href && (
          <ChevronRightIcon
            className="size-3 text-muted-foreground/60 group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0 ml-1"
            aria-hidden="true"
          />
        )}
      </div>
    </Card>
  );

  if (href) {
    return (
      <Link href={href} className="block outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xl">
        {content}
      </Link>
    );
  }

  return content;
}
