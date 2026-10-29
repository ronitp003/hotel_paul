import "server-only";
import { Decimal } from "decimal.js";
import { prisma } from "@/server/db";
import { AppError } from "@/lib/errors";
import { type RoomInput, type BulkRoomsInput } from "@/features/rooms/schemas";
import { type Actor, settingsService } from "./settings.service";
import { calculateStay, doIntervalsOverlap, type StayCalculationResult } from "./billing.service";
import { formatIST, formatISTDate, formatISTTime } from "@/lib/datetime";
import { type BookingStatus, type ProblemStatus, type Severity } from "@prisma/client";

export type DerivedRoomStatus = "AVAILABLE" | "OCCUPIED" | "MAINTENANCE";

export interface ConflictingBookingInfo {
  id: string;
  reference: string;
  guestName: string;
  checkInAt: Date;
  checkOutAt: Date;
}

export interface ConflictingMaintenanceInfo {
  id: string;
  startsAt: Date;
  endsAt: Date;
  reason: string;
}

export interface AvailableRoomResult {
  id: string;
  number: string;
  typeId: string;
  typeName: string;
  pricePerNight: number;
  isActive: boolean;
  isAvailable: boolean;
  unavailableReason: string | null;
  unavailableType: "BOOKED" | "MAINTENANCE" | "DISABLED" | null;
  hasProblem: boolean;
  openProblemsCount: number;
  conflictingBooking: ConflictingBookingInfo | null;
  conflictingMaintenance: ConflictingMaintenanceInfo | null;
  calculatedStay: StayCalculationResult;
  estimatedTotal: number;
}

export interface FindAvailableRoomsResponse {
  stay: StayCalculationResult;
  rooms: AvailableRoomResult[];
  availableCount: number;
  totalCount: number;
}

export interface RoomWithStatus {
  id: string;
  number: string;
  typeId: string;
  typeName: string;
  pricePerNight: number;
  isActive: boolean;
  status: DerivedRoomStatus;
  hasProblem: boolean;
  openProblemsCount: number;
  maintenanceReason: string | null;
  currentBooking: {
    id: string;
    reference: string;
    guestName: string;
    checkInAt: Date;
    checkOutAt: Date;
  } | null;
}

export interface RoomCalculationInput {
  maintenance?: Array<{
    startsAt: Date;
    endsAt: Date;
    reason: string;
  }>;
  bookings?: Array<{
    id: string;
    reference: string;
    status: BookingStatus;
    checkInAt: Date;
    checkOutAt: Date;
    actualCheckInAt?: Date | null;
    actualCheckOutAt?: Date | null;
    guests?: Array<{ name: string; isPrimary: boolean }>;
  }>;
  problems?: Array<{
    id: string;
    description: string;
    severity: Severity;
    status: ProblemStatus;
  }>;
}

/**
 * Pure calculation function for derived room status.
 * Invariant (PROJECT_OVERVIEW.md §7):
 * 1. Under maintenance: RoomMaintenance covers now
 * 2. Occupied: CHECKED_IN booking covers now
 * 3. Available: empty
 * 4. Overlay flag: has open problem (any unresolved RoomProblem)
 */
