import { prisma } from "@/server/db";
import { AppError } from "@/lib/errors";
import type { Actor } from "@/server/auth/session";
import {
  type CreateInventoryItemInput,
  type UpdateInventoryItemInput,
  type MoveStockInput,
  StockLocation,
} from "@/features/inventory/schemas";

export interface FormattedInventoryItem {
  id: string;
  name: string;
  unit: string;
  reorderLevel: number;
  qtyStore: number;
  qtyRooms: number;
  qtyLaundry: number;
  qtyDamaged: number;
  totalInCirculation: number;
  totalStock: number;
  isLowStock: boolean;
  isActive: boolean;
  movementsCount?: number;
}

export interface InventorySummary {
  totalItems: number;
  activeItems: number;
  lowStockCount: number;
  totalStoreUnits: number;
  totalRoomsUnits: number;
  totalLaundryUnits: number;
  totalDamagedUnits: number;
}

export interface FormattedInventoryMovement {
  id: string;
  itemId: string;
  itemName: string;
  from: StockLocation | null;
  to: StockLocation | null;
  quantity: number;
  note: string | null;
  doneById: string;
  doneByName: string;
  doneAt: Date;
}

function computeItemMetrics(item: {
  id: string;
  name: string;
  unit: string;
  reorderLevel: number;
  qtyStore: number;
  qtyRooms: number;
  qtyLaundry: number;
  qtyDamaged: number;
  isActive: boolean;
}): FormattedInventoryItem {
  const totalInCirculation = item.qtyStore + item.qtyRooms + item.qtyLaundry;
  const totalStock = totalInCirculation + item.qtyDamaged;
  const isLowStock = item.reorderLevel > 0 && item.qtyStore <= item.reorderLevel;

  return {
    ...item,
    totalInCirculation,
    totalStock,
    isLowStock,
  };
}

export class InventoryService {
  /**
   * Lists inventory items with calculated circulation totals and low stock flags.
   */
  async listItems(options?: {
    search?: string;
    lowStockOnly?: boolean;
    includeInactive?: boolean;
  }): Promise<FormattedInventoryItem[]> {
    const whereClause: Record<string, unknown> = {};

    if (!options?.includeInactive) {
      whereClause.isActive = true;
    }

    if (options?.search?.trim()) {
      whereClause.name = {
        contains: options.search.trim(),
        mode: "insensitive",
      };
    }

    const items = await prisma.inventoryItem.findMany({
      where: whereClause,
      include: {
        _count: {
          select: { movements: true },
        },
      },
      orderBy: { name: "asc" },
    });

    const formatted = items.map((item) => ({
      ...computeItemMetrics(item),
      movementsCount: item._count.movements,
    }));

    if (options?.lowStockOnly) {
      return formatted.filter((i) => i.isLowStock);
    }

    return formatted;
  }

  /**
   * Fetches summary statistics for the inventory dashboard.
   */
  async getInventorySummary(): Promise<InventorySummary> {
    const items = await prisma.inventoryItem.findMany();

    let lowStockCount = 0;
    let totalStoreUnits = 0;
    let totalRoomsUnits = 0;
    let totalLaundryUnits = 0;
    let totalDamagedUnits = 0;
    let activeItems = 0;

    for (const item of items) {
      if (item.isActive) {
        activeItems++;
        if (item.reorderLevel > 0 && item.qtyStore <= item.reorderLevel) {
          lowStockCount++;
        }
      }
      totalStoreUnits += item.qtyStore;
      totalRoomsUnits += item.qtyRooms;
      totalLaundryUnits += item.qtyLaundry;
      totalDamagedUnits += item.qtyDamaged;
    }

    return {
      totalItems: items.length,
      activeItems,
      lowStockCount,
      totalStoreUnits,
      totalRoomsUnits,
      totalLaundryUnits,
      totalDamagedUnits,
    };
  }

  /**
   * Returns items currently marked as low stock for alerts and widgets.
   */
  async getLowStockItems(): Promise<FormattedInventoryItem[]> {
    return this.listItems({ lowStockOnly: true, includeInactive: false });
  }

  /**
   * Fetches a single item by ID.
   */
  async getItem(id: string): Promise<FormattedInventoryItem> {
    const item = await prisma.inventoryItem.findUnique({
      where: { id },
    });

    if (!item) {
      throw new AppError("VALIDATION_ERROR", "Inventory item not found.");
    }

    return computeItemMetrics(item);
  }

