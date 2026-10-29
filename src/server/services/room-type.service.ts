import "server-only";
import { prisma } from "@/server/db";
import { AppError } from "@/lib/errors";
import { type RoomTypeInput } from "@/features/rooms/schemas";
import { type Actor } from "./settings.service";

export const roomTypeService = {
  /**
   * Lists all room types along with the count of assigned rooms.
   */
  async listRoomTypes() {
    return await prisma.roomType.findMany({
      include: {
        _count: {
          select: { rooms: true },
        },
      },
      orderBy: { name: "asc" },
    });
  },

  /**
   * Creates a new room type with case-insensitive unique name validation.
   */
  async createRoomType(actor: Actor, data: RoomTypeInput) {
    const trimmedName = data.name.trim();

    return await prisma.$transaction(async (tx) => {
      const existing = await tx.roomType.findFirst({
        where: {
          name: {
            equals: trimmedName,
            mode: "insensitive",
          },
        },
      });

      if (existing) {
        throw new AppError(
          "VALIDATION_ERROR",
          `A room type named "${trimmedName}" already exists.`
        );
      }

      const created = await tx.roomType.create({
        data: {
          name: trimmedName,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          action: "roomType.create",
          entity: "RoomType",
          entityId: created.id,
          metadata: {
            after: { name: created.name },
          },
        },
      });

      return created;
    });
  },

  /**
   * Updates an existing room type name with case-insensitive collision check.
   */
  async updateRoomType(actor: Actor, id: string, data: RoomTypeInput) {
    const trimmedName = data.name.trim();

    return await prisma.$transaction(async (tx) => {
      const current = await tx.roomType.findUnique({ where: { id } });
      if (!current) {
        throw new AppError("VALIDATION_ERROR", "Room type not found.");
      }

      const collision = await tx.roomType.findFirst({
        where: {
          id: { not: id },
          name: {
            equals: trimmedName,
            mode: "insensitive",
          },
        },
      });

      if (collision) {
        throw new AppError(
          "VALIDATION_ERROR",
          `Another room type named "${trimmedName}" already exists.`
        );
      }

      const updated = await tx.roomType.update({
        where: { id },
        data: { name: trimmedName },
      });

      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          action: "roomType.update",
          entity: "RoomType",
          entityId: id,
          metadata: {
            before: { name: current.name },
            after: { name: updated.name },
          },
        },
      });

      return updated;
    });
  },

  /**
   * Deletes a room type if no rooms reference it.
   */
  async deleteRoomType(actor: Actor, id: string) {
    return await prisma.$transaction(async (tx) => {
      const current = await tx.roomType.findUnique({ where: { id } });
      if (!current) {
        throw new AppError("VALIDATION_ERROR", "Room type not found.");
      }

      const assignedRoomsCount = await tx.room.count({
        where: { typeId: id },
      });

      if (assignedRoomsCount > 0) {
        throw new AppError(
          "VALIDATION_ERROR",
          `Cannot delete "${current.name}": ${assignedRoomsCount} room(s) are currently assigned to this type.`
        );
      }

      await tx.roomType.delete({ where: { id } });

      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          action: "roomType.delete",
          entity: "RoomType",
          entityId: id,
          metadata: {
            before: { name: current.name },
          },
        },
      });

      return { id };
    });
  },
};
