import "server-only";
import { prisma } from "@/server/db";
import { AppError } from "@/lib/errors";
import {
  type LogProblemInput,
  type MarkProblemFixedInput,
  type CreateMaintenanceInput,
  type CloseMaintenanceInput,
} from "@/features/rooms/schemas";
import { type Actor } from "./settings.service";
import { calculateRoomStatus } from "./room.service";
import { type Severity } from "@prisma/client";

export interface ConflictingBooking {
  id: string;
  reference: string;
  status: string;
  guestName: string;
  guestPhone: string;
  checkInAt: Date;
  checkOutAt: Date;
}

export interface ConflictingMaintenance {
  id: string;
  reason: string;
  startsAt: Date;
  endsAt: Date;
}

export interface MaintenanceConflictsResult {
  bookings: ConflictingBooking[];
  maintenance: ConflictingMaintenance[];
  roomUpcomingMaintenance: ConflictingMaintenance[];
}

export class RoomMaintenanceService {
  /**
   * Logs a new problem for a room (LOW, MEDIUM, HIGH, CRITICAL).
   */
  async logProblem(input: LogProblemInput, actor: Actor) {
    return prisma.$transaction(async (tx) => {
      const room = await tx.room.findUnique({
        where: { id: input.roomId },
        select: { id: true, number: true, isActive: true },
      });

      if (!room) {
        throw new AppError("ROOM_NOT_FOUND", "Room not found.");
      }

      const problem = await tx.roomProblem.create({
        data: {
          roomId: room.id,
          severity: input.severity as Severity,
          description: input.description,
          status: "OPEN",
          reportedById: actor.id,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          action: "ROOM_PROBLEM_LOGGED",
          entity: "RoomProblem",
          entityId: problem.id,
          metadata: {
            roomId: room.id,
            roomNumber: room.number,
            severity: input.severity,
            description: input.description,
          },
        },
      });

      return problem;
    });
  }

  /**
   * Marks an open problem as fixed (records who and when).
   */
  async markProblemFixed(input: MarkProblemFixedInput, actor: Actor) {
    return prisma.$transaction(async (tx) => {
      const problem = await tx.roomProblem.findUnique({
        where: { id: input.problemId },
        include: { room: { select: { id: true, number: true } } },
      });

      if (!problem) {
        throw new AppError("VALIDATION_ERROR", "Problem record not found.");
      }

      if (problem.status === "FIXED") {
        throw new AppError(
          "VALIDATION_ERROR",
          "This problem has already been marked as fixed."
        );
      }

      const updated = await tx.roomProblem.update({
        where: { id: problem.id },
        data: {
          status: "FIXED",
          fixedById: actor.id,
          fixedAt: new Date(),
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          action: "ROOM_PROBLEM_FIXED",
          entity: "RoomProblem",
          entityId: problem.id,
          metadata: {
            roomId: problem.roomId,
            roomNumber: problem.room.number,
            fixedById: actor.id,
            fixedByName: actor.name,
          },
        },
      });

      return updated;
    });
  }

