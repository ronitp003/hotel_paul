"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { MoneyText } from "@/components/shared/money-text";
import { ArrivalsDeparturesTables } from "./arrivals-departures-tables";
import {
  RoomIcon,
  MaintenanceIcon,
  ProblemIcon,
  CheckInIcon,
  CheckOutIcon,
  PaymentIcon,
  InvoiceIcon,
  RupeeIcon,
  NewBookingIcon,
} from "@/lib/icons";
import type { DashboardSummary } from "@/features/dashboard/schemas";

interface DashboardViewProps {
  data: DashboardSummary;
}

export function DashboardView({ data }: DashboardViewProps) {
  const occupancyRate =
    data.rooms.total > 0
      ? Math.round((data.rooms.occupied / data.rooms.total) * 100)
      : 0;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Dashboard"
        description="Property overview, room occupancy, daily operations, and month-to-date billing."
      >
        <Link href="/bookings/new">
          <Button className="gap-2 font-semibold">
            <NewBookingIcon className="size-4" aria-hidden="true" />
            <span>New Booking / Check-in</span>
          </Button>
        </Link>
      </PageHeader>

      {/* KPI Section 1: Room Occupancy Status */}
      <div className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Live Room Occupancy
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            title="Occupied Rooms"
            value={data.rooms.occupied}
            icon={<RoomIcon className="size-5 text-status-occupied" aria-hidden="true" />}
            badge={<StatusBadge status="OCCUPIED" label={`${occupancyRate}%`} />}
            hint={`${data.rooms.occupied} of ${data.rooms.total} rooms`}
            href="/rooms?status=OCCUPIED"
          />

          <StatCard
            title="Available Rooms"
            value={data.rooms.available}
            icon={<RoomIcon className="size-5 text-status-available" aria-hidden="true" />}
            badge={<StatusBadge status="AVAILABLE" label={`${data.rooms.available} Ready`} />}
            hint="Ready for check-in"
            href="/rooms?status=AVAILABLE"
          />

          <StatCard
            title="Under Maintenance"
            value={data.rooms.maintenance}
            icon={<MaintenanceIcon className="size-5 text-status-maintenance" aria-hidden="true" />}
            badge={
              data.rooms.maintenance > 0 ? (
                <StatusBadge status="MAINTENANCE" label={`${data.rooms.maintenance} Blocked`} />
              ) : undefined
            }
            hint={data.rooms.maintenance > 0 ? "Unavailable for booking" : "All rooms operational"}
            href="/rooms?status=MAINTENANCE"
          />

          <StatCard
            title="Rooms with Problems"
            value={data.rooms.problems}
            icon={<ProblemIcon className="size-5 text-status-problem" aria-hidden="true" />}
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

      {/* KPI Section 2: Today's Operations & Finance */}
      <div className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Today&apos;s Operations & Billing
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <StatCard
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
            title="Payments Due"
            value={<MoneyText amount={data.paymentsDue.totalAmount} />}
            icon={<PaymentIcon className="size-5 text-destructive" aria-hidden="true" />}
            hint={`${data.paymentsDue.count} active stay${data.paymentsDue.count === 1 ? "" : "s"} with balance`}
            href="/payments?status=DUE"
          />

          <StatCard
            title="Billed This Month"
            value={<MoneyText amount={data.billing.totalBilled} />}
            icon={<InvoiceIcon className="size-5 text-primary" aria-hidden="true" />}
            hint={`${data.billing.invoicesCount} tax invoice${data.billing.invoicesCount === 1 ? "" : "s"} issued`}
            href="/payments"
          />

          <StatCard
            title="GST Payable"
            value={<MoneyText amount={data.billing.totalGst} />}
            icon={<RupeeIcon className="size-5 text-primary" aria-hidden="true" />}
            hint={`CGST + SGST (${data.billing.monthName})`}
            href="/payments"
          />
        </div>
      </div>

      {/* Tables: Arriving Today & Departing Today */}
      <div className="space-y-3 pt-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Today&apos;s Movements
        </h2>
        <ArrivalsDeparturesTables
          arrivingToday={data.arrivingToday}
          departingToday={data.departingToday}
        />
      </div>
    </div>
  );
}
