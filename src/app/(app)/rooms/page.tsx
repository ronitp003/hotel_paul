import { requireSession } from "@/server/auth/session";
import { roomService } from "@/server/services/room.service";
import { roomTypeService } from "@/server/services/room-type.service";
import { PageHeader } from "@/components/layout/page-header";
import { RoomsManager } from "@/features/rooms/components/rooms-manager";

export default async function RoomsPage() {
  const { actor } = await requireSession();

  const [rooms, roomTypes] = await Promise.all([
    roomService.listRoomsWithStatus(),
    roomTypeService.listRoomTypes(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Rooms Inventory"
        description="Glanceable front-desk view: Live occupancy status, nightly room pricing, and maintenance alerts."
      />

      <RoomsManager
        initialRooms={rooms}
        roomTypes={roomTypes}
        userRole={actor.role}
      />
    </div>
  );
}