  /**
   * Checks for overlapping bookings and maintenance periods in the specified time window.
   */
  async checkMaintenanceConflicts(
    roomId: string,
    startsAt: Date,
    endsAt: Date
  ): Promise<MaintenanceConflictsResult> {
    const now = new Date();

    // If startsAt overlaps with a recently completed past maintenance (e.g. within the same minute
    // due to HTML datetime-local input lacking seconds), clamp effectiveStartsAt to avoid false positive
    // warnings and PostgreSQL exclusion collision.
    let effectiveStartsAt = startsAt;
    const pastOverlapping = await prisma.roomMaintenance.findFirst({
      where: {
        roomId,
        endsAt: { lte: now, gt: startsAt },
      },
      orderBy: { endsAt: "desc" },
    });
    if (
      pastOverlapping &&
      pastOverlapping.endsAt > effectiveStartsAt &&
      pastOverlapping.endsAt < endsAt
    ) {
      effectiveStartsAt = pastOverlapping.endsAt;
    }

    const [overlappingBookings, overlappingMaintenance, upcomingMaintenance] =
      await Promise.all([
        prisma.booking.findMany({
          where: {
            roomId,
            status: { in: ["RESERVED", "CHECKED_IN"] },
            AND: [
              { checkInAt: { lt: endsAt } },
              { checkOutAt: { gt: effectiveStartsAt } },
            ],
          },
          include: {
            guests: {
              where: { isPrimary: true },
              take: 1,
            },
          },
          orderBy: { checkInAt: "asc" },
        }),
        prisma.roomMaintenance.findMany({
          where: {
            roomId,
            endsAt: { gt: now },
            AND: [
              { startsAt: { lt: endsAt } },
              { endsAt: { gt: effectiveStartsAt } },
            ],
          },
          orderBy: { startsAt: "asc" },
        }),
        prisma.roomMaintenance.findMany({
          where: {
            roomId,
            endsAt: { gte: now },
          },
          orderBy: { startsAt: "asc" },
        }),
      ]);

    return {
      bookings: overlappingBookings.map((b) => ({
        id: b.id,
        reference: b.reference,
        status: b.status,
        guestName: b.guests[0]?.name || "Unknown Guest",
        guestPhone: b.guests[0]?.mobile || "",
        checkInAt: b.checkInAt,
        checkOutAt: b.checkOutAt,
      })),
      maintenance: overlappingMaintenance.map((m) => ({
        id: m.id,
        reason: m.reason,
        startsAt: m.startsAt,
        endsAt: m.endsAt,
      })),
      roomUpcomingMaintenance: upcomingMaintenance.map((m) => ({
        id: m.id,
        reason: m.reason,
        startsAt: m.startsAt,
        endsAt: m.endsAt,
      })),
    };
  }

  /**
   * Creates a maintenance period for a room.
   * Strictly blocks creation if overlapping bookings exist (room must be free).
   */
  async createMaintenance(input: CreateMaintenanceInput, actor: Actor) {
    let startsAt = new Date(input.startsAt);
    const endsAt = new Date(input.endsAt);

    if (isNaN(startsAt.getTime()) || isNaN(endsAt.getTime()) || endsAt <= startsAt) {
      throw new AppError(
        "VALIDATION_ERROR",
        "Maintenance end time must be strictly after start time."
      );
    }

    return prisma.$transaction(async (tx) => {
      const room = await tx.room.findUnique({
        where: { id: input.roomId },
        select: { id: true, number: true, isActive: true },
      });

      if (!room) {
        throw new AppError("ROOM_NOT_FOUND", "Room not found.");
      }

      const now = new Date();

      // If startsAt overlaps with a recently completed past maintenance
      // (e.g. user closed a maintenance seconds ago in the same minute and datetime-local truncated seconds to :00),
      // seamlessly start right at the completion timestamp to satisfy PostgreSQL's exclusion constraint.
      const pastOverlapping = await tx.roomMaintenance.findFirst({
        where: {
          roomId: room.id,
          endsAt: { lte: now, gt: startsAt },
        },
        orderBy: { endsAt: "desc" },
      });

      if (pastOverlapping && pastOverlapping.endsAt > startsAt && pastOverlapping.endsAt < endsAt) {
        startsAt = pastOverlapping.endsAt;
      }

      // 1. Check for overlapping maintenance on the same room (only active or upcoming blocks)
      const existingMaintenance = await tx.roomMaintenance.findFirst({
        where: {
          roomId: room.id,
          endsAt: { gt: now },
          AND: [
            { startsAt: { lt: endsAt } },
            { endsAt: { gt: startsAt } },
          ],
        },
      });

      if (existingMaintenance) {
        throw new AppError(
          "MAINTENANCE_OVERLAP",
          `A maintenance period (${existingMaintenance.reason}) is already scheduled during this time.`
        );
      }

      // 2. Check for overlapping bookings
      const conflicts = await tx.booking.findMany({
        where: {
          roomId: room.id,
          status: { in: ["RESERVED", "CHECKED_IN"] },
          AND: [
            { checkInAt: { lt: endsAt } },
            { checkOutAt: { gt: startsAt } },
          ],
        },
        include: {
          guests: { where: { isPrimary: true }, take: 1 },
        },
      });

      if (conflicts.length > 0) {
        const conflictDetails = conflicts.map((c) => ({
          reference: c.reference,
          status: c.status,
          guestName: c.guests[0]?.name || "Unknown Guest",
        }));

        throw new AppError(
          "MAINTENANCE_OVERLAP",
          `Cannot schedule maintenance: Room ${room.number} is occupied or reserved during this period (${conflicts.length} booking(s)). The room must be free before maintenance can be scheduled.`,
          { conflicts: conflictDetails }
        );
      }

      // 3. Create maintenance period
      const maintenance = await tx.roomMaintenance.create({
        data: {
          roomId: room.id,
          startsAt,
          endsAt,
          reason: input.reason,
          createdById: actor.id,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          action: "ROOM_MAINTENANCE_SCHEDULED",
          entity: "RoomMaintenance",
          entityId: maintenance.id,
          metadata: {
            roomId: room.id,
            roomNumber: room.number,
            startsAt: startsAt.toISOString(),
            endsAt: endsAt.toISOString(),
            reason: input.reason,
            overlappingBookingsCount: conflicts.length,
          },
        },
      });

      return maintenance;
    });
  }

