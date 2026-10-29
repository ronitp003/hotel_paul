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
}

export function StatCard({
  title,
  value,
  icon,
  hint,
  href,
  badge,
  className,
}: StatCardProps) {
  const content = (
    <Card
      className={cn(
        "p-4 flex flex-col justify-between transition-all hover:border-foreground/20",
        href && "cursor-pointer group",
        className
      )}
    >
      <div>
        <div className="flex items-center justify-between gap-2 text-muted-foreground">
          <span className="text-xs font-medium uppercase tracking-wider truncate">
            {title}
          </span>
          <div className="text-muted-foreground group-hover:text-primary transition-colors shrink-0">
            {icon}
          </div>
        </div>

        <div className="mt-3 flex items-baseline justify-between gap-2 flex-wrap">
          <div className="text-2xl sm:text-3xl font-bold font-mono tracking-tight text-foreground">
            {value}
          </div>
          {badge && <div>{badge}</div>}
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground border-t border-border/50 pt-2.5">
        <div className="truncate">{hint || <span className="opacity-0">-</span>}</div>
        {href && (
          <ChevronRightIcon
            className="size-3.5 text-muted-foreground/60 group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0 ml-1"
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
