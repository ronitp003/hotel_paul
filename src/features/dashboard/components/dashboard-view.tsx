"use client";

import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { MoneyText } from "@/components/shared/money-text";
import { DepartingTodayCard, ArrivingTodayCard } from "./arrivals-departures-tables";
import { ForecastChart } from "./forecast-chart";
import {
  RoomIcon,
  MaintenanceIcon,
  ProblemIcon,
  CheckInIcon,
  CheckOutIcon,
  PaymentIcon,
  InvoiceIcon,
  RupeeIcon,
  InventoryIcon,
} from "@/lib/icons";
import { cn } from "@/lib/utils";
import type { DashboardSummary } from "@/features/dashboard/schemas";

interface DashboardViewProps {
  data: DashboardSummary;
  userRole?: string;
}

export function DashboardView({ data, userRole = "OWNER" }: DashboardViewProps) {
  const isOwner = userRole === "OWNER";
  const canViewFinancials = isOwner && data.billing !== null;

  const occupancyRate =
    data.rooms.total > 0
      ? Math.round((data.rooms.occupied / data.rooms.total) * 100)
      : 0;

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Page Header (New Booking / Check-in button removed per design requirement) */}
      <PageHeader
        title="Dashboard"
        description="Property overview, room occupancy, daily operations, inventory alerts, and revenue summary."
      />

      {/* KPI Section 1: Live Room Occupancy (Noticeably shorter/compact cards) */}
      <div className="space-y-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Live Room Occupancy
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          <StatCard
            size="compact"
            title="Occupied Rooms"
            value={data.rooms.occupied}
            icon={<RoomIcon className="size-4 sm:size-5 text-status-occupied" aria-hidden="true" />}
            badge={<StatusBadge status="OCCUPIED" label={`${occupancyRate}%`} />}
            hint={`${data.rooms.occupied} of ${data.rooms.total} rooms`}
            href="/rooms?status=OCCUPIED"
          />

          <StatCard
            size="compact"
            title="Available Rooms"
            value={data.rooms.available}
            icon={<RoomIcon className="size-4 sm:size-5 text-status-available" aria-hidden="true" />}
            badge={<StatusBadge status="AVAILABLE" label={`${data.rooms.available} Ready`} />}
            hint="Ready for check-in"
            href="/rooms?status=AVAILABLE"
          />

          <StatCard
            size="compact"
            title="Under Maintenance"
            value={data.rooms.maintenance}
            icon={<MaintenanceIcon className="size-4 sm:size-5 text-status-maintenance" aria-hidden="true" />}
            badge={
              data.rooms.maintenance > 0 ? (
                <StatusBadge status="MAINTENANCE" label={`${data.rooms.maintenance} Blocked`} />
              ) : undefined
            }
            hint={data.rooms.maintenance > 0 ? "Unavailable for booking" : "All rooms operational"}
            href="/rooms?status=MAINTENANCE"
          />

          <StatCard
            size="compact"
            title="Rooms with Problems"
            value={data.rooms.problems}
            icon={<ProblemIcon className="size-4 sm:size-5 text-status-problem" aria-hidden="true" />}
            badge={
              data.rooms.problems > 0 ? (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-status-problem/15 text-status-problem">
                  <span className="size-1.5 rounded-full bg-status-problem animate-pulse" />
                  Action needed
                </span>
              ) : undefined
            }
            hint={data.rooms.problems > 0 ? "Open maintenance tickets" : "No open problems"}
            href="/rooms?hasProblem=true"
          />
        </div>
      </div>

      {/* KPI Section 2: Operations, Finance & Inventory (Role-based, full height cards) */}
      <div className="space-y-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Operations, Finance & Inventory
        </h2>
        <div
          className={cn(
            "grid gap-3 sm:gap-4",
            canViewFinancials
              ? "grid-cols-2 sm:grid-cols-3 xl:grid-cols-6"
              : "grid-cols-2 sm:grid-cols-2 lg:grid-cols-4"
          )}
        >
          <StatCard
            size="default"
            title="Arrivals Today"
            value={data.movements.arrivals.total}
            icon={<CheckInIcon className="size-5 text-primary" aria-hidden="true" />}
            badge={
              <span className="text-xs font-mono text-muted-foreground font-medium">
                {data.movements.arrivals.checkedIn} in
              </span>
            }
            hint={`${data.movements.arrivals.expected} expected check-in${data.movements.arrivals.expected === 1 ? "" : "s"}`}
            href="/bookings?status=RESERVED"
          />

          <StatCard
            size="default"
            title="Departures Today"
            value={data.movements.departures.total}
            icon={<CheckOutIcon className="size-5 text-primary" aria-hidden="true" />}
            badge={
              <span className="text-xs font-mono text-muted-foreground font-medium">
                {data.movements.departures.checkedOut} out
              </span>
            }
            hint={`${data.movements.departures.pending} pending check-out${data.movements.departures.pending === 1 ? "" : "s"}`}
            href="/bookings?status=CHECKED_IN"
          />

          <StatCard
            size="default"
            title="Payments Due"
            value={<MoneyText amount={data.paymentsDue.totalAmount} />}
            icon={<PaymentIcon className="size-5 text-destructive" aria-hidden="true" />}
            hint={`${data.paymentsDue.count} active stay${data.paymentsDue.count === 1 ? "" : "s"} with balance`}
            href="/payments?status=DUE"
          />

          <StatCard
            size="default"
            title="Low Stock"
            value={data.lowStock.count}
            icon={<InventoryIcon className="size-5 text-amber-500" aria-hidden="true" />}
            badge={
              data.lowStock.count > 0 ? (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/15 text-rose-600 dark:text-rose-400">
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
          />

          {canViewFinancials && data.billing && (
            <>
              <StatCard
                size="default"
                title="Billed This Month"
                value={<MoneyText amount={data.billing.totalBilled} />}
                icon={<InvoiceIcon className="size-5 text-primary" aria-hidden="true" />}
                hint={`${data.billing.invoicesCount} tax invoice${data.billing.invoicesCount === 1 ? "" : "s"} issued`}
                href="/payments"
              />

              <StatCard
                size="default"
                title="GST Payable"
                value={<MoneyText amount={data.billing.totalGst} />}
                icon={<RupeeIcon className="size-5 text-primary" aria-hidden="true" />}
                hint={`CGST + SGST (${data.billing.monthName})`}
                href="/payments"
              />
            </>
          )}
        </div>
      </div>

      {/* Row 1: Two-column layout (7-Day Forecast & Departing Today) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
        <ForecastChart
          data={data.forecast}
          className="h-[390px] flex flex-col justify-between"
        />
        <DepartingTodayCard
          departures={data.departingToday}
          className="h-[390px] flex flex-col"
        />
      </div>

      {/* Row 2: Arriving Today Section (Occupies full available width) */}
      <div className="w-full">
        <ArrivingTodayCard arrivals={data.arrivingToday} />
      </div>
    </div>
  );
}
