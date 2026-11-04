"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { NewBookingIcon } from "@/lib/icons";
import { useBookingModal } from "@/features/bookings/context/booking-modal-context";
import { cn } from "@/lib/utils";

interface NewBookingButtonProps {
  className?: string;
  children?: ReactNode;
  size?: "default" | "sm" | "lg" | "icon";
  variant?: "default" | "outline" | "secondary" | "ghost";
  roomId?: string;
}

export function NewBookingButton({
  className,
  children,
  size = "default",
  variant = "default",
  roomId,
}: NewBookingButtonProps) {
  const { openBookingModal } = useBookingModal();

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      onClick={() => openBookingModal(roomId ? { preselectedRoomId: roomId } : undefined)}
      className={cn("font-semibold shadow-xs gap-1.5 cursor-pointer", className)}
    >
      <NewBookingIcon className="size-4 shrink-0" />
      <span>{children || "New Booking"}</span>
    </Button>
  );
}

