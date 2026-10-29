CREATE EXTENSION IF NOT EXISTS btree_gist;

-- No two active bookings for the same room may overlap in time.
-- Half-open range '[)' allows checkout 10:00 and next check-in 10:00.
ALTER TABLE "Booking"
  ADD CONSTRAINT booking_no_overlap
  EXCLUDE USING gist (
    "roomId" WITH =,
    tstzrange("checkInAt", "checkOutAt", '[)') WITH &&
  ) WHERE ("status" IN ('RESERVED','CHECKED_IN'));

-- No overlapping maintenance periods for the same room.
ALTER TABLE "RoomMaintenance"
  ADD CONSTRAINT maintenance_no_overlap
  EXCLUDE USING gist (
    "roomId" WITH =,
    tstzrange("startsAt", "endsAt", '[)') WITH &&
  );

ALTER TABLE "Booking" ADD CONSTRAINT booking_time_order CHECK ("checkOutAt" > "checkInAt");
ALTER TABLE "RoomMaintenance" ADD CONSTRAINT maint_time_order CHECK ("endsAt" > "startsAt");
ALTER TABLE "Payment" ADD CONSTRAINT payment_positive CHECK ("amount" > 0);