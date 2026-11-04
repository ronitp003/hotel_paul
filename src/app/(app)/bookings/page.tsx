import { requireRole } from "@/server/auth/permissions";
import { ROLES } from "@/lib/constants";
import { bookingService } from "@/server/services/booking.service";
import { BookingsTable } from "@/features/bookings/components/bookings-table";
import { GuestIcon } from "@/lib/icons";
import { NewBookingButton } from "@/features/bookings/components/new-booking-button";

export const metadata = {
  title: "Bookings | Hotel Paul",
  description:
    "View and manage front desk guest bookings, reservations, and stays",
};

export default async function BookingsPage() {
  await requireRole([ROLES.OWNER, ROLES.RECEPTIONIST]);

  const { bookings, total } = await bookingService.listBookings({ limit: 500 });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <GuestIcon className="size-6 text-primary" aria-hidden="true" />
            Bookings & Reservations
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Overview of upcoming reservations, currently occupied rooms, and
            past stays.
          </p>
        </div>

        <NewBookingButton className="h-10 px-4">
          New Booking / Check-in
        </NewBookingButton>
      </div>

      {/* Table Content */}
      <BookingsTable initialBookings={bookings} total={total} />
    </div>
  );
}
