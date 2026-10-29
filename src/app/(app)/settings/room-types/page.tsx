import { requireRole } from "@/server/auth/permissions";
import { ROLES } from "@/lib/constants";
import { roomTypeService } from "@/server/services/room-type.service";
import { RoomTypesManager } from "@/features/rooms/components/room-types-manager";

export default async function RoomTypesSettingsPage() {
  await requireRole([ROLES.OWNER]);
  const types = await roomTypeService.listRoomTypes();

  return (
    <div className="space-y-4">
      <RoomTypesManager initialTypes={types} />
    </div>
  );
}