export function calculateRoomStatus(
  room: RoomCalculationInput,
  now: Date = new Date()
): {
  status: DerivedRoomStatus;
  hasProblem: boolean;
  openProblemsCount: number;
  maintenanceReason: string | null;
  currentBooking: {
    id: string;
    reference: string;
    guestName: string;
    checkInAt: Date;
    checkOutAt: Date;
  } | null;
} {
  const openProblems = room.problems?.filter((p) => p.status === "OPEN") ?? [];
  const hasProblem = openProblems.length > 0;
  const openProblemsCount = openProblems.length;

  // 1. Maintenance check (startsAt <= now && endsAt >= now)
  const activeMaintenance = room.maintenance?.find(
    (m) => new Date(m.startsAt) <= now && new Date(m.endsAt) >= now
  );

  if (activeMaintenance) {
    return {
      status: "MAINTENANCE",
      hasProblem,
      openProblemsCount,
      maintenanceReason: activeMaintenance.reason,
      currentBooking: null,
    };
  }

  // 2. Occupied check (CHECKED_IN booking active right now)
  const activeBooking = room.bookings?.find((b) => {
    if (b.status !== "CHECKED_IN") return false;

    const start = b.actualCheckInAt ? new Date(b.actualCheckInAt) : new Date(b.checkInAt);
    if (start > now) return false;

    if (b.actualCheckOutAt) {
      return new Date(b.actualCheckOutAt) > now;
    }

    return new Date(b.checkOutAt) >= now;
  });

  if (activeBooking) {
    const primaryGuest =
      activeBooking.guests?.find((g) => g.isPrimary)?.name ||
      activeBooking.guests?.[0]?.name ||
      "Guest";

    return {
      status: "OCCUPIED",
      hasProblem,
      openProblemsCount,
      maintenanceReason: null,
      currentBooking: {
        id: activeBooking.id,
        reference: activeBooking.reference,
        guestName: primaryGuest,
        checkInAt: activeBooking.checkInAt,
        checkOutAt: activeBooking.checkOutAt,
      },
    };
  }

  // 3. Available (empty)
  return {
    status: "AVAILABLE",
    hasProblem,
    openProblemsCount,
    maintenanceReason: null,
    currentBooking: null,
  };
}

/**
 * Formats a friendly target time string in IST (e.g., "10:00 PM today", "10:00 PM tomorrow", "29 Oct, 10:00 PM").
 */
export function formatFriendlyUntil(targetDate: Date, now: Date = new Date()): string {
  const targetIST = formatISTDate(targetDate);
  const todayIST = formatISTDate(now);
  const tomorrowDate = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const tomorrowIST = formatISTDate(tomorrowDate);

  const timeStr = formatISTTime(targetDate);
  if (targetIST === todayIST) {
    return `${timeStr} today`;
  }
  if (targetIST === tomorrowIST) {
    return `${timeStr} tomorrow`;
  }
  return formatIST(targetDate, "d MMM, h:mm a");
}

export interface RoomAvailabilityInput {
  id: string;
  number: string;
  typeId: string;
  type: { name: string };
  pricePerNight: Decimal | number;
  isActive: boolean;
  maintenance?: Array<{
    id: string;
    startsAt: Date;
    endsAt: Date;
    reason: string;
  }>;
  bookings?: Array<{
    id: string;
    reference: string;
    status: BookingStatus;
    checkInAt: Date;
    checkOutAt: Date;
    guests?: Array<{ name: string; isPrimary: boolean }>;
  }>;
  problems?: Array<{
    id: string;
    status: ProblemStatus;
  }>;
}

/**
 * Pure evaluation function for room availability during a requested stay window [checkIn, checkOut).
 *
 * Rules:
 * 1. Disabled room (!room.isActive) -> unavailable (DISABLED)
 * 2. Overlapping maintenance period -> unavailable (MAINTENANCE) with reason
 * 3. Overlapping booking (RESERVED or CHECKED_IN) -> unavailable (BOOKED) with reason and primary guest
 * 4. Back-to-back stays (booking checkout == requested checkIn OR booking checkIn == requested checkOut)
 *    do NOT overlap and remain available.
 * 5. Open problems flag hasProblem: true, but do not block room availability.
 */