  /**
   * Creates a new inventory item with optional initial store stock count.
   */
  async createItem(
    input: CreateInventoryItemInput,
    actor: Actor
  ): Promise<FormattedInventoryItem> {
    return prisma.$transaction(async (tx) => {
      // 1. Check for duplicate name case-insensitively
      const existing = await tx.inventoryItem.findFirst({
        where: { name: { equals: input.name, mode: "insensitive" } },
      });

      if (existing) {
        throw new AppError(
          "VALIDATION_ERROR",
          `An inventory item named "${input.name}" already exists.`
        );
      }

      // 2. Create the inventory item
      const item = await tx.inventoryItem.create({
        data: {
          name: input.name,
          unit: input.unit || "pcs",
          reorderLevel: input.reorderLevel ?? 0,
          qtyStore: input.initialQtyStore ?? 0,
          qtyRooms: 0,
          qtyLaundry: 0,
          qtyDamaged: 0,
          isActive: true,
        },
      });

      // 3. If initial stock was provided, record initial movement
      if (input.initialQtyStore && input.initialQtyStore > 0) {
        await tx.inventoryMovement.create({
          data: {
            itemId: item.id,
            from: null,
            to: StockLocation.STORE,
            quantity: input.initialQtyStore,
            note: "Initial stock count",
            doneById: actor.id,
          },
        });
      }

      // 4. Audit Log
      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          action: "INVENTORY_ITEM_CREATED",
          entity: "InventoryItem",
          entityId: item.id,
          metadata: {
            name: item.name,
            unit: item.unit,
            reorderLevel: item.reorderLevel,
            initialQtyStore: item.qtyStore,
          },
        },
      });

