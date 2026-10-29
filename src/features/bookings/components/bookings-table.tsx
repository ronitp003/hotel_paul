"use client";

import { useState } from "react";
import Link from "next/link";
import { formatISTDateTime } from "@/lib/datetime";
import { formatINR } from "@/lib/money";
import { cn } from "@/lib/utils";
import {
  RoomIcon,
  CalendarIcon,
  SearchIcon,
  NewBookingIcon,
  CheckOutIcon,
} from "@/lib/icons";
import { Input } from "@/components/ui/input";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BookingStatus } from "@prisma/client";
import { useRouter } from "next/navigation";
import { CheckoutDialog } from "./checkout-dialog";

export interface BookingRow {
  id: string;
  reference: string;
  roomId: string;
  roomNumber: string;
  roomTypeName: string;
  status: BookingStatus;
  source: string;
  checkInAt: Date;
  checkOutAt: Date;
  actualCheckInAt: Date | null;
  actualCheckOutAt: Date | null;
  guestName: string;
  guestMobile: string | null;
  rateApplied: number;
  advancePaid: number;
}

interface BookingsTableProps {
  initialBookings: BookingRow[];
  total: number;
}

export function BookingsTable({ initialBookings, total }: BookingsTableProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [checkoutTarget, setCheckoutTarget] = useState<{
    id: string;
    reference: string;
    roomNumber: string;
  } | null>(null);

  const filtered = initialBookings.filter((b) => {
    if (statusFilter !== "ALL" && b.status !== statusFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      const matchRef = b.reference.toLowerCase().includes(q);
      const matchRoom = b.roomNumber.toLowerCase().includes(q);
      const matchGuest = b.guestName.toLowerCase().includes(q);
      if (!matchRef && !matchRoom && !matchGuest) return false;
    }
    return true;
  });

  const getStatusBadge = (status: BookingStatus) => {
    switch (status) {
      case "CHECKED_IN":
        return (
          <Badge className="bg-blue-600 hover:bg-blue-600 text-white font-medium text-xs">
            Occupied / Checked-In
          </Badge>
        );
      case "RESERVED":
        return (
          <Badge className="bg-amber-500 hover:bg-amber-500 text-white font-medium text-xs">
            Reserved
          </Badge>
        );
      case "CHECKED_OUT":
        return (
          <Badge className="bg-slate-500 hover:bg-slate-500 text-white font-medium text-xs">
            Checked Out
          </Badge>
        );
      case "CANCELLED":
        return (
          <Badge
            variant="outline"
            className="bg-red-50 text-red-700 border-red-300 dark:bg-red-950 dark:text-red-300 text-xs"
          >
            Cancelled
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card p-4 rounded-xl border border-border shadow-xs">
        <div className="relative flex-1 max-w-sm">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search by reference, room, or guest..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-sm"
          />
        </div>

        {/* Status Filter Buttons */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {[
            { id: "ALL", label: "All Stays" },
            { id: "CHECKED_IN", label: "Checked In" },
            { id: "RESERVED", label: "Reservations" },
            { id: "CHECKED_OUT", label: "Checked Out" },
            { id: "CANCELLED", label: "Cancelled" },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setStatusFilter(item.id)}
              className={cn(
                "px-3 py-1.5 rounded-md text-xs font-medium border transition-colors whitespace-nowrap",
                statusFilter === item.id
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card text-muted-foreground border-border hover:bg-muted"
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Count Indicator */}
      <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
        <span>
          Showing {filtered.length} of {total} record(s)
        </span>
      </div>

      {/* Bookings List / Table */}
      <div className="bg-card rounded-xl border border-border overflow-hidden shadow-xs">
        {filtered.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="size-12 rounded-full bg-muted/60 text-muted-foreground flex items-center justify-center mx-auto">
              <CalendarIcon className="size-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-semibold text-foreground">
                No bookings found
              </h3>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                {search || statusFilter !== "ALL"
                  ? "No bookings match the selected filters. Try clearing your search query."
                  : "There are no bookings recorded yet. Create a new reservation or check in a walk-in guest."}
              </p>
            </div>
            <Link
              href="/bookings/new"
              className={cn(buttonVariants({ size: "sm" }), "mt-2")}
            >
              <NewBookingIcon className="size-4 mr-1.5" />
              Create New Booking
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/50 border-b border-border text-muted-foreground font-semibold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="px-4 py-3">Reference</th>
                  <th className="px-4 py-3">Room</th>
                  <th className="px-4 py-3">Primary Guest</th>
                  <th className="px-4 py-3">Check-in / Check-out</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Tariff</th>
                  <th className="px-4 py-3 text-right">Advance Paid</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((b) => (
                  <tr
                    key={b.id}
                    className="hover:bg-muted/30 transition-colors"
                  >
                    <td className="px-4 py-3 font-mono font-bold">
                      <Link
                        href={`/bookings/${b.id}`}
                        className="text-primary hover:underline"
                      >
                        {b.reference}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <RoomIcon className="size-3.5 text-muted-foreground" />
                        <span className="font-bold text-foreground font-mono">
                          {b.roomNumber}
                        </span>
                        <span className="text-muted-foreground">
                          ({b.roomTypeName})
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col">
                        <span className="font-medium text-foreground">
                          {b.guestName}
                        </span>
                        {b.guestMobile && (
                          <span className="text-[11px] text-muted-foreground font-mono">
                            {b.guestMobile}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col font-mono text-[11px]">
                        <span>In: {formatISTDateTime(b.checkInAt)}</span>
                        <span className="text-muted-foreground">
                          Out: {formatISTDateTime(b.checkOutAt)}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">{getStatusBadge(b.status)}</td>
                    <td className="px-4 py-3 text-right font-mono font-semibold">
                      {formatINR(b.rateApplied)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                      {b.advancePaid > 0 ? formatINR(b.advancePaid) : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Link
                          href={`/bookings/${b.id}`}
                          className={cn(
                            buttonVariants({ variant: "ghost", size: "sm" }),
                            "h-7 px-2 text-xs"
                          )}
                        >
                          Details
                        </Link>
                        {b.status === "CHECKED_IN" && (
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() =>
                              setCheckoutTarget({
                                id: b.id,
                                reference: b.reference,
                                roomNumber: b.roomNumber,
                              })
                            }
                            className="h-7 px-2.5 text-xs font-semibold"
                          >
                            <CheckOutIcon className="size-3 mr-1" />
                            Check Out
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {checkoutTarget && (
        <CheckoutDialog
          bookingId={checkoutTarget.id}
          bookingRef={checkoutTarget.reference}
          roomNumber={checkoutTarget.roomNumber}
          open={!!checkoutTarget}
          onOpenChange={(isOpen) => {
            if (!isOpen) setCheckoutTarget(null);
          }}
          onSuccess={() => {
            setCheckoutTarget(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
