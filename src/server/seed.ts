import { PrismaClient, Role, Prisma } from "@prisma/client";
import { hashPassword } from "better-auth/crypto";

export async function seedBaseline(prisma: PrismaClient): Promise<void> {
  // 1. HotelSettings (id: 1, upsert with update: {})
  try {
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
  } catch (err: unknown) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      console.log("✓ HotelSettings already seeded (P2002 concurrent violation)");
    } else {
      throw err;
    }
  }

  // 2. InvoiceSequence (id: 1, nextNo: 1001, upsert with update: {})
  try {
    const seq = await prisma.invoiceSequence.upsert({
      where: { id: 1 },
      update: {},
      create: {
        id: 1,
        nextNo: 1001,
      },
    });
    console.log("✓ InvoiceSequence seeded at:", seq.nextNo);
  } catch (err: unknown) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      console.log("✓ InvoiceSequence already seeded (P2002 concurrent violation)");
    } else {
      throw err;
    }
  }

  // 3. GST Slabs (5% for 0-7500, 18% above 7500, only if count is 0)
  const existingSlabs = await prisma.gstSlab.count();
  if (existingSlabs === 0) {
    try {
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
    } catch (err: unknown) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002"
      ) {
        console.log("✓ GST slabs already seeded (P2002 concurrent violation)");
      } else {
        throw err;
      }
    }
  } else {
    console.log("✓ GST slabs already present");
  }

  // 4. OWNER User + Credential Account
  const ownerEmail = (process.env.OWNER_EMAIL || "owner@hotelpaul.in")
    .toLowerCase()
    .trim();

  let ownerPassword = process.env.OWNER_PASSWORD;
  if (!ownerPassword) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("OWNER_PASSWORD must be set in production");
    }
    ownerPassword = "HotelPaul@Owner2026";
  }

  const existingOwner = await prisma.user.findUnique({
    where: { email: ownerEmail },
  });

  if (!existingOwner) {
    const hashedPassword = await hashPassword(ownerPassword);
    try {
      await prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            name: "Property Owner",
            email: ownerEmail,
            role: Role.OWNER,
            isActive: true,
            emailVerified: true,
          },
        });

        await tx.account.create({
          data: {
            userId: user.id,
            accountId: user.id,
            providerId: "credential",
            password: hashedPassword,
          },
        });
      });
      console.log(`✓ Owner user created: ${ownerEmail}`);
    } catch (err: unknown) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002"
      ) {
        console.log(
          `✓ Owner already created concurrently (P2002): ${ownerEmail}`
        );
      } else {
        throw err;
      }
    }
  } else {
    console.log(`✓ Owner user already exists: ${ownerEmail}`);
  }
}
