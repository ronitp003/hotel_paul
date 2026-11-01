import "server-only";
import { prisma } from "@/server/db";
import { type Actor } from "@/server/auth/session";
import { AppError } from "@/lib/errors";
import {
  formatIST,
  startOfISTDay,
  endOfISTDay,
  startOfISTMonth,
  endOfISTMonth,
  fromISTInput,
  toIST,
} from "@/lib/datetime";
import { subDays, subMonths } from "date-fns";
import {
  type BackupData,
  type BackupDiffSummary,
  type ConflictItem,
  type ExportBookingsFilter,
  backupDataSchema,
} from "@/features/settings/data-schemas";
import { BookingStatus, PaymentKind } from "@prisma/client";

function escapeCsv(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export const backupService = {
  /**
   * Generates a complete, structured JSON backup of the hotel database.
   * Versioned schema (schemaVersion: 1) containing all settings, rooms, stays,
   * payments, invoices, inventory, maintenance, and problem records.
   */
  async generateFullBackup(actor: Actor): Promise<BackupData> {
    const [
      hotelSettings,
      gstSlabs,
      invoiceSequence,
      roomTypes,
      rooms,
      bookings,
      inventoryItems,
      inventoryMovements,
      maintenanceRecords,
      problemRecords,
    ] = await Promise.all([
      prisma.hotelSettings.findFirst({ where: { id: 1 } }),
      prisma.gstSlab.findMany({ orderBy: { percent: "asc" } }),
      prisma.invoiceSequence.findFirst({ where: { id: 1 } }),
      prisma.roomType.findMany({ orderBy: { name: "asc" } }),
      prisma.room.findMany({ orderBy: { number: "asc" } }),
      prisma.booking.findMany({
        include: {
          guests: { orderBy: { isPrimary: "desc" } },
          charges: { orderBy: { createdAt: "asc" } },
          payments: { orderBy: { receivedAt: "asc" } },
          invoice: {
            include: {
              corrections: { orderBy: { doneAt: "asc" } },
            },
          },
        },
        orderBy: { checkInAt: "asc" },
      }),
      prisma.inventoryItem.findMany({ orderBy: { name: "asc" } }),
      prisma.inventoryMovement.findMany({ orderBy: { doneAt: "asc" } }),
      prisma.roomMaintenance.findMany({ orderBy: { startsAt: "asc" } }),
      prisma.roomProblem.findMany({ orderBy: { reportedAt: "asc" } }),
    ]);

    let totalGuestsCount = 0;
    let totalChargesCount = 0;
    let totalPaymentsCount = 0;
    let totalInvoicesCount = 0;

    const serializedBookings = bookings.map((b) => {
      totalGuestsCount += b.guests.length;
      totalChargesCount += b.charges.length;
      totalPaymentsCount += b.payments.length;
      if (b.invoice) totalInvoicesCount++;

      return {
        id: b.id,
        reference: b.reference,
        groupBookingId: b.groupBookingId,
        isGroupMaster: b.isGroupMaster,
        roomId: b.roomId,
        status: b.status,
        source: b.source,
        checkInAt: b.checkInAt.toISOString(),
        checkOutAt: b.checkOutAt.toISOString(),
        actualCheckInAt: b.actualCheckInAt ? b.actualCheckInAt.toISOString() : null,
        actualCheckOutAt: b.actualCheckOutAt ? b.actualCheckOutAt.toISOString() : null,
        arrivingFrom: b.arrivingFrom,
        purposeOfVisit: b.purposeOfVisit,
        companyName: b.companyName,
        companyGstin: b.companyGstin,
        companyAddress: b.companyAddress,
        rateApplied: Number(b.rateApplied),
        discount: Number(b.discount),
        gstPercentOverride: b.gstPercentOverride ? Number(b.gstPercentOverride) : null,
        createdById: b.createdById,
        createdAt: b.createdAt.toISOString(),
        updatedAt: b.updatedAt.toISOString(),
        guests: b.guests.map((g) => ({
          id: g.id,
          allocatedRoomId: g.allocatedRoomId,
          isPrimary: g.isPrimary,
          name: g.name,
          fatherName: g.fatherName,
          age: g.age,
          sex: g.sex,
          mobile: g.mobile,
        })),
        charges: b.charges.map((c) => ({
          id: c.id,
          description: c.description,
          amount: Number(c.amount),
          isTaxable: c.isTaxable,
          createdById: c.createdById,
          createdAt: c.createdAt.toISOString(),
        })),
        payments: b.payments.map((p) => ({
          id: p.id,
          kind: p.kind,
          mode: p.mode,
          amount: Number(p.amount),
          note: p.note,
          receivedAt: p.receivedAt.toISOString(),
          createdById: p.createdById,
        })),
        invoice: b.invoice
          ? {
              id: b.invoice.id,
              number: b.invoice.number,
              displayNo: b.invoice.displayNo,
              status: b.invoice.status,
              issuedAt: b.invoice.issuedAt.toISOString(),
              issuedById: b.invoice.issuedById,
              taxableAmount: Number(b.invoice.taxableAmount),
              cgst: Number(b.invoice.cgst),
              sgst: Number(b.invoice.sgst),
              billAmount: Number(b.invoice.billAmount),
              advancePaid: Number(b.invoice.advancePaid),
              balance: Number(b.invoice.balance),
              snapshot: b.invoice.snapshot,
              corrections: b.invoice.corrections.map((corr) => ({
                id: corr.id,
                action: corr.action,
                reason: corr.reason,
                before: corr.before,
                after: corr.after,
                doneById: corr.doneById,
                doneAt: corr.doneAt.toISOString(),
              })),
            }
          : null,
      };
    });

    const backupPayload: BackupData = {
      metadata: {
        schemaVersion: 1,
        exportedAt: new Date().toISOString(),
        exportedBy: {
          id: actor.id,
          name: actor.name,
          email: actor.email,
        },
        hotel: {
          name: hotelSettings?.name || "Hotel Paul",
          gstin: hotelSettings?.gstin || "",
          phone: hotelSettings?.phone || "",
          address: hotelSettings?.address || "",
        },
        counts: {
          roomTypes: roomTypes.length,
          rooms: rooms.length,
          bookings: bookings.length,
          guests: totalGuestsCount,
          charges: totalChargesCount,
          payments: totalPaymentsCount,
          invoices: totalInvoicesCount,
          inventoryItems: inventoryItems.length,
          inventoryMovements: inventoryMovements.length,
          roomMaintenance: maintenanceRecords.length,
          roomProblems: problemRecords.length,
        },
      },
      settings: {
        hotelSettings: hotelSettings
          ? {
              ...hotelSettings,
              updatedAt: hotelSettings.updatedAt.toISOString(),
            }
          : null,
        gstSlabs: gstSlabs.map((s) => ({
          id: s.id,
          minRate: Number(s.minRate),
          maxRate: s.maxRate ? Number(s.maxRate) : null,
          percent: Number(s.percent),
          isActive: s.isActive,
        })),
        invoiceSequence: invoiceSequence || null,
      },
      catalog: {
        roomTypes: roomTypes.map((rt) => ({ id: rt.id, name: rt.name })),
        rooms: rooms.map((r) => ({
          id: r.id,
          number: r.number,
          typeId: r.typeId,
          pricePerNight: Number(r.pricePerNight),
          isActive: r.isActive,
          createdAt: r.createdAt.toISOString(),
        })),
      },
      bookings: serializedBookings,
      inventory: {
        items: inventoryItems.map((item) => ({
          id: item.id,
          name: item.name,
          unit: item.unit,
          reorderLevel: item.reorderLevel,
          qtyStore: item.qtyStore,
          qtyRooms: item.qtyRooms,
          qtyLaundry: item.qtyLaundry,
          qtyDamaged: item.qtyDamaged,
          qtyDiscontinued: item.qtyDiscontinued,
          isActive: item.isActive,
        })),
        movements: inventoryMovements.map((m) => ({
          id: m.id,
          itemId: m.itemId,
          actionType: m.actionType,
          from: m.from,
          to: m.to,
          quantity: m.quantity,
          previousQty: m.previousQty,
          updatedQty: m.updatedQty,
          note: m.note,
          doneById: m.doneById,
          doneAt: m.doneAt.toISOString(),
        })),
      },
      maintenance: {
        records: maintenanceRecords.map((mr) => ({
          id: mr.id,
          roomId: mr.roomId,
          startsAt: mr.startsAt.toISOString(),
          endsAt: mr.endsAt.toISOString(),
          reason: mr.reason,
          createdById: mr.createdById,
          createdAt: mr.createdAt.toISOString(),
        })),
        problems: problemRecords.map((rp) => ({
          id: rp.id,
          roomId: rp.roomId,
          description: rp.description,
          severity: rp.severity,
          status: rp.status,
          reportedById: rp.reportedById,
          reportedAt: rp.reportedAt.toISOString(),
          fixedById: rp.fixedById,
          fixedAt: rp.fixedAt ? rp.fixedAt.toISOString() : null,
        })),
      },
    };

    // Record audit entry for backup download
    await prisma.auditLog.create({
      data: {
        actorId: actor.id,
        action: "data.backup",
        entity: "System",
        entityId: "backup-v1",
        metadata: {
          exportedCounts: backupPayload.metadata.counts,
          timestamp: backupPayload.metadata.exportedAt,
        },
      },
    });

    return backupPayload;
  },

  /**
   * Generates a comprehensive accountant CSV export of bookings & GST bills
   * specifically formatted for GSTR filing, tax audits, and accountant analysis.
   */
  async generateBookingsCsv(
    filter: ExportBookingsFilter,
    actor: Actor
  ): Promise<{ filename: string; csv: string; count: number }> {
    const now = new Date();

    let startDate: Date | undefined;
    let endDate: Date | undefined;

    switch (filter.range) {
      case "7d":
        startDate = startOfISTDay(subDays(now, 6));
        endDate = endOfISTDay(now);
        break;
      case "30d":
        startDate = startOfISTDay(subDays(now, 29));
        endDate = endOfISTDay(now);
        break;
      case "month":
        startDate = startOfISTMonth(now);
        endDate = endOfISTMonth(now);
        break;
      case "lastMonth": {
        const lastMonthRef = subMonths(now, 1);
        startDate = startOfISTMonth(lastMonthRef);
        endDate = endOfISTMonth(lastMonthRef);
        break;
      }
      case "currentFY": {
        const istNow = toIST(now);
        const currentYear = istNow.getFullYear();
        const currentMonth = istNow.getMonth(); // 0-indexed (3 is April)
        const fyStartYear = currentMonth >= 3 ? currentYear : currentYear - 1;
        startDate = fromISTInput(`${fyStartYear}-04-01T00:00:00`);
        endDate = fromISTInput(`${fyStartYear + 1}-03-31T23:59:59`);
        break;
      }
      case "custom":
        if (filter.from) startDate = startOfISTDay(fromISTInput(`${filter.from}T00:00:00`));
        if (filter.to) endDate = endOfISTDay(fromISTInput(`${filter.to}T23:59:59`));
        break;
      case "all":
      default:
        // No date bounds
        break;
    }

    const whereClause: Record<string, unknown> = {};

    if (filter.status && filter.status !== "ALL") {
      whereClause.status = filter.status;
    }

    if (startDate || endDate) {
      whereClause.checkInAt = {
        ...(startDate ? { gte: startDate } : {}),
        ...(endDate ? { lte: endDate } : {}),
      };
    }

    const bookings = await prisma.booking.findMany({
      where: whereClause,
      include: {
        room: { include: { type: true } },
        guests: { orderBy: { isPrimary: "desc" } },
        charges: true,
        payments: true,
        invoice: true,
      },
      orderBy: { checkInAt: "asc" },
    });

    const headers = [
      "Invoice No",
      "Invoice Date",
      "Booking Reference",
      "Booking Status",
      "Booking Source",
      "Primary Guest Name",
      "Mobile Number",
      "Arriving From",
      "Purpose of Visit",
      "Company Name",
      "Company GSTIN",
      "Room Number",
      "Room Type",
      "Check-In Date (IST)",
      "Check-Out Date (IST)",
      "Nights / Duration",
      "Nightly Rate (₹)",
      "Discount Applied (₹)",
      "Room Tariff Taxable (₹)",
      "Other Charges Taxable (₹)",
      "Total Taxable Amount (₹)",
      "CGST (₹)",
      "SGST (₹)",
      "Total Invoice Amount (₹)",
      "Advance Received (₹)",
      "Settlement Received (₹)",
      "Refunds Issued (₹)",
      "Net Collections (₹)",
      "Balance Due (₹)",
      "Payment Mode(s)",
      "Payment Status",
      "Created At (IST)",
    ];

    const rows: string[] = [];
    rows.push(headers.join(","));

    for (const b of bookings) {
      const primaryGuest = b.guests.find((g) => g.isPrimary) || b.guests[0];
      const inv = b.invoice;

      // Calculate stay duration in days/nights
      const inTime = b.actualCheckInAt || b.checkInAt;
      const outTime = b.actualCheckOutAt || b.checkOutAt;
      const stayDurationDays = Math.max(
        1,
        Math.ceil((outTime.getTime() - inTime.getTime()) / (1000 * 60 * 60 * 24))
      );

      // Financial breakdown
      const advancePaid = b.payments
        .filter((p) => p.kind === PaymentKind.ADVANCE)
        .reduce((sum, p) => sum + Number(p.amount), 0);

      const settlementPaid = b.payments
        .filter((p) => p.kind === PaymentKind.PAYMENT)
        .reduce((sum, p) => sum + Number(p.amount), 0);

      const refundsIssued = b.payments
        .filter((p) => p.kind === PaymentKind.REFUND)
        .reduce((sum, p) => sum + Number(p.amount), 0);

      const grossReceived = advancePaid + settlementPaid;
      const netCollections = grossReceived - refundsIssued;

      const totalBillAmount = inv ? Number(inv.billAmount) : Number(b.rateApplied) * stayDurationDays;
      const taxableAmount = inv ? Number(inv.taxableAmount) : totalBillAmount;
      const cgst = inv ? Number(inv.cgst) : 0;
      const sgst = inv ? Number(inv.sgst) : 0;
      const balanceDue = Math.max(0, totalBillAmount - netCollections);

      const uniquePaymentModes = Array.from(new Set(b.payments.map((p) => p.mode))).join(", ");

      let paymentStatus = "PENDING";
      if (b.status === BookingStatus.CANCELLED) {
        paymentStatus = refundsIssued > 0 ? "REFUNDED" : "CANCELLED";
      } else if (netCollections >= totalBillAmount && totalBillAmount > 0) {
        paymentStatus = "PAID";
      } else if (netCollections > 0) {
        paymentStatus = "PARTIAL";
      }

      const row = [
        escapeCsv(inv ? inv.displayNo : "UNINVOICED"),
        escapeCsv(inv ? formatIST(inv.issuedAt, "dd/MM/yyyy") : "—"),
        escapeCsv(b.reference),
        escapeCsv(b.status),
        escapeCsv(b.source),
        escapeCsv(primaryGuest?.name || "Unknown"),
        escapeCsv(primaryGuest?.mobile || ""),
        escapeCsv(b.arrivingFrom || ""),
        escapeCsv(b.purposeOfVisit || ""),
        escapeCsv(b.companyName || ""),
        escapeCsv(b.companyGstin || ""),
        escapeCsv(b.room.number),
        escapeCsv(b.room.type.name),
        escapeCsv(formatIST(inTime, "dd/MM/yyyy hh:mm a")),
        escapeCsv(formatIST(outTime, "dd/MM/yyyy hh:mm a")),
        escapeCsv(stayDurationDays),
        escapeCsv(Number(b.rateApplied).toFixed(2)),
        escapeCsv(Number(b.discount).toFixed(2)),
        escapeCsv(taxableAmount.toFixed(2)),
        escapeCsv(
          b.charges
            .filter((c) => c.isTaxable)
            .reduce((sum, c) => sum + Number(c.amount), 0)
            .toFixed(2)
        ),
        escapeCsv(taxableAmount.toFixed(2)),
        escapeCsv(cgst.toFixed(2)),
        escapeCsv(sgst.toFixed(2)),
        escapeCsv(totalBillAmount.toFixed(2)),
        escapeCsv(advancePaid.toFixed(2)),
        escapeCsv(settlementPaid.toFixed(2)),
        escapeCsv(refundsIssued.toFixed(2)),
        escapeCsv(netCollections.toFixed(2)),
        escapeCsv(balanceDue.toFixed(2)),
        escapeCsv(uniquePaymentModes || "—"),
        escapeCsv(paymentStatus),
        escapeCsv(formatIST(b.createdAt, "dd/MM/yyyy hh:mm a")),
      ];

      rows.push(row.join(","));
    }

    // Add UTF-8 BOM so Microsoft Excel renders Indian Rupee and UTF-8 characters cleanly
    const csvContent = "\uFEFF" + rows.join("\r\n");

    const dateStamp = formatIST(now, "yyyy-MM-dd-HHmm");
    const filename = `hotel-paul-accountant-bookings-${filter.range}-${dateStamp}.csv`;

    await prisma.auditLog.create({
      data: {
        actorId: actor.id,
        action: "data.export",
        entity: "Booking",
        entityId: "csv-export",
        metadata: {
          filter,
          rowCount: bookings.length,
          filename,
        },
      },
    });

    return {
      filename,
      csv: csvContent,
      count: bookings.length,
    };
  },

  /**
   * Dry-run analysis for backup import.
   * Compares the uploaded backup payload against the live database without writing anything.
   * Detects stay collisions, invoice number conflicts, and room number mismatches.
   */
  async dryRunBackupImport(
    rawBackup: unknown
  ): Promise<BackupDiffSummary> {
    // 1. Validate schema version and structure
    const parsed = backupDataSchema.safeParse(rawBackup);
    if (!parsed.success) {
      throw new AppError(
        "VALIDATION_ERROR",
        `Invalid backup file format: ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`
      );
    }

    const backupData = parsed.data;

    const conflicts: ConflictItem[] = [];

    // Query existing records in one efficient batch
    const [
      existingRoomTypes,
      existingRooms,
      existingBookings,
      existingInvoices,
      existingInventory,
      existingMaintenance,
      existingProblems,
    ] = await Promise.all([
      prisma.roomType.findMany(),
      prisma.room.findMany({ include: { type: true } }),
      prisma.booking.findMany({
        select: {
          id: true,
          reference: true,
          roomId: true,
          checkInAt: true,
          checkOutAt: true,
          status: true,
        },
      }),
      prisma.invoice.findMany({
        select: { id: true, number: true, displayNo: true, bookingId: true },
      }),
      prisma.inventoryItem.findMany({
        select: { id: true, name: true },
      }),
      prisma.roomMaintenance.findMany({
        select: { id: true },
      }),
      prisma.roomProblem.findMany({
        select: { id: true },
      }),
    ]);

    const existingRoomTypeNames = new Set(existingRoomTypes.map((rt) => rt.name.toLowerCase()));
    const existingRoomNumbers = new Map(existingRooms.map((r) => [r.number, r]));
    const existingBookingRefs = new Set(existingBookings.map((b) => b.reference));
    const existingInvoiceNumbers = new Map(existingInvoices.map((i) => [i.number, i]));
    const existingInvoiceDisplayNos = new Map(existingInvoices.map((i) => [i.displayNo, i]));
    const existingInventoryNames = new Set(
      existingInventory.map((i) => i.name.toLowerCase().trim())
    );
    const existingMaintenanceIds = new Set(existingMaintenance.map((m) => m.id));
    const existingProblemIds = new Set(existingProblems.map((p) => p.id));

    // Check Room Types
    let newRoomTypesCount = 0;
    let existingRoomTypesCount = 0;
    for (const rt of backupData.catalog.roomTypes) {
      if (existingRoomTypeNames.has(rt.name.toLowerCase())) {
        existingRoomTypesCount++;
      } else {
        newRoomTypesCount++;
      }
    }

    // Check Rooms
    let newRoomsCount = 0;
    let existingRoomsCount = 0;
    for (const r of backupData.catalog.rooms) {
      const match = existingRoomNumbers.get(r.number);
      if (match) {
        existingRoomsCount++;
      } else {
        newRoomsCount++;
      }
    }

    // Check Bookings, Stays, and Invoices
    let newBookingsCount = 0;
    let existingBookingsCount = 0;
    let newPaymentsCount = 0;
    let existingPaymentsCount = 0;
    let newInvoicesCount = 0;
    let existingInvoicesCount = 0;

    for (const b of backupData.bookings) {
      const isExistingBooking = existingBookingRefs.has(b.reference);
      if (isExistingBooking) {
        existingBookingsCount++;
        existingPaymentsCount += b.payments.length;
        if (b.invoice) existingInvoicesCount++;
        continue;
      }

      newBookingsCount++;
      newPaymentsCount += b.payments.length;
      if (b.invoice) newInvoicesCount++;

      // Conflict Check A: Overlapping active stays on the same room
      if (
        b.status !== BookingStatus.CANCELLED &&
        b.status !== BookingStatus.NO_SHOW
      ) {
        const bStart = new Date(b.checkInAt);
        const bEnd = new Date(b.checkOutAt);

        // Find matching room in existing DB by number
        const roomDef = backupData.catalog.rooms.find((rm) => rm.id === b.roomId);
        const targetRoomNumber = roomDef?.number;
        const liveRoom = targetRoomNumber ? existingRoomNumbers.get(targetRoomNumber) : null;

        if (liveRoom) {
          const conflictingStay = existingBookings.find(
            (eb) =>
              eb.roomId === liveRoom.id &&
              eb.status !== BookingStatus.CANCELLED &&
              eb.status !== BookingStatus.NO_SHOW &&
              eb.checkInAt < bEnd &&
              eb.checkOutAt > bStart
          );

          if (conflictingStay) {
            conflicts.push({
              type: "ROOM_STAY_OVERLAP",
              severity: "ERROR",
              entityId: b.id,
              reference: b.reference,
              description: `Booking ${b.reference} overlaps with existing stay ${conflictingStay.reference} in Room ${targetRoomNumber} (${formatIST(bStart, "dd MMM")} – ${formatIST(bEnd, "dd MMM")}).`,
            });
          }
        }
      }

      // Conflict Check B: Invoice Number collision with another booking
      if (b.invoice) {
        const invNumConflict = existingInvoiceNumbers.get(b.invoice.number);
        if (invNumConflict) {
          conflicts.push({
            type: "INVOICE_NUMBER_COLLISION",
            severity: "ERROR",
            entityId: b.invoice.id,
            reference: b.invoice.displayNo,
            description: `Invoice number ${b.invoice.number} (${b.invoice.displayNo}) is already issued in the system for another stay.`,
          });
        }

        const invDispConflict = existingInvoiceDisplayNos.get(b.invoice.displayNo);
        if (invDispConflict && !invNumConflict) {
          conflicts.push({
            type: "INVOICE_NUMBER_COLLISION",
            severity: "ERROR",
            entityId: b.invoice.id,
            reference: b.invoice.displayNo,
            description: `Invoice display number ${b.invoice.displayNo} is already in use.`,
          });
        }
      }
    }

    // Check Inventory Items
    let newInventoryCount = 0;
    let existingInventoryCount = 0;
    for (const item of backupData.inventory?.items || []) {
      if (existingInventoryNames.has(item.name.toLowerCase().trim())) {
        existingInventoryCount++;
      } else {
        newInventoryCount++;
      }
    }

    // Check Maintenance Records
    let newMaintenanceCount = 0;
    let existingMaintenanceCount = 0;
    for (const m of backupData.maintenance?.records || []) {
      if (existingMaintenanceIds.has(m.id)) {
        existingMaintenanceCount++;
      } else {
        newMaintenanceCount++;
      }
    }

    // Check Problems
    let newProblemsCount = 0;
    let existingProblemsCount = 0;
    for (const p of backupData.maintenance?.problems || []) {
      if (existingProblemIds.has(p.id)) {
        existingProblemsCount++;
      } else {
        newProblemsCount++;
      }
    }

    const hasErrors = conflicts.some((c) => c.severity === "ERROR");

    return {
      canProceed: !hasErrors,
      totalNewRecords:
        newRoomTypesCount +
        newRoomsCount +
        newBookingsCount +
        newPaymentsCount +
        newInvoicesCount +
        newInventoryCount +
        newMaintenanceCount +
        newProblemsCount,
      totalDuplicateRecords:
        existingRoomTypesCount +
        existingRoomsCount +
        existingBookingsCount +
        existingPaymentsCount +
        existingInvoicesCount +
        existingInventoryCount +
        existingMaintenanceCount +
        existingProblemsCount,
      conflicts,
      diffs: {
        roomTypes: { new: newRoomTypesCount, existing: existingRoomTypesCount },
        rooms: { new: newRoomsCount, existing: existingRoomsCount },
        bookings: { new: newBookingsCount, existing: existingBookingsCount },
        payments: { new: newPaymentsCount, existing: existingPaymentsCount },
        invoices: { new: newInvoicesCount, existing: existingInvoicesCount },
        inventoryItems: {
          new: newInventoryCount,
          existing: existingInventoryCount,
        },
        maintenance: {
          new: newMaintenanceCount,
          existing: existingMaintenanceCount,
        },
        problems: {
          new: newProblemsCount,
          existing: existingProblemsCount,
        },
      },
    };
  },

  /**
   * Executes backup import within a single atomic Prisma transaction.
   * Verifies dry-run first and refuses execution if any unresolvable error conflicts exist.
   */
  async executeBackupImport(
    rawBackup: unknown,
    actor: Actor
  ): Promise<{
    success: boolean;
    imported: {
      roomTypes: number;
      rooms: number;
      bookings: number;
      payments: number;
      invoices: number;
    };
  }> {
    const diff = await this.dryRunBackupImport(rawBackup);
    if (!diff.canProceed) {
      throw new AppError(
        "VALIDATION_ERROR",
        `Cannot restore backup due to ${diff.conflicts.length} blocking conflict(s). Review conflict report.`
      );
    }

    const backupData = rawBackup as BackupData;

    return await prisma.$transaction(
      async (tx) => {
        // 1. Room Types: Bulk fetch existing
        const roomTypeIdMap = new Map<string, string>();
        const existingRoomTypes = await tx.roomType.findMany();
        const roomTypeByName = new Map(existingRoomTypes.map((rt) => [rt.name, rt.id]));

        for (const rt of backupData.catalog.roomTypes) {
          const existingId = roomTypeByName.get(rt.name);
          if (existingId) {
            roomTypeIdMap.set(rt.id, existingId);
          } else {
            const created = await tx.roomType.create({ data: { name: rt.name } });
            roomTypeIdMap.set(rt.id, created.id);
            roomTypeByName.set(created.name, created.id);
          }
        }

        // 2. Rooms: Bulk fetch existing
        const roomIdMap = new Map<string, string>();
        const existingRooms = await tx.room.findMany();
        const roomByNumber = new Map(existingRooms.map((r) => [r.number, r.id]));

        for (const r of backupData.catalog.rooms) {
          const existingId = roomByNumber.get(r.number);
          if (existingId) {
            roomIdMap.set(r.id, existingId);
          } else {
            const targetTypeId = roomTypeIdMap.get(r.typeId) || r.typeId;
            const created = await tx.room.create({
              data: {
                number: r.number,
                typeId: targetTypeId,
                pricePerNight: r.pricePerNight,
                isActive: r.isActive,
              },
            });
            roomIdMap.set(r.id, created.id);
            roomByNumber.set(created.number, created.id);
          }
        }

        // 3. Bookings, Guests, Charges, Payments, Invoices
        let importedBookings = 0;
        let importedPayments = 0;
        let importedInvoices = 0;

        const existingBookings = await tx.booking.findMany({
          select: { reference: true },
        });
        const existingRefs = new Set(existingBookings.map((b) => b.reference));

        for (const b of backupData.bookings) {
          if (existingRefs.has(b.reference)) continue; // Skip identical duplicate

        const targetRoomId = roomIdMap.get(b.roomId) || b.roomId;

        const newBooking = await tx.booking.create({
          data: {
            reference: b.reference,
            groupBookingId: b.groupBookingId,
            isGroupMaster: b.isGroupMaster,
            roomId: targetRoomId,
            status: b.status,
            source: b.source,
            checkInAt: new Date(b.checkInAt),
            checkOutAt: new Date(b.checkOutAt),
            actualCheckInAt: b.actualCheckInAt ? new Date(b.actualCheckInAt) : null,
            actualCheckOutAt: b.actualCheckOutAt ? new Date(b.actualCheckOutAt) : null,
            arrivingFrom: b.arrivingFrom,
            purposeOfVisit: b.purposeOfVisit,
            companyName: b.companyName,
            companyGstin: b.companyGstin,
            companyAddress: b.companyAddress,
            rateApplied: b.rateApplied,
            discount: b.discount,
            gstPercentOverride: b.gstPercentOverride,
            createdById: actor.id,
            guests: {
              create: b.guests.map((g) => ({
                isPrimary: g.isPrimary,
                name: g.name,
                fatherName: g.fatherName,
                age: g.age,
                sex: g.sex,
                mobile: g.mobile,
                allocatedRoomId: g.allocatedRoomId ? (roomIdMap.get(g.allocatedRoomId) || null) : null,
              })),
            },
            charges: {
              create: b.charges.map((c) => ({
                description: c.description,
                amount: c.amount,
                isTaxable: c.isTaxable,
                createdById: actor.id,
              })),
            },
            payments: {
              create: b.payments.map((p) => ({
                kind: p.kind,
                mode: p.mode,
                amount: p.amount,
                note: p.note,
                receivedAt: new Date(p.receivedAt),
                createdById: actor.id,
              })),
            },
          },
        });

        importedBookings++;
        importedPayments += b.payments.length;

        // Create Invoice if present
        if (b.invoice) {
          await tx.invoice.create({
            data: {
              number: b.invoice.number,
              displayNo: b.invoice.displayNo,
              bookingId: newBooking.id,
              status: b.invoice.status,
              issuedAt: new Date(b.invoice.issuedAt),
              issuedById: actor.id,
              taxableAmount: b.invoice.taxableAmount,
              cgst: b.invoice.cgst,
              sgst: b.invoice.sgst,
              billAmount: b.invoice.billAmount,
              advancePaid: b.invoice.advancePaid,
              balance: b.invoice.balance,
              snapshot: b.invoice.snapshot,
            },
          });
          importedInvoices++;
        }
      }

      // 4. Inventory items
      let importedInventory = 0;
      const existingInventory = await tx.inventoryItem.findMany();
      const inventoryByName = new Map(existingInventory.map((i) => [i.name, i.id]));
      for (const item of backupData.inventory?.items || []) {
        if (!inventoryByName.has(item.name)) {
          const created = await tx.inventoryItem.create({
            data: {
              name: item.name,
              unit: item.unit,
              reorderLevel: item.reorderLevel,
              qtyStore: item.qtyStore,
              qtyRooms: item.qtyRooms,
              qtyLaundry: item.qtyLaundry,
              qtyDamaged: item.qtyDamaged,
              qtyDiscontinued: item.qtyDiscontinued,
              isActive: item.isActive,
            },
          });
          inventoryByName.set(created.name, created.id);
          importedInventory++;
        }
      }

      // 5. Room Problems
      let importedProblems = 0;
      const existingProblems = await tx.roomProblem.findMany();
      const existingProbIds = new Set(existingProblems.map((p) => p.id));
      for (const prob of backupData.maintenance?.problems || []) {
        const targetRoomId = roomIdMap.get(prob.roomId) || prob.roomId;
        if (!existingProbIds.has(prob.id)) {
          await tx.roomProblem.create({
            data: {
              id: prob.id,
              roomId: targetRoomId,
              description: prob.description,
              severity: prob.severity,
              status: prob.status,
              reportedById: actor.id,
              reportedAt: new Date(prob.reportedAt),
              fixedById: prob.fixedById ? actor.id : null,
              fixedAt: prob.fixedAt ? new Date(prob.fixedAt) : null,
            },
          });
          importedProblems++;
        }
      }

      // 6. Room Maintenance
      let importedMaintenance = 0;
      const existingMaint = await tx.roomMaintenance.findMany();
      const existingMaintIds = new Set(existingMaint.map((m) => m.id));
      for (const maint of backupData.maintenance?.records || []) {
        const targetRoomId = roomIdMap.get(maint.roomId) || maint.roomId;
        if (!existingMaintIds.has(maint.id)) {
          await tx.roomMaintenance.create({
            data: {
              id: maint.id,
              roomId: targetRoomId,
              startsAt: new Date(maint.startsAt),
              endsAt: new Date(maint.endsAt),
              reason: maint.reason,
              createdById: actor.id,
              createdAt: new Date(maint.createdAt),
            },
          });
          importedMaintenance++;
        }
      }

      // Record audit log entry
      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          action: "data.import",
          entity: "System",
          entityId: "backup-restore",
          metadata: {
            importedBookings,
            importedPayments,
            importedInvoices,
            importedInventory,
            importedMaintenance,
            importedProblems,
            timestamp: new Date().toISOString(),
          },
        },
      });

      return {
        success: true,
        imported: {
          roomTypes: diff.diffs.roomTypes.new,
          rooms: diff.diffs.rooms.new,
          bookings: importedBookings,
          payments: importedPayments,
          invoices: importedInvoices,
          inventory: importedInventory,
          maintenance: importedMaintenance,
          problems: importedProblems,
        },
      };
    }, { maxWait: 10000, timeout: 60000 });
  },
};
