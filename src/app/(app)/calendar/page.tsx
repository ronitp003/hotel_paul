import { requireSession } from "@/server/auth/session";
import { roomTypeService } from "@/server/services/room-type.service";
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
    <div className="space-y-2 flex flex-col h-[calc(100vh-96px)] lg:h-[calc(100vh-112px)] min-h-[480px]">
      <div className="flex items-center justify-between gap-3 pb-1.5 border-b border-border shrink-0">
        <div className="flex items-baseline gap-2">
          <h1 className="text-lg sm:text-xl font-bold tracking-tight text-foreground">
            Calendar Timeline
          </h1>
          <p className="text-xs text-muted-foreground hidden sm:inline">
            Room occupancy, reservations & maintenance timeline
          </p>
        </div>
        <NewBookingButton size="sm">New Booking</NewBookingButton>
      </div>

      <CalendarTimeline roomTypes={roomTypes} className="flex-1 min-h-0" />
    </div>
  );
}