      return computeItemMetrics(item);
    });
  }

  /**
   * Updates an inventory item's metadata (name, unit, reorder level, active status).
   */
  async updateItem(
    input: UpdateInventoryItemInput,
    actor: Actor
  ): Promise<FormattedInventoryItem> {
    return prisma.$transaction(async (tx) => {
      const existing = await tx.inventoryItem.findUnique({
        where: { id: input.id },
      });

      if (!existing) {
        throw new AppError("VALIDATION_ERROR", "Inventory item not found.");
      }

      // Check unique name collision
      const duplicate = await tx.inventoryItem.findFirst({
        where: {
          name: { equals: input.name, mode: "insensitive" },
          id: { not: input.id },
        },
      });

      if (duplicate) {
        throw new AppError(
          "VALIDATION_ERROR",
          `An inventory item named "${input.name}" already exists.`
        );
      }

      const updated = await tx.inventoryItem.update({
        where: { id: input.id },
        data: {
          name: input.name,
          unit: input.unit,
          reorderLevel: input.reorderLevel,
          isActive: input.isActive,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          action: "INVENTORY_ITEM_UPDATED",
          entity: "InventoryItem",
          entityId: updated.id,
          metadata: {
            before: {
              name: existing.name,
              unit: existing.unit,
              reorderLevel: existing.reorderLevel,
              isActive: existing.isActive,
            },
            after: {
              name: updated.name,
              unit: updated.unit,
              reorderLevel: updated.reorderLevel,
              isActive: updated.isActive,
            },
          },
        },
      });

      return computeItemMetrics(updated);
    });
  }

  /**
   * Toggles the active status of an inventory item.
   */
  async toggleActive(
    id: string,
    isActive: boolean,
    actor: Actor
  ): Promise<FormattedInventoryItem> {
    return prisma.$transaction(async (tx) => {
      const existing = await tx.inventoryItem.findUnique({ where: { id } });
      if (!existing) {
        throw new AppError("VALIDATION_ERROR", "Inventory item not found.");
      }

      const updated = await tx.inventoryItem.update({
        where: { id },
        data: { isActive },
      });

      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          action: isActive
            ? "INVENTORY_ITEM_ACTIVATED"
            : "INVENTORY_ITEM_DEACTIVATED",
          entity: "InventoryItem",
          entityId: updated.id,
          metadata: { name: updated.name, isActive },
        },
      });

      return computeItemMetrics(updated);
    });
  }

  /**
   * Records a stock movement between locations (or restock from null, or discard to null).
   * Strict validation ensures quantities never become negative.
   */
  async moveStock(
    input: MoveStockInput,
    actor: Actor
  ): Promise<{
    item: FormattedInventoryItem;
    movement: FormattedInventoryMovement;
  }> {
    return prisma.$transaction(async (tx) => {
      const item = await tx.inventoryItem.findUnique({
        where: { id: input.itemId },
      });

      if (!item) {
        throw new AppError("VALIDATION_ERROR", "Inventory item not found.");
      }

      if (!item.isActive) {
        throw new AppError(
          "VALIDATION_ERROR",
          `Cannot move stock for inactive item "${item.name}". Please activate the item first.`
        );
      }

      const qty = input.quantity;
      if (qty <= 0) {
        throw new AppError("VALIDATION_ERROR", "Quantity must be greater than zero.");
      }

      // Check available stock at source location
      if (input.from) {
        let available = 0;
        switch (input.from) {
          case StockLocation.STORE:
            available = item.qtyStore;
            break;
          case StockLocation.ROOMS:
            available = item.qtyRooms;
            break;
          case StockLocation.LAUNDRY:
            available = item.qtyLaundry;
            break;
          case StockLocation.DAMAGED:
            available = item.qtyDamaged;
            break;
        }

        if (available < qty) {
          throw new AppError(
            "INSUFFICIENT_STOCK",
            `Insufficient stock in ${input.from}. Only ${available} ${item.unit} available, but requested ${qty} ${item.unit}.`
          );
        }
      }

      // Calculate quantity deltas
      let nextStore = item.qtyStore;
      let nextRooms = item.qtyRooms;
      let nextLaundry = item.qtyLaundry;
      let nextDamaged = item.qtyDamaged;

      // Deduct from source
      if (input.from === StockLocation.STORE) nextStore -= qty;
      else if (input.from === StockLocation.ROOMS) nextRooms -= qty;
      else if (input.from === StockLocation.LAUNDRY) nextLaundry -= qty;
      else if (input.from === StockLocation.DAMAGED) nextDamaged -= qty;

      // Add to destination
      if (input.to === StockLocation.STORE) nextStore += qty;
      else if (input.to === StockLocation.ROOMS) nextRooms += qty;
      else if (input.to === StockLocation.LAUNDRY) nextLaundry += qty;
      else if (input.to === StockLocation.DAMAGED) nextDamaged += qty;

      // Double-check no negative stock can ever happen
      if (
        nextStore < 0 ||
        nextRooms < 0 ||
        nextLaundry < 0 ||
        nextDamaged < 0
      ) {
        throw new AppError(
          "VALIDATION_ERROR",
          "Movement would result in negative inventory."
        );
      }

      const updatedItem = await tx.inventoryItem.update({
        where: { id: item.id },
        data: {
          qtyStore: nextStore,
          qtyRooms: nextRooms,
          qtyLaundry: nextLaundry,
          qtyDamaged: nextDamaged,
        },
      });

      const movement = await tx.inventoryMovement.create({
        data: {
          itemId: item.id,
          from: input.from || null,
          to: input.to || null,
          quantity: qty,
          note: input.note?.trim() || null,
          doneById: actor.id,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          action: "INVENTORY_STOCK_MOVED",
          entity: "InventoryMovement",
          entityId: movement.id,
          metadata: {
            itemId: item.id,
            itemName: item.name,
            from: input.from,
            to: input.to,
            quantity: qty,
            note: input.note,
            newQuantities: {
              qtyStore: nextStore,
              qtyRooms: nextRooms,
              qtyLaundry: nextLaundry,
              qtyDamaged: nextDamaged,
            },
          },
        },
      });

      const formattedMovement: FormattedInventoryMovement = {
        id: movement.id,
        itemId: item.id,
        itemName: item.name,
        from: movement.from,
        to: movement.to,
        quantity: movement.quantity,
        note: movement.note,
        doneById: actor.id,
        doneByName: actor.name || "Staff",
        doneAt: movement.doneAt,
      };

      return {
        item: computeItemMetrics(updatedItem),
        movement: formattedMovement,
      };
    });
  }

  /**
   * Retrieves the complete immutable movement history for an item.
   */
  async getItemMovements(
    itemId: string
  ): Promise<FormattedInventoryMovement[]> {
    const movements = await prisma.inventoryMovement.findMany({
      where: { itemId },
      include: {
        item: { select: { name: true } },
      },
      orderBy: { doneAt: "desc" },
    });

    if (movements.length === 0) {
      return [];
    }

    const userIds = Array.from(new Set(movements.map((m) => m.doneById)));
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true, email: true },
    });
    const userMap = new Map(users.map((u) => [u.id, u.name]));

    return movements.map((m) => ({
      id: m.id,
      itemId: m.itemId,
      itemName: m.item.name,
      from: m.from,
      to: m.to,
      quantity: m.quantity,
      note: m.note,
      doneById: m.doneById,
      doneByName: userMap.get(m.doneById) || "Staff",
      doneAt: m.doneAt,
    }));
  }
}

export const inventoryService = new InventoryService();