  /**
   * Deletes / cancels an active or scheduled maintenance period without recording it in history.
   * Used when maintenance was created accidentally.
   */
  async deleteMaintenance(maintenanceId: string, actor: Actor) {
    return prisma.$transaction(async (tx) => {
      const maintenance = await tx.roomMaintenance.findUnique({
        where: { id: maintenanceId },
        include: { room: { select: { id: true, number: true } } },
      });

      if (!maintenance) {
        throw new AppError("VALIDATION_ERROR", "Maintenance record not found.");
      }

      await tx.roomMaintenance.delete({
        where: { id: maintenance.id },
      });

      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          action: "ROOM_MAINTENANCE_CANCELLED",
          entity: "RoomMaintenance",
          entityId: maintenance.id,
          metadata: {
            roomId: maintenance.roomId,
            roomNumber: maintenance.room.number,
            reason: maintenance.reason,
            startsAt: maintenance.startsAt.toISOString(),
            endsAt: maintenance.endsAt.toISOString(),
          },
        },
      });

      return { success: true, roomId: maintenance.roomId };
    });
  }

  /**
   * Closes an active maintenance period earlier than scheduled.
   * Sets endsAt to the current timestamp (and startsAt if scheduled in the future),
   * updates the reason with completion note if provided,
   * records a ROOM_MAINTENANCE_COMPLETED audit log,
   * and saves the completed entry in maintenance history.
   */
  async closeMaintenance(input: CloseMaintenanceInput, actor: Actor) {
    return prisma.$transaction(async (tx) => {
      const maintenance = await tx.roomMaintenance.findUnique({
        where: { id: input.maintenanceId },
        include: { room: { select: { id: true, number: true } } },
      });

      if (!maintenance) {
        throw new AppError("VALIDATION_ERROR", "Maintenance record not found.");
      }

      const completedAt = new Date();
      let updatedReason = maintenance.reason;
      if (input.completionNote && input.completionNote.trim()) {
        updatedReason = `${maintenance.reason} (Closed: ${input.completionNote.trim()})`;
      }

      const newStartsAt =
        maintenance.startsAt >= completedAt
          ? new Date(completedAt.getTime() - 1000)
          : maintenance.startsAt;

      const updated = await tx.roomMaintenance.update({
        where: { id: maintenance.id },
        data: {
          startsAt: newStartsAt,
          endsAt: completedAt,
          reason: updatedReason,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          action: "ROOM_MAINTENANCE_COMPLETED",
          entity: "RoomMaintenance",
          entityId: maintenance.id,
          metadata: {
            roomId: maintenance.roomId,
            roomNumber: maintenance.room.number,
            originalStartsAt: maintenance.startsAt.toISOString(),
            originalEndsAt: maintenance.endsAt.toISOString(),
            completedAt: completedAt.toISOString(),
            completionNote: input.completionNote?.trim() || null,
            reason: updatedReason,
          },
        },
      });

      return {
        success: true,
        roomId: maintenance.roomId,
        maintenance: updated,
      };
    });
  }

  /**
   * Fetches complete details for a room including problems, maintenance history,
   * active stay, and booking history.
   */
  async getRoomDetails(roomId: string) {
    const room = await prisma.room.findUnique({
      where: { id: roomId },
      include: {
        type: true,
        problems: {
          orderBy: { reportedAt: "desc" },
        },
        maintenance: {
          orderBy: { startsAt: "desc" },
        },
        bookings: {
          include: {
            guests: true,
            payments: true,
          },
          orderBy: { checkInAt: "desc" },
          take: 20,
        },
      },
    });

    if (!room) {
      throw new AppError("ROOM_NOT_FOUND", "Room not found.");
    }

    // Collect user IDs to resolve names
    const userIds = new Set<string>();
    room.problems.forEach((p) => {
      if (p.reportedById) userIds.add(p.reportedById);
      if (p.fixedById) userIds.add(p.fixedById);
    });
    room.maintenance.forEach((m) => {
      if (m.createdById) userIds.add(m.createdById);
    });

    const users = await prisma.user.findMany({
      where: { id: { in: Array.from(userIds) } },
      select: { id: true, name: true, email: true },
    });
    const userMap = new Map(users.map((u) => [u.id, u.name]));

    // Calculate derived status
    const derived = calculateRoomStatus({
      maintenance: room.maintenance,
      bookings: room.bookings,
      problems: room.problems,
    });

    const now = new Date();

    const openProblems = room.problems
      .filter((p) => p.status === "OPEN")
      .map((p) => ({
        ...p,
        reportedByName: userMap.get(p.reportedById) || "Staff",
      }));

    const resolvedProblems = room.problems
      .filter((p) => p.status === "FIXED")
      .map((p) => ({
        ...p,
        reportedByName: userMap.get(p.reportedById) || "Staff",
        fixedByName: p.fixedById ? userMap.get(p.fixedById) || "Staff" : null,
      }));

    const activeMaintenance = room.maintenance
      .filter((m) => m.endsAt >= now)
      .map((m) => ({
        ...m,
        createdByName: userMap.get(m.createdById) || "Staff",
        isCurrentlyActive: m.startsAt <= now && m.endsAt >= now,
      }));

    const pastMaintenance = room.maintenance
      .filter((m) => m.endsAt < now)
      .map((m) => ({
        ...m,
        createdByName: userMap.get(m.createdById) || "Staff",
      }));

    const rawBooking = derived.currentBooking
      ? room.bookings.find((b) => b.id === derived.currentBooking?.id) || null
      : null;

    const currentBooking = rawBooking
      ? {
          id: rawBooking.id,
          reference: rawBooking.reference,
          status: rawBooking.status,
          checkInAt: rawBooking.checkInAt,
          checkOutAt: rawBooking.checkOutAt,
          rateApplied: Number(rawBooking.rateApplied),
          discount: Number(rawBooking.discount),
          guests: rawBooking.guests.map((g) => ({
            name: g.name,
            isPrimary: g.isPrimary,
            mobile: g.mobile,
          })),
        }
      : null;

    return {
      room: {
        id: room.id,
        number: room.number,
        typeId: room.typeId,
        typeName: room.type.name,
        pricePerNight: Number(room.pricePerNight),
        isActive: room.isActive,
        createdAt: room.createdAt,
      },
      derivedStatus: {
        status: derived.status,
        hasProblem: derived.hasProblem,
        openProblemsCount: derived.openProblemsCount,
        maintenanceReason: derived.maintenanceReason,
      },
      currentBooking,
      openProblems,
      resolvedProblems,
      activeMaintenance,
      pastMaintenance,
      recentBookings: room.bookings.map((b) => {
        const primaryGuest = b.guests.find((g) => g.isPrimary) || b.guests[0];
        const totalPaid = b.payments.reduce(
          (acc, p) => acc + (p.kind === "REFUND" ? -Number(p.amount) : Number(p.amount)),
          0
        );
        return {
          id: b.id,
          reference: b.reference,
          status: b.status,
          primaryGuestName: primaryGuest?.name || "Unknown Guest",
          primaryGuestMobile: primaryGuest?.mobile || null,
          checkInAt: b.checkInAt,
          checkOutAt: b.checkOutAt,
          actualCheckInAt: b.actualCheckInAt,
          actualCheckOutAt: b.actualCheckOutAt,
          rateApplied: Number(b.rateApplied),
          totalPaid,
        };
      }),
    };
  }
}

export const roomMaintenanceService = new RoomMaintenanceService();

export type RoomDetailsData = Awaited<
  ReturnType<RoomMaintenanceService["getRoomDetails"]>
>;

