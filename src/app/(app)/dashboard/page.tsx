import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/status-badge";
import { MoneyText } from "@/components/shared/money-text";
import { RoomIcon, GuestIcon, PaymentIcon, NewBookingIcon } from "@/lib/icons";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Property overview, room occupancy, and daily operational status."
      >
        <Link href="/bookings/new">
          <Button className="gap-2">
            <NewBookingIcon className="size-4" aria-hidden="true" />
            <span>New Booking / Check-in</span>
          </Button>
        </Link>
      </PageHeader>

      {/* KPI Cards Preview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Occupied Rooms</span>
            <RoomIcon className="size-4 text-primary" aria-hidden="true" />
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-3xl font-bold tracking-tight">0</span>
            <StatusBadge status="OCCUPIED" label="0 Rooms" />
          </div>
        </Card>

        <Card className="p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Available Rooms</span>
            <RoomIcon className="size-4 text-status-available" aria-hidden="true" />
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-3xl font-bold tracking-tight">0</span>
            <StatusBadge status="AVAILABLE" label="0 Ready" />
          </div>
        </Card>

        <Card className="p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Arrivals Today</span>
            <GuestIcon className="size-4 text-primary" aria-hidden="true" />
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-3xl font-bold tracking-tight">0</span>
            <span className="text-xs text-muted-foreground">0 checked in</span>
          </div>
        </Card>

        <Card className="p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Billed This Month</span>
            <PaymentIcon className="size-4 text-primary" aria-hidden="true" />
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-2xl font-bold tracking-tight">
              <MoneyText amount={0} />
            </span>
          </div>
        </Card>
      </div>

      {/* Quick Setup Notice */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">
            System Initialized (Phase 0 Foundation)
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>
            Hotel Desk foundation setup is active with strict TypeScript, design tokens, IST date-time processing, decimal money arithmetic, and responsive application navigation.
          </p>
          <div className="flex flex-wrap gap-2 pt-2">
            <StatusBadge status="AVAILABLE" label="Design Tokens" />
            <StatusBadge status="RESERVED" label="IST Timezone" />
            <StatusBadge status="OCCUPIED" label="shadcn/ui" />
            <StatusBadge status="MAINTENANCE" label="react-icons/lu" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