export function evaluateRoomAvailability(
  room: RoomAvailabilityInput,
  checkIn: Date,
  checkOut: Date,
  stay: StayCalculationResult,
  now: Date = new Date()
): AvailableRoomResult {
  const openProblems = room.problems?.filter((p) => p.status === "OPEN") ?? [];
  const hasProblem = openProblems.length > 0;
  const openProblemsCount = openProblems.length;
  const pricePerNight = Number(room.pricePerNight);
  const estimatedTotal = new Decimal(room.pricePerNight).mul(stay.days).toNumber();

  // 1. Inactive room check
  if (!room.isActive) {
    return {
      id: room.id,
      number: room.number,
      typeId: room.typeId,
      typeName: room.type.name,
      pricePerNight,
      isActive: false,
      isAvailable: false,
      unavailableReason: "Room is currently disabled",
      unavailableType: "DISABLED",
      hasProblem,
      openProblemsCount,
      conflictingBooking: null,
      conflictingMaintenance: null,
      calculatedStay: stay,
      estimatedTotal,
    };
  }

  // 2. Overlapping maintenance check [startsAt, endsAt)
  const overlappingMaintenance = (room.maintenance ?? [])
    .filter((m) => doIntervalsOverlap(m.startsAt, m.endsAt, checkIn, checkOut))
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());

  if (overlappingMaintenance.length > 0) {
    const firstMaint = overlappingMaintenance[0];
    const maintStartsAt = new Date(firstMaint.startsAt);
    const maintEndsAt = new Date(firstMaint.endsAt);
    const reasonSuffix = firstMaint.reason ? ` (${firstMaint.reason})` : "";

    let reason: string;
    if (maintStartsAt.getTime() > checkIn.getTime()) {
      reason = `Under maintenance from ${formatFriendlyUntil(maintStartsAt, now)} to ${formatFriendlyUntil(maintEndsAt, now)}${reasonSuffix}`;
    } else {
      reason = `Under maintenance until ${formatFriendlyUntil(maintEndsAt, now)}${reasonSuffix}`;
    }

    return {
      id: room.id,
      number: room.number,
      typeId: room.typeId,
      typeName: room.type.name,
      pricePerNight,
      isActive: true,
      isAvailable: false,
      unavailableReason: reason,
      unavailableType: "MAINTENANCE",
      hasProblem,
      openProblemsCount,
      conflictingBooking: null,
      conflictingMaintenance: {
        id: firstMaint.id,
        startsAt: maintStartsAt,
        endsAt: maintEndsAt,
        reason: firstMaint.reason,
      },
      calculatedStay: stay,
      estimatedTotal,
    };
  }

  // 3. Overlapping booking check (only active statuses: RESERVED or CHECKED_IN)
  const overlappingBookings = (room.bookings ?? [])
    .filter(
      (b) =>
        (b.status === "RESERVED" || b.status === "CHECKED_IN") &&
        doIntervalsOverlap(b.checkInAt, b.checkOutAt, checkIn, checkOut)
    )
    .sort((a, b) => new Date(a.checkInAt).getTime() - new Date(b.checkInAt).getTime());

  if (overlappingBookings.length > 0) {
    const firstBooking = overlappingBookings[0];
    const bCheckInAt = new Date(firstBooking.checkInAt);
    const bCheckOutAt = new Date(firstBooking.checkOutAt);

    const primaryGuest =
      firstBooking.guests?.find((g) => g.isPrimary)?.name ||
      firstBooking.guests?.[0]?.name ||
      "Guest";

    let reason: string;
    if (bCheckInAt.getTime() > checkIn.getTime()) {
      reason = `Booked from ${formatFriendlyUntil(bCheckInAt, now)} to ${formatFriendlyUntil(bCheckOutAt, now)}`;
    } else {
      reason = `Booked until ${formatFriendlyUntil(bCheckOutAt, now)}`;
    }

    return {
      id: room.id,
      number: room.number,
      typeId: room.typeId,
      typeName: room.type.name,
      pricePerNight,
      isActive: true,
      isAvailable: false,
      unavailableReason: reason,
      unavailableType: "BOOKED",
      hasProblem,
      openProblemsCount,
      conflictingBooking: {
        id: firstBooking.id,
        reference: firstBooking.reference,
        guestName: primaryGuest,
        checkInAt: bCheckInAt,
        checkOutAt: bCheckOutAt,
      },
      conflictingMaintenance: null,
      calculatedStay: stay,
      estimatedTotal,
    };
  }

  // 4. Available
  return {
    id: room.id,
    number: room.number,
    typeId: room.typeId,
    typeName: room.type.name,
    pricePerNight,
    isActive: true,
    isAvailable: true,
    unavailableReason: null,
    unavailableType: null,
    hasProblem,
    openProblemsCount,
    conflictingBooking: null,
    conflictingMaintenance: null,
    calculatedStay: stay,
    estimatedTotal,
  };
}

