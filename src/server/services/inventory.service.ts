import { prisma } from "@/server/db";
import { AppError } from "@/lib/errors";
import type { Actor } from "@/server/auth/session";
import {
  type CreateInventoryItemInput,
  type UpdateInventoryItemInput,
  type MoveStockInput,
  type UpdateStockInput,
  StockActionType,
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
  qtyDiscontinued: number;
  // Simplified 4-category projections
  available: number;
  inUse: number;
  damaged: number;
  discontinued: number;
  totalTracked: number;
  totalInCirculation: number;
  totalStock: number;
  isLowStock: boolean;
  isActive: boolean;
  movementsCount?: number;
}

export interface InventorySummary {
  totalItems: number;
  activeItems: number;
  availableStock: number;
  lowStockCount: number;
  totalStoreUnits: number;
  totalRoomsUnits: number;
  totalLaundryUnits: number;
  totalDamagedUnits: number;
  totalDiscontinuedUnits: number;
}

export interface FormattedInventoryMovement {
  id: string;
  itemId: string;
  itemName: string;
  actionType: string | null;
  from: StockLocation | null;
  to: StockLocation | null;
  quantity: number;
  previousQty: number | null;
  updatedQty: number | null;
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
  qtyDiscontinued?: number;
  isActive: boolean;
}): FormattedInventoryItem {
  const qtyDiscontinued = item.qtyDiscontinued ?? 0;
  const available = item.qtyStore;
  const inUse = item.qtyRooms + item.qtyLaundry;
  const damaged = item.qtyDamaged;
  const discontinued = qtyDiscontinued;
  const totalTracked = available + inUse + damaged + discontinued;
  const totalInCirculation = available + inUse;
  const totalStock = totalTracked;
  // Low-stock calculation strictly uses available stock, not total tracked quantity
  const isLowStock = item.reorderLevel > 0 && available <= item.reorderLevel;

  return {
    ...item,
    qtyDiscontinued,
    available,
    inUse,
    damaged,
    discontinued,
    totalTracked,
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
   * Fetches summary statistics for the inventory dashboard:
   * Total Items, Available Stock, and Low Stock Items count.
   */
  async getInventorySummary(): Promise<InventorySummary> {
    const items = await prisma.inventoryItem.findMany();

    let lowStockCount = 0;
    let availableStock = 0;
    let totalRoomsUnits = 0;
    let totalLaundryUnits = 0;
    let totalDamagedUnits = 0;
    let totalDiscontinuedUnits = 0;
    let activeItems = 0;

    for (const item of items) {
      if (item.isActive) {
        activeItems++;
        if (item.reorderLevel > 0 && item.qtyStore <= item.reorderLevel) {
          lowStockCount++;
        }
      }
      availableStock += item.qtyStore;
      totalRoomsUnits += item.qtyRooms;
      totalLaundryUnits += item.qtyLaundry;
      totalDamagedUnits += item.qtyDamaged;
      totalDiscontinuedUnits += item.qtyDiscontinued;
    }

    return {
      totalItems: items.length,
      activeItems,
      availableStock,
      lowStockCount,
      totalStoreUnits: availableStock,
      totalRoomsUnits,
      totalLaundryUnits,
      totalDamagedUnits,
      totalDiscontinuedUnits,
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
   * Creates a new inventory item with initial available stock count.
   */
  async createItem(
    input: CreateInventoryItemInput,
    actor: Actor
  ): Promise<FormattedInventoryItem> {
    const initialAvailable =
      input.initialAvailableStock ?? input.initialQtyStore ?? 0;

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
          qtyStore: initialAvailable,
          qtyRooms: 0,
          qtyLaundry: 0,
          qtyDamaged: 0,
          qtyDiscontinued: 0,
          isActive: true,
        },
      });

      // 3. If initial stock was provided, record initial movement
      if (initialAvailable > 0) {
        await tx.inventoryMovement.create({
          data: {
            itemId: item.id,
            actionType: StockActionType.ADD_STOCK,
            from: null,
            to: StockLocation.STORE,
            quantity: initialAvailable,
            previousQty: 0,
            updatedQty: initialAvailable,
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
            initialAvailableStock: item.qtyStore,
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
   * Simplified stock update with automatic category calculation:
   * - ADD_STOCK: adds directly to Available stock
   * - USE_STOCK: issues stock from Available to In Use
   * - MARK_DAMAGED: marks stock as Damaged (deducts from Available first, then In Use)
   * - MARK_DISCONTINUED: marks stock as Discontinued (deducts from Available, In Use, or Damaged)
   * - RETURN_AVAILABLE: returns In Use or Damaged stock back to Available
   *
   * Validates non-negative limits, records history with previous/updated quantity, and runs in transaction.
   */
  async updateStock(
    input: UpdateStockInput,
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
          `Cannot adjust stock for inactive item "${item.name}". Please activate the item first.`
        );
      }

      const qty = input.quantity;
      if (qty <= 0) {
        throw new AppError("VALIDATION_ERROR", "Quantity must be greater than zero.");
      }

      let nextStore = item.qtyStore;
      let nextRooms = item.qtyRooms;
      let nextLaundry = item.qtyLaundry;
      let nextDamaged = item.qtyDamaged;
      let nextDiscontinued = item.qtyDiscontinued;

      let fromLoc: StockLocation | null = null;
      let toLoc: StockLocation | null = null;
      let previousQty = 0;
      let updatedQty = 0;

      switch (input.actionType) {
        case "ADD_STOCK": {
          previousQty = nextStore;
          nextStore += qty;
          updatedQty = nextStore;
          fromLoc = null;
          toLoc = StockLocation.STORE;
          break;
        }

        case "USE_STOCK": {
          if (nextStore < qty) {
            throw new AppError(
              "INSUFFICIENT_STOCK",
              `Cannot issue ${qty} ${item.unit}. Only ${nextStore} ${item.unit} available in stock.`
            );
          }
          previousQty = nextStore;
          nextStore -= qty;
          nextRooms += qty;
          updatedQty = nextStore;
          fromLoc = StockLocation.STORE;
          toLoc = StockLocation.ROOMS;
          break;
        }

        case "MARK_DAMAGED": {
          const totalActive = nextStore + nextRooms + nextLaundry;
          if (totalActive < qty) {
            throw new AppError(
              "INSUFFICIENT_STOCK",
              `Cannot mark ${qty} ${item.unit} as damaged. Only ${totalActive} ${item.unit} available or in use.`
            );
          }

          previousQty = nextDamaged;

          // Deduct from available first, then rooms, then laundry
          let remaining = qty;
          if (nextStore > 0) {
            const take = Math.min(nextStore, remaining);
            nextStore -= take;
            remaining -= take;
            fromLoc = StockLocation.STORE;
          }
          if (remaining > 0 && nextRooms > 0) {
            const take = Math.min(nextRooms, remaining);
            nextRooms -= take;
            remaining -= take;
            fromLoc = StockLocation.ROOMS;
          }
          if (remaining > 0 && nextLaundry > 0) {
            const take = Math.min(nextLaundry, remaining);
            nextLaundry -= take;
            remaining -= take;
            fromLoc = StockLocation.LAUNDRY;
          }

          nextDamaged += qty;
          updatedQty = nextDamaged;
          toLoc = StockLocation.DAMAGED;
          break;
        }

        case "MARK_DISCONTINUED": {
          const totalEligible =
            nextStore + nextRooms + nextLaundry + nextDamaged;
          if (totalEligible < qty) {
            throw new AppError(
              "INSUFFICIENT_STOCK",
              `Cannot discontinue ${qty} ${item.unit}. Only ${totalEligible} ${item.unit} in total stock.`
            );
          }

          previousQty = nextDiscontinued;

          // Deduct from available first, then rooms, then laundry, then damaged
          let remaining = qty;
          if (nextStore > 0) {
            const take = Math.min(nextStore, remaining);
            nextStore -= take;
            remaining -= take;
            fromLoc = StockLocation.STORE;
          }
          if (remaining > 0 && nextRooms > 0) {
            const take = Math.min(nextRooms, remaining);
            nextRooms -= take;
            remaining -= take;
            fromLoc = StockLocation.ROOMS;
          }
          if (remaining > 0 && nextLaundry > 0) {
            const take = Math.min(nextLaundry, remaining);
            nextLaundry -= take;
            remaining -= take;
            fromLoc = StockLocation.LAUNDRY;
          }
          if (remaining > 0 && nextDamaged > 0) {
            const take = Math.min(nextDamaged, remaining);
            nextDamaged -= take;
            remaining -= take;
            fromLoc = StockLocation.DAMAGED;
          }

          nextDiscontinued += qty;
          updatedQty = nextDiscontinued;
          toLoc = StockLocation.DISCONTINUED;
          break;
        }

        case "RETURN_AVAILABLE": {
          const totalReturnable = nextRooms + nextLaundry + nextDamaged;
          if (totalReturnable < qty) {
            throw new AppError(
              "INSUFFICIENT_STOCK",
              `Cannot return ${qty} ${item.unit} to available stock. Only ${totalReturnable} ${item.unit} currently in use or damaged.`
            );
          }

          previousQty = nextStore;

          // Deduct from rooms first, then laundry, then damaged
          let remaining = qty;
          if (nextRooms > 0) {
            const take = Math.min(nextRooms, remaining);
            nextRooms -= take;
            remaining -= take;
            fromLoc = StockLocation.ROOMS;
          }
          if (remaining > 0 && nextLaundry > 0) {
            const take = Math.min(nextLaundry, remaining);
            nextLaundry -= take;
            remaining -= take;
            fromLoc = StockLocation.LAUNDRY;
          }
          if (remaining > 0 && nextDamaged > 0) {
            const take = Math.min(nextDamaged, remaining);
            nextDamaged -= take;
            remaining -= take;
            fromLoc = StockLocation.DAMAGED;
          }

          nextStore += qty;
          updatedQty = nextStore;
          toLoc = StockLocation.STORE;
          break;
        }

        default:
          throw new AppError("VALIDATION_ERROR", "Invalid stock action type.");
      }

      // Check strictly against negative stock
      if (
        nextStore < 0 ||
        nextRooms < 0 ||
        nextLaundry < 0 ||
        nextDamaged < 0 ||
        nextDiscontinued < 0
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
          qtyDiscontinued: nextDiscontinued,
        },
      });

      const movement = await tx.inventoryMovement.create({
        data: {
          itemId: item.id,
          actionType: input.actionType,
          from: fromLoc,
          to: toLoc,
          quantity: qty,
          previousQty,
          updatedQty,
          note: input.note?.trim() || null,
          doneById: actor.id,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          action: `INVENTORY_STOCK_${input.actionType}`,
          entity: "InventoryMovement",
          entityId: movement.id,
          metadata: {
            itemId: item.id,
            itemName: item.name,
            actionType: input.actionType,
            quantity: qty,
            previousQty,
            updatedQty,
            note: input.note,
            newQuantities: {
              available: nextStore,
              inUse: nextRooms + nextLaundry,
              damaged: nextDamaged,
              discontinued: nextDiscontinued,
            },
          },
        },
      });

      const formattedMovement: FormattedInventoryMovement = {
        id: movement.id,
        itemId: item.id,
        itemName: item.name,
        actionType: movement.actionType,
        from: movement.from,
        to: movement.to,
        quantity: movement.quantity,
        previousQty: movement.previousQty,
        updatedQty: movement.updatedQty,
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
   * Records a stock movement between locations (or restock from null, or discard to null).
   * Preserved for backward compatibility and fine-grained transfers.
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
          case StockLocation.DISCONTINUED:
            available = item.qtyDiscontinued;
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
      let nextDiscontinued = item.qtyDiscontinued;

      // Deduct from source
      if (input.from === StockLocation.STORE) nextStore -= qty;
      else if (input.from === StockLocation.ROOMS) nextRooms -= qty;
      else if (input.from === StockLocation.LAUNDRY) nextLaundry -= qty;
      else if (input.from === StockLocation.DAMAGED) nextDamaged -= qty;
      else if (input.from === StockLocation.DISCONTINUED) nextDiscontinued -= qty;

      // Add to destination
      if (input.to === StockLocation.STORE) nextStore += qty;
      else if (input.to === StockLocation.ROOMS) nextRooms += qty;
      else if (input.to === StockLocation.LAUNDRY) nextLaundry += qty;
      else if (input.to === StockLocation.DAMAGED) nextDamaged += qty;
      else if (input.to === StockLocation.DISCONTINUED) nextDiscontinued += qty;

      // Double-check no negative stock can ever happen
      if (
        nextStore < 0 ||
        nextRooms < 0 ||
        nextLaundry < 0 ||
        nextDamaged < 0 ||
        nextDiscontinued < 0
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
          qtyDiscontinued: nextDiscontinued,
        },
      });

      let actionType: string | null = null;
      if (!input.from && input.to === StockLocation.STORE) actionType = "ADD_STOCK";
      else if (input.from === StockLocation.STORE && input.to === StockLocation.ROOMS) actionType = "USE_STOCK";
      else if (input.to === StockLocation.DAMAGED) actionType = "MARK_DAMAGED";
      else if (input.to === StockLocation.DISCONTINUED) actionType = "MARK_DISCONTINUED";
      else if (input.to === StockLocation.STORE) actionType = "RETURN_AVAILABLE";

      const previousQty = input.to === StockLocation.STORE ? item.qtyStore : (input.from === StockLocation.STORE ? item.qtyStore : null);
      const updatedQty = input.to === StockLocation.STORE ? nextStore : (input.from === StockLocation.STORE ? nextStore : null);

      const movement = await tx.inventoryMovement.create({
        data: {
          itemId: item.id,
          actionType,
          from: input.from || null,
          to: input.to || null,
          quantity: qty,
          previousQty,
          updatedQty,
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
              qtyDiscontinued: nextDiscontinued,
            },
          },
        },
      });

      const formattedMovement: FormattedInventoryMovement = {
        id: movement.id,
        itemId: item.id,
        itemName: item.name,
        actionType: movement.actionType,
        from: movement.from,
        to: movement.to,
        quantity: movement.quantity,
        previousQty: movement.previousQty,
        updatedQty: movement.updatedQty,
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

    return movements.map((m) => {
      let actionType = m.actionType;
      if (!actionType) {
        if (!m.from && m.to === StockLocation.STORE) actionType = "ADD_STOCK";
        else if (m.from === StockLocation.STORE && m.to === StockLocation.ROOMS) actionType = "USE_STOCK";
        else if (m.to === StockLocation.DAMAGED) actionType = "MARK_DAMAGED";
        else if (m.to === StockLocation.DISCONTINUED) actionType = "MARK_DISCONTINUED";
        else if (m.to === StockLocation.STORE) actionType = "RETURN_AVAILABLE";
      }

      return {
        id: m.id,
        itemId: m.itemId,
        itemName: m.item.name,
        actionType,
        from: m.from,
        to: m.to,
        quantity: m.quantity,
        previousQty: m.previousQty,
        updatedQty: m.updatedQty,
        note: m.note,
        doneById: m.doneById,
        doneByName: userMap.get(m.doneById) || "Staff",
        doneAt: m.doneAt,
      };
    });
  }
}

export const inventoryService = new InventoryService();
