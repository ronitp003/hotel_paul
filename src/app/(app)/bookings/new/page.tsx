import { redirect } from "next/navigation";
import { requireRole } from "@/server/auth/permissions";
import { ROLES } from "@/lib/constants";

interface PageProps {
  searchParams: Promise<{ roomId?: string }>;
}

export default async function NewBookingPage({ searchParams }: PageProps) {
  await requireRole([ROLES.OWNER, ROLES.RECEPTIONIST]);
  const resolvedParams = await searchParams;

  const target = resolvedParams?.roomId
    ? `/bookings?new=true&roomId=${encodeURIComponent(resolvedParams.roomId)}`
    : `/bookings?new=true`;

  redirect(target);
}
