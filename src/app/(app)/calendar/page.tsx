import Link from "next/link";
import { requireSession } from "@/server/auth/session";
import { roomTypeService } from "@/server/services/room-type.service";
import { PageHeader } from "@/components/layout/page-header";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { NewBookingIcon } from "@/lib/icons";
import { CalendarTimeline } from "@/features/calendar/components/calendar-timeline";

export const metadata = {
  title: "Calendar Timeline | Hotel Paul",
  description: "Visual timeline of all room stays and maintenance against exact date and time.",
};

export default async function CalendarPage() {
  await requireSession();

  const roomTypes = await roomTypeService.listRoomTypes();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Calendar Timeline"
        description="Visual timeline of all room stays and maintenance against exact date and time."
      >
        <Link
          href="/bookings/new"
          className={cn(buttonVariants({ variant: "default", size: "sm" }), "gap-1.5 font-semibold")}
        >
          <NewBookingIcon className="size-4" />
          <span>New Booking</span>
        </Link>
      </PageHeader>

      <CalendarTimeline roomTypes={roomTypes} />
    </div>
  );
}
