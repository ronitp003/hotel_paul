import { cn } from "@/lib/utils";
import { formatINR, toDecimal, type DecimalValue } from "@/lib/money";

interface MoneyTextProps {
  amount: DecimalValue;
  className?: string;
  variant?: "default" | "balance" | "positive" | "negative";
  showSign?: boolean;
}

export function MoneyText({
  amount,
  className,
  variant = "default",
  showSign = false,
}: MoneyTextProps) {
  const dec = toDecimal(amount);
  const formatted = formatINR(dec.abs());
  const isZero = dec.isZero();
  const isNegative = dec.isNegative();

  let colorClass = "text-foreground";
  if (variant === "balance") {
    // Balance due (> 0) is red, settled (0) is green
    colorClass = dec.gt(0) ? "text-money-due font-semibold" : "text-money-ok font-medium";
  } else if (variant === "positive") {
    colorClass = "text-money-ok";
  } else if (variant === "negative") {
    colorClass = "text-money-due";
  }

  return (
    <span
      className={cn(
        "font-mono tabular-nums tracking-tight whitespace-nowrap",
        colorClass,
        className
      )}
    >
      {isNegative ? "- " : showSign && !isZero ? "+ " : ""}
      {formatted}
    </span>
  );
}
