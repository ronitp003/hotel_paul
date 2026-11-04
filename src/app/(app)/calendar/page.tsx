import { requireSession } from "@/server/auth/session";
import { roomTypeService } from "@/server/services/room-type.service";
import { PageHeader } from "@/components/layout/page-header";
import { NewBookingButton } from "@/features/bookings/components/new-booking-button";
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
        <NewBookingButton size="sm">New Booking</NewBookingButton>
      </PageHeader>

      <CalendarTimeline roomTypes={roomTypes} />
    </div>
  );
}
