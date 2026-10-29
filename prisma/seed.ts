import "dotenv/config";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, Role } from "@prisma/client";
import { hashPassword } from "better-auth/crypto";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🌱 Starting database seeding...");

  // 1. Hotel Settings
  const hotel = await prisma.hotelSettings.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      name: "Hotel Paul",
      address: "123 Station Road, Bolpur, West Bengal 731204",
      phone: "+91 98765 43210",
      gstin: "19AAAAA0000A1Z5",
      invoicePrefix: "HP-",
      invoiceNotes:
        "Thank you for staying at Hotel Paul. We look forward to serving you again.",
      graceMinutes: 0,
      roundBillToRupee: false,
      gstOnOtherCharges: false,
    },
  });
  console.log("✓ HotelSettings seeded:", hotel.name);

  // 2. Invoice Sequence
  const seq = await prisma.invoiceSequence.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      nextNo: 1001,
    },
  });
  console.log("✓ InvoiceSequence seeded at:", seq.nextNo);

  // 3. GST Slabs (data, not code: 5% up to 7,500, 18% above)
  const existingSlabs = await prisma.gstSlab.count();
  if (existingSlabs === 0) {
    await prisma.gstSlab.createMany({
      data: [
        {
          minRate: 0.0,
          maxRate: 7500.0,
          percent: 5.0,
          isActive: true,
        },
        {
          minRate: 7500.0,
          maxRate: null,
          percent: 18.0,
          isActive: true,
        },
      ],
    });
    console.log("✓ Default GST slabs seeded (5% <= ₹7500, 18% > ₹7500)");
  }

  // 4. Room Types & Rooms
  const roomTypesData = [
    {
      name: "Standard Non-AC",
      rooms: [
        { number: "101", pricePerNight: 1200 },
        { number: "102", pricePerNight: 1200 },
      ],
    },
    {
      name: "Deluxe AC",
      rooms: [
        { number: "201", pricePerNight: 2200 },
        { number: "202", pricePerNight: 2200 },
      ],
    },
    {
      name: "Super Deluxe AC",
      rooms: [{ number: "301", pricePerNight: 3500 }],
    },
  ];

  for (const typeData of roomTypesData) {
    const roomType = await prisma.roomType.upsert({
      where: { name: typeData.name },
      update: {},
      create: { name: typeData.name },
    });

    for (const r of typeData.rooms) {
      await prisma.room.upsert({
        where: { number: r.number },
        update: {
          pricePerNight: r.pricePerNight,
          typeId: roomType.id,
        },
        create: {
          number: r.number,
          pricePerNight: r.pricePerNight,
          typeId: roomType.id,
          isActive: true,
        },
      });
    }
  }
  console.log("✓ Room types and sample rooms seeded");

  // 5. Initial OWNER User Account
  const ownerEmail = (process.env.OWNER_EMAIL || "owner@hotelpaul.in")
    .toLowerCase()
    .trim();
  const ownerPassword = process.env.OWNER_PASSWORD || "HotelPaul@Owner2026";
  const ownerName = "Property Owner";
  const hashedPassword = await hashPassword(ownerPassword);

  let owner = await prisma.user.findUnique({
    where: { email: ownerEmail },
  });

  if (!owner) {
    owner = await prisma.user.create({
      data: {
        name: ownerName,
        email: ownerEmail,
        role: Role.OWNER,
        isActive: true,
        emailVerified: true,
      },
    });
    console.log(`✓ Owner user created: ${owner.email}`);
  } else {
    owner = await prisma.user.update({
      where: { id: owner.id },
      data: {
        role: Role.OWNER,
        isActive: true,
      },
    });
    console.log(`✓ Owner user verified: ${owner.email}`);
  }

  // Ensure owner credential account has accountId = owner.id
  await prisma.account.deleteMany({
    where: {
      userId: owner.id,
      providerId: "credential",
    },
  });

  await prisma.account.create({
    data: {
      userId: owner.id,
      accountId: owner.id,
      providerId: "credential",
      password: hashedPassword,
    },
  });
  console.log(`✓ Owner credential account linked (accountId: ${owner.id})`);

  // 6. Receptionist Staff Account
  const receptionistEmail = "receptionist@hotelpaul.in".toLowerCase().trim();
  const receptionistPassword = "HotelPaul@Staff2026";
  const hashedStaffPassword = await hashPassword(receptionistPassword);

  let receptionist = await prisma.user.findUnique({
    where: { email: receptionistEmail },
  });

  if (!receptionist) {
    receptionist = await prisma.user.create({
      data: {
        name: "Front Desk Staff",
        email: receptionistEmail,
        role: Role.RECEPTIONIST,
        isActive: true,
        emailVerified: true,
      },
    });
    console.log(`✓ Receptionist user created: ${receptionist.email}`);
  } else {
    receptionist = await prisma.user.update({
      where: { id: receptionist.id },
      data: {
        role: Role.RECEPTIONIST,
        isActive: true,
      },
    });
    console.log(`✓ Receptionist user verified: ${receptionist.email}`);
  }

  // Ensure receptionist credential account has accountId = receptionist.id
  await prisma.account.deleteMany({
    where: {
      userId: receptionist.id,
      providerId: "credential",
    },
  });

  await prisma.account.create({
    data: {
      userId: receptionist.id,
      accountId: receptionist.id,
      providerId: "credential",
      password: hashedStaffPassword,
    },
  });
  console.log(
    `✓ Receptionist credential account linked (accountId: ${receptionist.id})`
  );

  console.log("🌱 Database seeding completed successfully!");
}

main()
  .catch((e) => {
    console.error("❌ Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
