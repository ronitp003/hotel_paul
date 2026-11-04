"use client";

import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { MoneyText } from "@/components/shared/money-text";
import { DepartingTodayCard, ArrivingTodayCard } from "./arrivals-departures-tables";
import { RoomBoard } from "./room-board";
import {
  CheckInIcon,
  CheckOutIcon,
  PaymentIcon,
  InvoiceIcon,
  RupeeIcon,
  InventoryIcon,
} from "@/lib/icons";
import type { DashboardSummary } from "@/features/dashboard/schemas";
import type { RoomWithStatus } from "@/server/services/room.service";
import { cn } from "@/lib/utils";
import { NewBookingButton } from "@/features/bookings/components/new-booking-button";

interface DashboardViewProps {
  data: DashboardSummary;
  userRole?: string;
  rooms?: RoomWithStatus[];
}

export function DashboardView({
  data,
  userRole = "OWNER",
  rooms: propRooms,
}: DashboardViewProps) {
  const isOwner = userRole === "OWNER";
  const canViewFinancials = isOwner && data.billing !== null;
  const rooms = propRooms || data.roomList || [];

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Dashboard"
        description="Property overview, live room board, daily operations, inventory alerts, and revenue summary."
      >
        <NewBookingButton size="sm">New Booking / Check-in</NewBookingButton>
      </PageHeader>

      {/* 2. Operations, Finance & Inventory – All cards in ONE row on desktop */}
      <div className="space-y-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {canViewFinancials ? "Operations, Finance & Inventory" : "Operations & Inventory"}
        </h2>

        {/* Responsive Grid: 6 cards in 1 row on desktop for Owner; 3 cards for Receptionist */}
        <div
          className={cn(
            "grid gap-2 sm:gap-2.5",
            canViewFinancials
              ? "grid-cols-2 md:grid-cols-3 xl:grid-cols-6"
              : "grid-cols-1 sm:grid-cols-3"
          )}
        >
          {/* 1. Arrivals Today */}
          <StatCard
            size="compact"
            title="Arrivals Today"
            value={data.movements.arrivals.total}
            icon={<CheckInIcon className="size-4 text-primary" aria-hidden="true" />}
            badge={
              <span className="text-[10px] font-mono text-muted-foreground font-medium">
                {data.movements.arrivals.checkedIn} in
              </span>
            }
            hint={`${data.movements.arrivals.expected} expected check-in${data.movements.arrivals.expected === 1 ? "" : "s"}`}
            href="/bookings?status=RESERVED"
            className="p-2.5 sm:p-3 h-full min-h-[96px] flex flex-col justify-between"
          />

          {/* 2. Departing Today */}
          <StatCard
            size="compact"
            title="Departing Today"
            value={data.movements.departures.total}
            icon={<CheckOutIcon className="size-4 text-primary" aria-hidden="true" />}
            badge={
              <span className="text-[10px] font-mono text-muted-foreground font-medium">
                {data.movements.departures.checkedOut} out
              </span>
            }
            hint={`${data.movements.departures.pending} pending check-out${data.movements.departures.pending === 1 ? "" : "s"}`}
            href="/bookings?status=CHECKED_IN"
            className="p-2.5 sm:p-3 h-full min-h-[96px] flex flex-col justify-between"
          />

          {/* 3. Low Stock */}
          <StatCard
            size="compact"
            title="Low Stock"
            value={data.lowStock.count}
            icon={<InventoryIcon className="size-4 text-amber-500" aria-hidden="true" />}
            badge={
              data.lowStock.count > 0 ? (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/15 text-rose-600 dark:text-rose-400">
                  <span className="size-1.5 rounded-full bg-rose-500 animate-pulse" />
                  Restock
                </span>
              ) : (
                <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                  Adequate
                </span>
              )
            }
            hint={
              data.lowStock.count > 0
                ? `${data.lowStock.count} item(s) below reorder`
                : "All supplies healthy"
            }
            href="/inventory"
            className="p-2.5 sm:p-3 h-full min-h-[96px] flex flex-col justify-between"
          />

          {/* Financial cards: Owner View only */}
          {canViewFinancials && (
            <>
              {/* 4. Payments Due */}
              <StatCard
                size="compact"
                title="Payments Due"
                value={
                  <MoneyText
                    amount={data.paymentsDue.totalAmount}
                    className="text-base sm:text-lg font-bold font-mono"
                  />
                }
                icon={<PaymentIcon className="size-4 text-destructive" aria-hidden="true" />}
                hint={`${data.paymentsDue.count} active stay${data.paymentsDue.count === 1 ? "" : "s"} with balance`}
                href="/payments?status=DUE"
                className="p-2.5 sm:p-3 h-full min-h-[96px] flex flex-col justify-between"
              />

              {/* 5. Revenue */}
              <StatCard
                size="compact"
                title="Revenue"
                value={
                  <MoneyText
                    amount={data.billing?.totalBilled ?? 0}
                    className="text-base sm:text-lg font-bold font-mono"
                  />
                }
                icon={<InvoiceIcon className="size-4 text-primary" aria-hidden="true" />}
                hint={`${data.billing?.invoicesCount ?? 0} tax invoice${data.billing?.invoicesCount === 1 ? "" : "s"} (${data.billing?.monthName || "This Month"})`}
                href="/payments"
                className="p-2.5 sm:p-3 h-full min-h-[96px] flex flex-col justify-between"
              />

              {/* 6. GST Payable */}
              <StatCard
                size="compact"
                title="GST Payable"
                value={
                  <MoneyText
                    amount={data.billing?.totalGst ?? 0}
                    className="text-base sm:text-lg font-bold font-mono"
                  />
                }
                icon={<RupeeIcon className="size-4 text-primary" aria-hidden="true" />}
                hint={`CGST + SGST (${data.billing?.monthName || "This Month"})`}
                href="/payments"
                className="p-2.5 sm:p-3 h-full min-h-[96px] flex flex-col justify-between"
              />
            </>
          )}
        </div>
      </div>

      {/* 3. Main Dashboard – Two Column Layout (2:1 ratio) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-5 items-stretch">
        {/* Left Column: Dedicated Room Board (~66.67% width) */}
        <div className="lg:col-span-2 flex flex-col">
          <RoomBoard
            rooms={rooms}
            className="h-full min-h-[460px] lg:h-[520px]"
          />
        </div>

        {/* Right Column: Departing Today Panel (~33.33% width) */}
        <div className="lg:col-span-1 flex flex-col">
          <DepartingTodayCard
            departures={data.departingToday}
            className="h-full min-h-[460px] lg:h-[520px]"
          />
        </div>
      </div>

      {/* 4. Arriving Today – Full Width Section */}
      <div className="w-full">
        <ArrivingTodayCard arrivals={data.arrivingToday} />
      </div>
    </div>
  );
}
