import { notFound } from "next/navigation";
import { requireSession } from "@/server/auth/session";
import { roomMaintenanceService } from "@/server/services/room-maintenance.service";
import { RoomDetailsView } from "@/features/rooms/components/room-details-view";
import { AppError } from "@/lib/errors";

interface RoomDetailsPageProps {
  params: Promise<{ roomId: string }>;
}

export default async function RoomDetailsPage({ params }: RoomDetailsPageProps) {
  await requireSession();
  const { roomId } = await params;

  let data;
  try {
    data = await roomMaintenanceService.getRoomDetails(roomId);
  } catch (err: unknown) {
    if (err instanceof AppError && err.code === "ROOM_NOT_FOUND") {
      notFound();
    }
    throw err;
  }

  return <RoomDetailsView initialData={data} />;
}
