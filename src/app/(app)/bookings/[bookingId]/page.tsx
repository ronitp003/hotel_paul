import { notFound } from "next/navigation";
import { requireRole } from "@/server/auth/permissions";
import { ROLES } from "@/lib/constants";
import { bookingService } from "@/server/services/booking.service";
import { BookingDetailView } from "@/features/bookings/components/booking-detail-view";

interface BookingPageProps {
  params: Promise<{ bookingId: string }>;
}

export async function generateMetadata({ params }: BookingPageProps) {
  const { bookingId } = await params;
  try {
    const booking = await bookingService.getBooking(bookingId);
    return {
      title: `${booking.reference} — Booking Details | Hotel Paul`,
      description: `Stay and billing details for room ${booking.roomNumber}`,
    };
  } catch {
    return {
      title: "Booking Details | Hotel Paul",
    };
  }
}

export default async function BookingDetailPage({ params }: BookingPageProps) {
  await requireRole([ROLES.OWNER, ROLES.RECEPTIONIST]);
  const { bookingId } = await params;

  let booking;
  try {
    booking = await bookingService.getBooking(bookingId);
  } catch {
    notFound();
  }

  return <BookingDetailView booking={booking} />;
}
