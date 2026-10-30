import "dotenv/config";
import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  vi,
} from "vitest";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import * as sessionModule from "@/server/auth/session";
import { ROLES } from "@/lib/constants";
import {
  createInventoryItemAction,
  updateInventoryItemAction,
  moveStockAction,
  getItemMovementsAction,
  toggleInventoryItemActiveAction,
} from "@/server/actions/inventory.actions";
import { inventoryService } from "@/server/services/inventory.service";

const connectionString =
  process.env.DATABASE_URL_TEST || process.env.DATABASE_URL;

describe("Phase 2.4: Inventory Management (Integration)", () => {
  let pool: Pool;
  let prisma: PrismaClient;
  const createdItemIds: string[] = [];

  const receptionistActor = {
    id: "receptionist-inv-user-id",
    name: "Staff Receptionist",
    email: "receptionist@hotelpaul.in",
    role: ROLES.RECEPTIONIST,
    isActive: true,
  };

  beforeAll(async () => {
    if (!connectionString) {
      throw new Error("No database connection string for tests");
    }
    pool = new Pool({ connectionString });
    const adapter = new PrismaPg(pool);
    prisma = new PrismaClient({ adapter });

    // Ensure actor user exists for foreign keys / audit logs
    const user = await prisma.user.upsert({
      where: { email: receptionistActor.email },
      update: { name: receptionistActor.name, role: receptionistActor.role },
      create: {
        id: receptionistActor.id,
        name: receptionistActor.name,
        email: receptionistActor.email,
        role: receptionistActor.role,
        isActive: true,
      },
    });
    receptionistActor.id = user.id;
  });

  afterAll(async () => {
    if (createdItemIds.length > 0) {
      await prisma.inventoryMovement.deleteMany({
        where: { itemId: { in: createdItemIds } },
      });
      await prisma.auditLog.deleteMany({
        where: {
          entityId: { in: createdItemIds },
        },
      });
      await prisma.inventoryItem.deleteMany({
        where: { id: { in: createdItemIds } },
      });
    }
    await prisma.$disconnect();
    await pool.end();
  });

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(sessionModule, "requireSession").mockResolvedValue({
      actor: receptionistActor,
    });
  });

  it("creates an inventory item with initial store stock and records movement & audit logs", async () => {
    const itemName = `Double Bedsheets Test ${Date.now()}`;
    const res = await createInventoryItemAction({
      name: itemName,
      unit: "sets",
      reorderLevel: 15,
      initialQtyStore: 30,
    });

    expect(res.ok).toBe(true);
    expect(res.data).toBeDefined();

    const item = res.data as {
      id: string;
      name: string;
      unit: string;
      reorderLevel: number;
      qtyStore: number;
      qtyRooms: number;
      qtyLaundry: number;
      qtyDamaged: number;
      isLowStock: boolean;
    };

    createdItemIds.push(item.id);

    expect(item.name).toBe(itemName);
    expect(item.unit).toBe("sets");
    expect(item.reorderLevel).toBe(15);
    expect(item.qtyStore).toBe(30);
    expect(item.qtyRooms).toBe(0);
    expect(item.isLowStock).toBe(false);

    // Verify initial movement was recorded
    const movements = await prisma.inventoryMovement.findMany({
      where: { itemId: item.id },
    });
    expect(movements.length).toBe(1);
    expect(movements[0].from).toBeNull();
    expect(movements[0].to).toBe("STORE");
    expect(movements[0].quantity).toBe(30);

    // Verify AuditLog
    const audit = await prisma.auditLog.findFirst({
      where: {
        entity: "InventoryItem",
        entityId: item.id,
        action: "INVENTORY_ITEM_CREATED",
      },
    });
    expect(audit).not.toBeNull();
    expect(audit?.actorId).toBe(receptionistActor.id);
  });

  it("rejects duplicate item names case-insensitively", async () => {
    const itemName = `Bath Towel White ${Date.now()}`;
    const firstRes = await createInventoryItemAction({
      name: itemName,
      unit: "pcs",
      reorderLevel: 10,
      initialQtyStore: 20,
    });
    expect(firstRes.ok).toBe(true);
    const item = firstRes.data as { id: string };
    createdItemIds.push(item.id);

    // Duplicate creation attempt with different casing
    const dupRes = await createInventoryItemAction({
      name: itemName.toLowerCase(),
      unit: "pcs",
      reorderLevel: 10,
      initialQtyStore: 5,
    });
    expect(dupRes.ok).toBe(false);
    expect(dupRes.code).toBe("VALIDATION_ERROR");
  });

  it("transfers stock between locations and updates quantities atomically", async () => {
    // 1. Create test item with 25 pcs in store
    const itemName = `Pillow Cases Test ${Date.now()}`;
    const createRes = await createInventoryItemAction({
      name: itemName,
      unit: "pcs",
      reorderLevel: 10,
      initialQtyStore: 25,
    });
    expect(createRes.ok).toBe(true);
    const item = createRes.data as { id: string };
    createdItemIds.push(item.id);

    // 2. Transfer 10 pcs from STORE -> ROOMS
    const moveRes1 = await moveStockAction({
      itemId: item.id,
      from: "STORE",
      to: "ROOMS",
      quantity: 10,
      note: "Room turnover for floor 2",
    });
    expect(moveRes1.ok).toBe(true);

    let updated = await inventoryService.getItem(item.id);
    expect(updated.qtyStore).toBe(15);
    expect(updated.qtyRooms).toBe(10);
    expect(updated.qtyLaundry).toBe(0);

    // 3. Move 4 pcs from ROOMS -> LAUNDRY
    const moveRes2 = await moveStockAction({
      itemId: item.id,
      from: "ROOMS",
      to: "LAUNDRY",
      quantity: 4,
      note: "Daily linen wash pickup",
    });
    expect(moveRes2.ok).toBe(true);

    updated = await inventoryService.getItem(item.id);
    expect(updated.qtyStore).toBe(15);
    expect(updated.qtyRooms).toBe(6);
    expect(updated.qtyLaundry).toBe(4);

    // 4. Move 1 damaged pc from ROOMS -> DAMAGED
    const moveRes3 = await moveStockAction({
      itemId: item.id,
      from: "ROOMS",
      to: "DAMAGED",
      quantity: 1,
      note: "Torn pillowcase found in room 104",
    });
    expect(moveRes3.ok).toBe(true);

    updated = await inventoryService.getItem(item.id);
    expect(updated.qtyRooms).toBe(5);
    expect(updated.qtyDamaged).toBe(1);
    expect(updated.totalStock).toBe(25); // 15 store + 5 rooms + 4 laundry + 1 damaged
  });

  it("strictly disallows movements resulting in negative inventory", async () => {
    const itemName = `TV Remotes Test ${Date.now()}`;
    const createRes = await createInventoryItemAction({
      name: itemName,
      unit: "pcs",
      reorderLevel: 2,
      initialQtyStore: 5,
    });
    expect(createRes.ok).toBe(true);
    const item = createRes.data as { id: string };
    createdItemIds.push(item.id);

    // Attempt to move 10 pcs from STORE when only 5 are in STORE
    const failRes = await moveStockAction({
      itemId: item.id,
      from: "STORE",
      to: "ROOMS",
      quantity: 10,
    });

    expect(failRes.ok).toBe(false);
    expect(failRes.code).toBe("INSUFFICIENT_STOCK");

    // Verify stock is untouched
    const current = await inventoryService.getItem(item.id);
    expect(current.qtyStore).toBe(5);
    expect(current.qtyRooms).toBe(0);
  });

  it("supports supplier restocking and damaged stock disposal write-offs", async () => {
    const itemName = `Soap Bars Test ${Date.now()}`;
    const createRes = await createInventoryItemAction({
      name: itemName,
      unit: "bars",
      reorderLevel: 20,
      initialQtyStore: 10,
    });
    expect(createRes.ok).toBe(true);
    const item = createRes.data as { id: string };
    createdItemIds.push(item.id);

    // 1. Restock 50 bars into STORE from supplier (from: null)
    const restockRes = await moveStockAction({
      itemId: item.id,
      from: null,
      to: "STORE",
      quantity: 50,
      note: "Received supplier invoice #9812",
    });
    expect(restockRes.ok).toBe(true);

    let current = await inventoryService.getItem(item.id);
    expect(current.qtyStore).toBe(60);

    // 2. Mark 3 bars damaged
    await moveStockAction({
      itemId: item.id,
      from: "STORE",
      to: "DAMAGED",
      quantity: 3,
      note: "Crushed carton",
    });

    current = await inventoryService.getItem(item.id);
    expect(current.qtyStore).toBe(57);
    expect(current.qtyDamaged).toBe(3);

    // 3. Discard / write-off damaged bars (to: null)
    const discardRes = await moveStockAction({
      itemId: item.id,
      from: "DAMAGED",
      to: null,
      quantity: 3,
      note: "Disposed in waste bin",
    });
    expect(discardRes.ok).toBe(true);

    current = await inventoryService.getItem(item.id);
    expect(current.qtyDamaged).toBe(0);
    expect(current.totalStock).toBe(57);
  });

  it("detects low stock accurately and returns alert flags", async () => {
    const itemName = `Mineral Water Bottles ${Date.now()}`;
    const createRes = await createInventoryItemAction({
      name: itemName,
      unit: "bottles",
      reorderLevel: 25,
      initialQtyStore: 30, // Above reorder
    });
    expect(createRes.ok).toBe(true);
    const item = createRes.data as { id: string };
    createdItemIds.push(item.id);

    let itemDetails = await inventoryService.getItem(item.id);
    expect(itemDetails.isLowStock).toBe(false);

    // Issue 10 bottles to rooms -> Store drops to 20 (<= reorderLevel of 25)
    await moveStockAction({
      itemId: item.id,
      from: "STORE",
      to: "ROOMS",
      quantity: 10,
    });

    itemDetails = await inventoryService.getItem(item.id);
    expect(itemDetails.qtyStore).toBe(20);
    expect(itemDetails.isLowStock).toBe(true);

    // Check low stock query
    const lowStockItems = await inventoryService.getLowStockItems();
    const found = lowStockItems.find((i) => i.id === item.id);
    expect(found).toBeDefined();
    expect(found?.isLowStock).toBe(true);
  });

  it("retrieves complete immutable movement history for an item with actor details", async () => {
    const itemName = `Mosquito Machine Test ${Date.now()}`;
    const createRes = await createInventoryItemAction({
      name: itemName,
      unit: "pcs",
      reorderLevel: 5,
      initialQtyStore: 15,
    });
    expect(createRes.ok).toBe(true);
    const item = createRes.data as { id: string };
    createdItemIds.push(item.id);

    // Make two movements
    await moveStockAction({
      itemId: item.id,
      from: "STORE",
      to: "ROOMS",
      quantity: 5,
      note: "Placed in deluxe rooms",
    });

    await moveStockAction({
      itemId: item.id,
      from: "ROOMS",
      to: "STORE",
      quantity: 2,
      note: "Returned to store after checkout",
    });

    const historyRes = await getItemMovementsAction({ itemId: item.id });
    expect(historyRes.ok).toBe(true);

    const movements = historyRes.data as Array<{
      from: string | null;
      to: string | null;
      quantity: number;
      note: string | null;
      doneByName: string;
      doneAt: Date;
    }>;

    // 3 movements total: initial stock + 2 moves
    expect(movements.length).toBe(3);
    // Newest first
    expect(movements[0].from).toBe("ROOMS");
    expect(movements[0].to).toBe("STORE");
    expect(movements[0].quantity).toBe(2);
    expect(movements[0].doneByName).toBe(receptionistActor.name);

    expect(movements[1].from).toBe("STORE");
    expect(movements[1].to).toBe("ROOMS");
    expect(movements[1].quantity).toBe(5);

    expect(movements[2].from).toBeNull();
    expect(movements[2].to).toBe("STORE");
    expect(movements[2].quantity).toBe(15);
  });

  it("updates item metadata and toggles active status", async () => {
    const itemName = `Tea Bags Test ${Date.now()}`;
    const createRes = await createInventoryItemAction({
      name: itemName,
      unit: "sachets",
      reorderLevel: 50,
      initialQtyStore: 100,
    });
    expect(createRes.ok).toBe(true);
    const item = createRes.data as { id: string };
    createdItemIds.push(item.id);

    // Update item
    const updateRes = await updateInventoryItemAction({
      id: item.id,
      name: `${itemName} - Premium Green`,
      unit: "packets",
      reorderLevel: 30,
      isActive: true,
    });
    expect(updateRes.ok).toBe(true);

    let updated = await inventoryService.getItem(item.id);
    expect(updated.name).toBe(`${itemName} - Premium Green`);
    expect(updated.unit).toBe("packets");
    expect(updated.reorderLevel).toBe(30);

    // Toggle active to false
    const toggleRes = await toggleInventoryItemActiveAction({
      id: item.id,
      isActive: false,
    });
    expect(toggleRes.ok).toBe(true);

    updated = await inventoryService.getItem(item.id);
    expect(updated.isActive).toBe(false);
  });
});
