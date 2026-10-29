import { requireRole } from "@/server/auth/permissions";
import { ROLES } from "@/lib/constants";
import { roomTypeService } from "@/server/services/room-type.service";
import { roomService } from "@/server/services/room.service";
import { settingsService } from "@/server/services/settings.service";
import { NewBookingFlow } from "@/features/bookings/components/new-booking-flow";

export const metadata = {
  title: "New Booking & Check-in | Hotel Paul",
  description: "Front desk booking, reservation, and room check-in management",
};

interface PageProps {
  searchParams: Promise<{ roomId?: string }>;
}

export default async function NewBookingPage({ searchParams }: PageProps) {
  await requireRole([ROLES.OWNER, ROLES.RECEPTIONIST]);
  const resolvedParams = await searchParams;

  const [roomTypes, settings] = await Promise.all([
    roomTypeService.listRoomTypes(),
    settingsService.getSettings(),
  ]);

  // Default window: now to +24 hours
  const checkIn = new Date();
  const checkOut = new Date(checkIn.getTime() + 24 * 60 * 60 * 1000);

  const initialAvailability = await roomService.findAvailableRooms(checkIn, checkOut);

  return (
    <div className="py-2">
      <NewBookingFlow
        roomTypes={roomTypes.map((t) => ({ id: t.id, name: t.name }))}
        initialRooms={initialAvailability.rooms}
        preselectedRoomId={resolvedParams.roomId}
        graceMinutes={settings.hotel.graceMinutes}
      />
    </div>
  );
}