export const roomService = {
  /**
   * Calculates derived status for a single room.
   */
  async getRoomStatus(roomId: string, now: Date = new Date()) {
    const room = await prisma.room.findUnique({
      where: { id: roomId },
      include: {
        maintenance: {
          where: {
            startsAt: { lte: now },
            endsAt: { gte: now },
          },
        },
        bookings: {
          where: {
            status: "CHECKED_IN",
          },
          include: {
            guests: true,
          },
        },
        problems: {
          where: {
            status: "OPEN",
          },
        },
      },
    });

    if (!room) {
      throw new AppError("ROOM_NOT_FOUND", "Room not found.");
    }

    return calculateRoomStatus(room, now);
  },

  /**
   * Lists all rooms with their derived status and basic details.
   */
  async listRoomsWithStatus(options?: {
    typeId?: string;
    search?: string;
  }): Promise<RoomWithStatus[]> {
    const now = new Date();

    const rooms = await prisma.room.findMany({
      where: {
        ...(options?.typeId ? { typeId: options.typeId } : {}),
        ...(options?.search
          ? {
              number: {
                contains: options.search.trim(),
                mode: "insensitive",
              },
            }
          : {}),
      },
      include: {
        type: true,
        maintenance: {
          where: {
            startsAt: { lte: now },
            endsAt: { gte: now },
          },
        },
        bookings: {
          where: {
            status: "CHECKED_IN",
          },
          include: {
            guests: true,
          },
        },
        problems: {
          where: {
            status: "OPEN",
          },
        },
      },
      orderBy: { number: "asc" },
    });

    return rooms.map((room) => {
      const derived = calculateRoomStatus(room, now);

      return {
        id: room.id,
        number: room.number,
        typeId: room.typeId,
        typeName: room.type.name,
        pricePerNight: Number(room.pricePerNight),
        isActive: room.isActive,
        status: derived.status,
        hasProblem: derived.hasProblem,
        openProblemsCount: derived.openProblemsCount,
        maintenanceReason: derived.maintenanceReason,
        currentBooking: derived.currentBooking,
      };
    });
  },

  /**
   * Creates a single room.
   */
  async createRoom(actor: Actor, data: RoomInput) {
    const trimmedNumber = data.number.trim();

    return await prisma.$transaction(async (tx) => {
      const type = await tx.roomType.findUnique({ where: { id: data.typeId } });
      if (!type) {
        throw new AppError("VALIDATION_ERROR", "Selected room type does not exist.");
      }

      const existing = await tx.room.findFirst({
        where: {
          number: {
            equals: trimmedNumber,
            mode: "insensitive",
          },
        },
      });

      if (existing) {
        throw new AppError("VALIDATION_ERROR", `Room "${trimmedNumber}" already exists.`);
      }

      const created = await tx.room.create({
        data: {
          number: trimmedNumber,
          typeId: data.typeId,
          pricePerNight: data.pricePerNight,
          isActive: data.isActive ?? true,
        },
        include: {
          type: true,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          action: "room.create",
          entity: "Room",
          entityId: created.id,
          metadata: {
            number: created.number,
            typeName: created.type.name,
            pricePerNight: Number(created.pricePerNight),
            isActive: created.isActive,
          },
        },
      });

      return {
        id: created.id,
        number: created.number,
        typeId: created.typeId,
        typeName: created.type.name,
        pricePerNight: Number(created.pricePerNight),
        isActive: created.isActive,
      };
    });
  },

  /**
   * Bulk creates rooms across a numerical range (e.g. 101 to 110, optional prefix).
   */
  async bulkCreateRooms(actor: Actor, data: BulkRoomsInput) {
    const prefix = data.prefix.trim();
    const candidateNumbers: string[] = [];

    for (let i = data.startNumber; i <= data.endNumber; i++) {
      candidateNumbers.push(`${prefix}${i}`);
    }

    return await prisma.$transaction(async (tx) => {
      const type = await tx.roomType.findUnique({ where: { id: data.typeId } });
      if (!type) {
        throw new AppError("VALIDATION_ERROR", "Selected room type does not exist.");
      }

      // Check for colliding room numbers
      const existing = await tx.room.findMany({
        where: {
          number: {
            in: candidateNumbers,
            mode: "insensitive",
          },
        },
        select: { number: true },
      });

      if (existing.length > 0) {
        const collisions = existing.map((r) => r.number).join(", ");
        throw new AppError(
          "VALIDATION_ERROR",
          `Cannot bulk create: room(s) ${collisions} already exist.`
        );
      }

      await tx.room.createMany({
        data: candidateNumbers.map((num) => ({
          number: num,
          typeId: data.typeId,
          pricePerNight: data.pricePerNight,
          isActive: data.isActive ?? true,
        })),
      });

      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          action: "room.bulkCreate",
          entity: "Room",
          metadata: {
            prefix,
            startNumber: data.startNumber,
            endNumber: data.endNumber,
            count: candidateNumbers.length,
            typeName: type.name,
            pricePerNight: data.pricePerNight,
          },
        },
      });

      return {
        count: candidateNumbers.length,
        numbers: candidateNumbers,
      };
    });
  },

  /**
   * Updates an existing room.
   */
  async updateRoom(actor: Actor, id: string, data: RoomInput) {
    const trimmedNumber = data.number.trim();

    return await prisma.$transaction(async (tx) => {
      const current = await tx.room.findUnique({
        where: { id },
        include: { type: true },
      });

      if (!current) {
        throw new AppError("ROOM_NOT_FOUND", "Room not found.");
      }

      const type = await tx.roomType.findUnique({ where: { id: data.typeId } });
      if (!type) {
        throw new AppError("VALIDATION_ERROR", "Selected room type does not exist.");
      }

      const collision = await tx.room.findFirst({
        where: {
          id: { not: id },
          number: {
            equals: trimmedNumber,
            mode: "insensitive",
          },
        },
      });

      if (collision) {
        throw new AppError("VALIDATION_ERROR", `Room "${trimmedNumber}" already exists.`);
      }

      const updated = await tx.room.update({
        where: { id },
        data: {
          number: trimmedNumber,
          typeId: data.typeId,
          pricePerNight: data.pricePerNight,
          isActive: data.isActive ?? true,
        },
        include: { type: true },
      });

      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          action: "room.update",
          entity: "Room",
          entityId: id,
          metadata: {
            before: {
              number: current.number,
              typeName: current.type.name,
              pricePerNight: Number(current.pricePerNight),
              isActive: current.isActive,
            },
            after: {
              number: updated.number,
              typeName: updated.type.name,
              pricePerNight: Number(updated.pricePerNight),
              isActive: updated.isActive,
            },
          },
        },
      });

      return {
        id: updated.id,
        number: updated.number,
        typeId: updated.typeId,
        typeName: updated.type.name,
        pricePerNight: Number(updated.pricePerNight),
        isActive: updated.isActive,
      };
    });
  },

  /**
   * Toggles the active status of a room.
   */
  async toggleRoomActive(actor: Actor, id: string, isActive: boolean) {
    return await prisma.$transaction(async (tx) => {
      const current = await tx.room.findUnique({ where: { id } });
      if (!current) {
        throw new AppError("ROOM_NOT_FOUND", "Room not found.");
      }

      const updated = await tx.room.update({
        where: { id },
        data: { isActive },
        include: { type: true },
      });

      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          action: isActive ? "room.activate" : "room.deactivate",
          entity: "Room",
          entityId: id,
          metadata: {
            before: { isActive: current.isActive },
            after: { isActive: updated.isActive },
          },
        },
      });

      return {
        id: updated.id,
        number: updated.number,
        typeId: updated.typeId,
        typeName: updated.type.name,
        pricePerNight: Number(updated.pricePerNight),
        isActive: updated.isActive,
      };
    });
  },

  /**
   * Deletes a room if it has no associated bookings, maintenance records, or problems.
   */
  async deleteRoom(actor: Actor, id: string) {
    return await prisma.$transaction(async (tx) => {
      const current = await tx.room.findUnique({
        where: { id },
        include: {
          _count: {
            select: {
              bookings: true,
              maintenance: true,
              problems: true,
            },
          },
        },
      });

      if (!current) {
        throw new AppError("ROOM_NOT_FOUND", "Room not found.");
      }

      const { bookings, maintenance, problems } = current._count;
      if (bookings > 0 || maintenance > 0 || problems > 0) {
        const reasons: string[] = [];
        if (bookings > 0) reasons.push(`${bookings} booking(s)`);
        if (maintenance > 0) reasons.push(`${maintenance} maintenance record(s)`);
        if (problems > 0) reasons.push(`${problems} reported problem(s)`);

        throw new AppError(
          "VALIDATION_ERROR",
          `Cannot delete Room "${current.number}": it has ${reasons.join(", ")}. Disable the room instead to preserve historical records.`
        );
      }

      await tx.room.delete({ where: { id } });

      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          action: "room.delete",
          entity: "Room",
          entityId: id,
          metadata: {
            number: current.number,
          },
        },
      });

      return {
        id,
        number: current.number,
      };
    });
  },

  /**
   * Finds room availability for a requested check-in and check-out window.
   * Calculates 24h stay days with hotel grace period, checks for overlapping
   * bookings and maintenance, and returns all rooms with friendly reasons.
   */
  async findAvailableRooms(
    checkInInput: Date | string | number,
    checkOutInput: Date | string | number,
    options?: {
      typeId?: string;
      search?: string;
      excludeBookingId?: string;
    }
  ): Promise<FindAvailableRoomsResponse> {
    const checkIn = checkInInput instanceof Date ? checkInInput : new Date(checkInInput);
    const checkOut = checkOutInput instanceof Date ? checkOutInput : new Date(checkOutInput);

    if (isNaN(checkIn.getTime()) || isNaN(checkOut.getTime())) {
      throw new AppError("VALIDATION_ERROR", "Invalid check-in or check-out date.");
    }

    if (checkOut.getTime() <= checkIn.getTime()) {
      throw new AppError(
        "VALIDATION_ERROR",
        "Check-out time must be strictly after check-in time."
      );
    }

    const settings = await settingsService.getSettings();
    const stay = calculateStay(checkIn, checkOut, settings.hotel.graceMinutes);

    const rooms = await prisma.room.findMany({
      where: {
        ...(options?.typeId ? { typeId: options.typeId } : {}),
        ...(options?.search
          ? {
              number: {
                contains: options.search.trim(),
                mode: "insensitive",
              },
            }
          : {}),
      },
      include: {
        type: true,
        maintenance: {
          where: {
            startsAt: { lt: checkOut },
            endsAt: { gt: checkIn },
          },
          orderBy: { startsAt: "asc" },
        },
        bookings: {
          where: {
            status: { in: ["RESERVED", "CHECKED_IN"] },
            checkInAt: { lt: checkOut },
            checkOutAt: { gt: checkIn },
            ...(options?.excludeBookingId ? { id: { not: options.excludeBookingId } } : {}),
          },
          include: {
            guests: true,
          },
          orderBy: { checkInAt: "asc" },
        },
        problems: {
          where: {
            status: "OPEN",
          },
        },
      },
      orderBy: { number: "asc" },
    });

    const now = new Date();
    const evaluatedRooms = rooms.map((room) =>
      evaluateRoomAvailability(room, checkIn, checkOut, stay, now)
    );

    const availableCount = evaluatedRooms.filter((r) => r.isAvailable).length;

    return {
      stay,
      rooms: evaluatedRooms,
      availableCount,
      totalCount: evaluatedRooms.length,
    };
  },
};
