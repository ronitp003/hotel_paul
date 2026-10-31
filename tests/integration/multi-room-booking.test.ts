import "dotenv/config";
import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
} from "vitest";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, BookingStatus, Role, PaymentMode } from "@prisma/client";
import { bookingService } from "@/server/services/booking.service";
import { billingService } from "@/server/services/billing.service";
import { invoiceService } from "@/server/services/invoice.service";

const connectionString =
  process.env.DATABASE_URL_TEST || process.env.DATABASE_URL;

describe("Multi-Room Group Booking & Combined Billing (Integration)", () => {
  let pool: Pool;
  let prisma: PrismaClient;
  let typeIdA: string;
  let typeIdB: string;
  let room101Id: string;
  let room102Id: string;
  let testStaffUser: { id: string; name: string; email: string; role: Role };

  beforeAll(async () => {
    if (!connectionString) {
      throw new Error("No database connection string for tests");
    }
    pool = new Pool({ connectionString });
    const adapter = new PrismaPg(pool);
    prisma = new PrismaClient({ adapter });

    const user = await prisma.user.upsert({
      where: { email: "multi-room-tester@hotelpaul.in" },
      update: {},
      create: {
        name: "Group Booking Staff",
        email: "multi-room-tester@hotelpaul.in",
        role: Role.RECEPTIONIST,
      },
    });
    testStaffUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    };

    const typeA = await prisma.roomType.create({
      data: { name: `Deluxe_${Date.now()}` },
    });
    typeIdA = typeA.id;

    const typeB = await prisma.roomType.create({
      data: { name: `Executive_${Date.now()}` },
    });
    typeIdB = typeB.id;

    const r1 = await prisma.room.create({
      data: {
        number: `MR1_${Date.now().toString().slice(-4)}`,
        typeId: typeIdA,
        pricePerNight: 2000,
        isActive: true,
      },
    });
    room101Id = r1.id;

    const r2 = await prisma.room.create({
      data: {
        number: `MR2_${Date.now().toString().slice(-4)}`,
        typeId: typeIdB,
        pricePerNight: 3500,
        isActive: true,
      },
    });
    room102Id = r2.id;
  });

  afterAll(async () => {
    await prisma.invoice.deleteMany({
      where: { booking: { roomId: { in: [room101Id, room102Id] } } },
    });
    await prisma.payment.deleteMany({
      where: { booking: { roomId: { in: [room101Id, room102Id] } } },
    });
    await prisma.bookingGuest.deleteMany({
      where: { booking: { roomId: { in: [room101Id, room102Id] } } },
    });
    await prisma.booking.deleteMany({
      where: { roomId: { in: [room101Id, room102Id] } },
    });
    await prisma.room.deleteMany({
      where: { id: { in: [room101Id, room102Id] } },
    });
    await prisma.roomType.deleteMany({
      where: { id: { in: [typeIdA, typeIdB] } },
    });
    await prisma.$disconnect();
    await pool.end();
  });

  it("creates multiple linked bookings atomically under one groupBookingId with guest room allocations", async () => {
    const now = new Date();
    const checkInAt = new Date(now.getTime() + 2 * 60 * 60 * 1000); // in 2h
    const checkOutAt = new Date(checkInAt.getTime() + 48 * 60 * 60 * 1000); // 2 days

    const result = await bookingService.createBooking(
      testStaffUser,
      {
        roomId: room101Id,
        rooms: [
          { roomId: room101Id, rateApplied: 2000 },
          { roomId: room102Id, rateApplied: 3500 },
        ],
        checkInAt,
        checkOutAt,
        action: "RESERVE",
        source: "WALK_IN",
        rateApplied: 2000,
        advanceAmount: 1500,
        advanceMode: PaymentMode.UPI,
        guests: [
          {
            name: "Anjan Sen",
            mobile: "9830012345",
            sex: "MALE",
            age: 42,
            isPrimary: true,
          },
          {
            name: "Mousumi Sen",
            mobile: "9830012346",
            sex: "FEMALE",
            age: 38,
            isPrimary: false,
          },
          {
            name: "Rohan Sen",
            mobile: "9830012347",
            sex: "MALE",
            age: 18,
            isPrimary: false,
          },
        ],
      }
    );

    expect(result.groupBookingId).toBeDefined();
    expect(result.groupBookingId).toMatch(/^GRP-\d{8}-[A-Z0-9]{3}$/);
    expect(result.isGroupMaster).toBe(true);
    expect(result.groupRoomCount).toBe(2);

    // Verify in database
    const groupBookings = await prisma.booking.findMany({
      where: { groupBookingId: result.groupBookingId },
      include: { guests: true, payments: true },
      orderBy: { isGroupMaster: "desc" },
    });

    expect(groupBookings.length).toBe(2);

    const masterBooking = groupBookings.find((b) => b.isGroupMaster);
    const siblingBooking = groupBookings.find((b) => !b.isGroupMaster);

    expect(masterBooking).toBeDefined();
    expect(siblingBooking).toBeDefined();
    expect(masterBooking?.roomId).toBe(room101Id);
    expect(siblingBooking?.roomId).toBe(room102Id);

    // Advance payment is attached to master only
    expect(masterBooking?.payments.length).toBe(1);
    expect(Number(masterBooking?.payments[0].amount)).toBe(1500);
    expect(siblingBooking?.payments.length).toBe(0);

    // All rooms associated with primary guest; master retains party
    expect(masterBooking?.guests.length).toBe(3);
    expect(masterBooking?.guests.some((g) => g.isPrimary)).toBe(true);
    expect(siblingBooking?.guests.length).toBe(1);
    expect(siblingBooking?.guests[0].name).toBe("Anjan Sen");

    // Test listBookings: exactly ONE row per group booking with combined tariff & advance
    const listResult = await bookingService.listBookings({
      search: "Anjan Sen",
    });
    const groupRows = listResult.bookings.filter(
      (b) => b.groupBookingId === result.groupBookingId
    );
    expect(groupRows.length).toBe(1);
    expect(groupRows[0].rateApplied).toBe(5500); // 2000 + 3500 combined tariff
    expect(groupRows[0].advancePaid).toBe(1500); // combined advance paid
    expect(groupRows[0].groupRoomNumbers?.length).toBe(2);

    // Test getBooking: consolidated group room details with individual rates & group bill
    const bookingDetails = await bookingService.getBooking(result.id);
    expect(bookingDetails.groupRooms.length).toBe(2);
    expect(bookingDetails.groupRooms[0].rateApplied).toBe(2000);
    expect(bookingDetails.groupRooms[1].rateApplied).toBe(3500);
    expect(bookingDetails.groupBill).toBeDefined();
    expect(bookingDetails.groupBill?.roomCharges).toBe(11000);
  });

  it("calculates combined group bill aggregating room charges and advance deposit", async () => {
    // Fetch one of the created group bookings
    const sample = await prisma.booking.findFirst({
      where: { roomId: { in: [room101Id, room102Id] } },
    });
    expect(sample).toBeDefined();

    const bill = await billingService.getBookingBill(sample!.id);

    expect(bill.isGroup).toBe(true);
    expect(bill.groupRooms?.length).toBe(2);

    // 2 days stay:
    // Room 1: 2000 * 2 = 4000
    // Room 2: 3500 * 2 = 7000
    // Total room charges = 11,000
    expect(bill.bill.roomCharges).toBe(11000);
    expect(bill.bill.taxableAmount).toBe(11000);

    // Rate is <= 7500/night -> 5% GST (CGST 2.5%, SGST 2.5%)
    expect(bill.bill.gstPercent).toBe(5);
    expect(bill.bill.cgst).toBe(275);
    expect(bill.bill.sgst).toBe(275);
    expect(bill.bill.billAmount).toBe(11550);

    // Advance paid = 1500
    expect(bill.bill.advancePaid).toBe(1500);
    // Balance due = 11550 - 1500 = 10050
    expect(bill.bill.balanceDue).toBe(10050);
  });

  it("checks out all group rooms in a single transaction with combined Tax Invoice", async () => {
    const masterBooking = await prisma.booking.findFirst({
      where: { roomId: room101Id, isGroupMaster: true },
    });
    expect(masterBooking).toBeDefined();

    // First transition both bookings to CHECKED_IN
    await prisma.booking.updateMany({
      where: { groupBookingId: masterBooking!.groupBookingId },
      data: {
        status: BookingStatus.CHECKED_IN,
        actualCheckInAt: masterBooking!.checkInAt,
      },
    });

    // Check bill
    const bill = await billingService.getBookingBill(masterBooking!.id);

    // Checkout with settlement payment for balance
    const invoice = await invoiceService.checkoutAndIssueInvoice(
      testStaffUser,
      {
        bookingId: masterBooking!.id,
        paymentMode: PaymentMode.CASH,
        paymentAmount: bill.bill.balanceDue,
      }
    );

    expect(invoice.displayNo).toBeDefined();
    expect(invoice.bookingId).toBe(masterBooking!.id);

    // Verify all bookings in group are marked CHECKED_OUT
    const postCheckBookings = await prisma.booking.findMany({
      where: { groupBookingId: masterBooking!.groupBookingId },
    });
    expect(postCheckBookings.every((b) => b.status === BookingStatus.CHECKED_OUT)).toBe(true);
    expect(postCheckBookings.every((b) => b.actualCheckOutAt !== null)).toBe(true);

    // Verify invoice snapshot contains group rooms breakdown
    const invoiceInDb = await prisma.invoice.findUnique({
      where: { id: invoice.invoiceId },
    });
    expect(invoiceInDb).toBeDefined();

    const snapshot = invoiceInDb!.snapshot as unknown as {
      rooms?: Array<{
        roomNumber: string;
        roomCharges: number;
        occupants: string[];
      }>;
      totals: {
        roomCharges: number;
        billAmount: number;
      };
    };

    expect(snapshot.rooms).toBeDefined();
    expect(snapshot.rooms?.length).toBe(2);
    expect(snapshot.totals.roomCharges).toBe(11000);
    expect(snapshot.totals.billAmount).toBe(11550);
  });

  it("atomically checks in all rooms in a multi-room group reservation", async () => {
    const checkIn = new Date(Date.now() + 86400000 * 5);
    const checkOut = new Date(Date.now() + 86400000 * 7);

    const res = await bookingService.createBooking(testStaffUser, {
      checkInAt: checkIn,
      checkOutAt: checkOut,
      rooms: [
        { roomId: room101Id, rateApplied: 2000 },
        { roomId: room102Id, rateApplied: 3500 },
      ],
      guests: [
        {
          name: "Group Checkin Tester",
          mobile: "9876543210",
          isPrimary: true,
        },
      ],
      action: "RESERVE",
    });

    expect(res.groupBookingId).toBeDefined();

    // Verify initial status is RESERVED for both
    const initialBookings = await prisma.booking.findMany({
      where: { groupBookingId: res.groupBookingId! },
    });
    expect(initialBookings.length).toBe(2);
    expect(initialBookings.every((b) => b.status === BookingStatus.RESERVED)).toBe(true);

    // Call checkInReserved on one of the rooms
    const checkInResult = await bookingService.checkInReserved(testStaffUser, res.id);
    expect(checkInResult.status).toBe(BookingStatus.CHECKED_IN);

    // Verify ALL rooms in the group are now CHECKED_IN
    const updatedBookings = await prisma.booking.findMany({
      where: { groupBookingId: res.groupBookingId! },
    });
    expect(updatedBookings.every((b) => b.status === BookingStatus.CHECKED_IN)).toBe(true);
    expect(updatedBookings.every((b) => b.actualCheckInAt !== null)).toBe(true);

    // Verify repeated check-in throws validation error
    await expect(
      bookingService.checkInReserved(testStaffUser, res.id)
    ).rejects.toThrow();
  });
});
