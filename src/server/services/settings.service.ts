import "server-only";
import { prisma } from "@/server/db";
import { AppError } from "@/lib/errors";
import { Decimal } from "decimal.js";
import {
  type HotelDetailsInput,
  type BillingSettingsInput,
  type InvoiceSettingsInput,
  type GstSlabItemInput,
} from "@/features/settings/schemas";
import { validateGstSlabsContinuity } from "./billing.service";

export interface Actor {
  id: string;
  name: string;
  email: string;
  role: string;
}

export const settingsService = {
  /**
   * Fetches the current settings, upserting id=1 if not present.
   */
  async getSettings() {
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
        graceMinutes: 0, // TODO(confirm): accountant / owner late-checkout grace period
        roundBillToRupee: false, // TODO(confirm): accountant bill rounding rule
        gstOnOtherCharges: false, // TODO(confirm): accountant GST on food/laundry
      },
    });

    const invoiceSeq = await prisma.invoiceSequence.upsert({
      where: { id: 1 },
      update: {},
      create: {
        id: 1,
        nextNo: 1001,
      },
    });

    const gstSlabs = await prisma.gstSlab.findMany({
      orderBy: { minRate: "asc" },
    });

    return {
      hotel,
      invoiceSequence: invoiceSeq,
      gstSlabs: gstSlabs.map((s) => ({
        id: s.id,
        minRate: Number(s.minRate),
        maxRate: s.maxRate !== null ? Number(s.maxRate) : null,
        percent: Number(s.percent),
        isActive: s.isActive,
      })),
    };
  },

  /**
   * Updates basic hotel details (name, address, phone, GSTIN).
   */
  async updateHotelDetails(actor: Actor, data: HotelDetailsInput) {
    return await prisma.$transaction(async (tx) => {
      const before = await tx.hotelSettings.findUnique({ where: { id: 1 } });

      const updated = await tx.hotelSettings.upsert({
        where: { id: 1 },
        update: {
          name: data.name.trim(),
          address: data.address.trim(),
          phone: data.phone.trim(),
          gstin: data.gstin.trim().toUpperCase(),
        },
        create: {
          id: 1,
          name: data.name.trim(),
          address: data.address.trim(),
          phone: data.phone.trim(),
          gstin: data.gstin.trim().toUpperCase(),
          invoicePrefix: "HP-",
          invoiceNotes: "",
          graceMinutes: 0,
          roundBillToRupee: false,
          gstOnOtherCharges: false,
        },
      });

      // Audit log with before/after diff
      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          action: "settings.updateHotelDetails",
          entity: "HotelSettings",
          entityId: "1",
          metadata: {
            before: before
              ? {
                  name: before.name,
                  address: before.address,
                  phone: before.phone,
                  gstin: before.gstin,
                }
              : null,
            after: {
              name: updated.name,
              address: updated.address,
              phone: updated.phone,
              gstin: updated.gstin,
            },
          },
        },
      });

      return updated;
    });
  },

  /**
   * Updates billing policies (grace period, rounding, extra charges GST).
   */
  async updateBillingSettings(actor: Actor, data: BillingSettingsInput) {
    return await prisma.$transaction(async (tx) => {
      const before = await tx.hotelSettings.findUnique({ where: { id: 1 } });

      const updated = await tx.hotelSettings.update({
        where: { id: 1 },
        data: {
          graceMinutes: data.graceMinutes, // TODO(confirm): accountant
          roundBillToRupee: data.roundBillToRupee, // TODO(confirm): accountant
          gstOnOtherCharges: data.gstOnOtherCharges, // TODO(confirm): accountant
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          action: "settings.updateBillingSettings",
          entity: "HotelSettings",
          entityId: "1",
          metadata: {
            before: before
              ? {
                  graceMinutes: before.graceMinutes,
                  roundBillToRupee: before.roundBillToRupee,
                  gstOnOtherCharges: before.gstOnOtherCharges,
                }
              : null,
            after: {
              graceMinutes: updated.graceMinutes,
              roundBillToRupee: updated.roundBillToRupee,
              gstOnOtherCharges: updated.gstOnOtherCharges,
            },
          },
        },
      });

      return updated;
    });
  },

  /**
   * Updates invoice series configuration and next sequential number.
   * Locked with SELECT ... FOR UPDATE.
   */
  async updateInvoiceSettings(actor: Actor, data: InvoiceSettingsInput) {
    return await prisma.$transaction(async (tx) => {
      // Lock InvoiceSequence row FOR UPDATE
      await tx.$executeRaw`
        SELECT id FROM "InvoiceSequence" WHERE id = 1 FOR UPDATE
      `;

      // Check highest issued invoice number to disallow counter regression
      const highestInvoice = await tx.invoice.findFirst({
        where: { status: "ISSUED" },
        orderBy: { number: "desc" },
        select: { number: true },
      });

      const minAllowed = (highestInvoice?.number ?? 0) + 1;
      if (data.nextNo < minAllowed) {
        throw new AppError(
          "VALIDATION_ERROR",
          `Next invoice number cannot be lower than ${minAllowed} (highest issued invoice is #${highestInvoice?.number ?? 0}).`
        );
      }

      const beforeHotel = await tx.hotelSettings.findUnique({ where: { id: 1 } });
      const beforeSeq = await tx.invoiceSequence.findUnique({ where: { id: 1 } });

      const updatedHotel = await tx.hotelSettings.update({
        where: { id: 1 },
        data: {
          invoicePrefix: data.invoicePrefix.trim(),
          invoiceNotes: data.invoiceNotes.trim(),
        },
      });

      const updatedSeq = await tx.invoiceSequence.update({
        where: { id: 1 },
        data: {
          nextNo: data.nextNo,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          action: "settings.updateInvoiceSettings",
          entity: "InvoiceSequence",
          entityId: "1",
          metadata: {
            before: {
              invoicePrefix: beforeHotel?.invoicePrefix,
              invoiceNotes: beforeHotel?.invoiceNotes,
              nextNo: beforeSeq?.nextNo,
            },
            after: {
              invoicePrefix: updatedHotel.invoicePrefix,
              invoiceNotes: updatedHotel.invoiceNotes,
              nextNo: updatedSeq.nextNo,
            },
          },
        },
      });

      return {
        hotel: updatedHotel,
        invoiceSequence: updatedSeq,
      };
    });
  },

  /**
   * Creates a new GST slab and validates continuity.
   */
  async createGstSlab(actor: Actor, data: GstSlabItemInput) {
    return await prisma.$transaction(async (tx) => {
      const existing = await tx.gstSlab.findMany({
        orderBy: { minRate: "asc" },
      });

      const candidateList = [
        ...existing.map((s) => ({
          minRate: s.minRate,
          maxRate: s.maxRate,
          percent: s.percent,
          isActive: s.isActive,
        })),
        {
          minRate: new Decimal(data.minRate),
          maxRate: data.maxRate !== null && data.maxRate !== undefined ? new Decimal(data.maxRate) : null,
          percent: new Decimal(data.percent),
          isActive: data.isActive ?? true,
        },
      ];

      validateGstSlabsContinuity(candidateList);

      const created = await tx.gstSlab.create({
        data: {
          minRate: data.minRate,
          maxRate: data.maxRate ?? null,
          percent: data.percent,
          isActive: data.isActive ?? true,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          action: "gstSlab.create",
          entity: "GstSlab",
          entityId: created.id,
          metadata: {
            after: {
              minRate: created.minRate,
              maxRate: created.maxRate,
              percent: created.percent,
              isActive: created.isActive,
            },
          },
        },
      });

      return created;
    });
  },

  /**
   * Updates an existing GST slab and validates continuity.
   */
  async updateGstSlab(actor: Actor, id: string, data: GstSlabItemInput) {
    return await prisma.$transaction(async (tx) => {
      const existing = await tx.gstSlab.findUnique({ where: { id } });
      if (!existing) {
        throw new AppError("VALIDATION_ERROR", "GST slab not found.");
      }

      const all = await tx.gstSlab.findMany({ orderBy: { minRate: "asc" } });
      const candidateList = all.map((s) => {
        if (s.id === id) {
          return {
            minRate: new Decimal(data.minRate),
            maxRate: data.maxRate !== null && data.maxRate !== undefined ? new Decimal(data.maxRate) : null,
            percent: new Decimal(data.percent),
            isActive: data.isActive ?? true,
          };
        }
        return {
          minRate: s.minRate,
          maxRate: s.maxRate,
          percent: s.percent,
          isActive: s.isActive,
        };
      });

      validateGstSlabsContinuity(candidateList);

      const updated = await tx.gstSlab.update({
        where: { id },
        data: {
          minRate: data.minRate,
          maxRate: data.maxRate ?? null,
          percent: data.percent,
          isActive: data.isActive ?? true,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          action: "gstSlab.update",
          entity: "GstSlab",
          entityId: id,
          metadata: {
            before: {
              minRate: existing.minRate,
              maxRate: existing.maxRate,
              percent: existing.percent,
              isActive: existing.isActive,
            },
            after: {
              minRate: updated.minRate,
              maxRate: updated.maxRate,
              percent: updated.percent,
              isActive: updated.isActive,
            },
          },
        },
      });

      return updated;
    });
  },

  /**
   * Toggles active state of a GST slab.
   */
  async toggleGstSlab(actor: Actor, id: string, isActive: boolean) {
    return await prisma.$transaction(async (tx) => {
      const existing = await tx.gstSlab.findUnique({ where: { id } });
      if (!existing) {
        throw new AppError("VALIDATION_ERROR", "GST slab not found.");
      }

      const all = await tx.gstSlab.findMany({ orderBy: { minRate: "asc" } });
      const candidateList = all.map((s) => ({
        minRate: s.minRate,
        maxRate: s.maxRate,
        percent: s.percent,
        isActive: s.id === id ? isActive : s.isActive,
      }));

      validateGstSlabsContinuity(candidateList);

      const updated = await tx.gstSlab.update({
        where: { id },
        data: { isActive },
      });

      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          action: isActive ? "gstSlab.activate" : "gstSlab.deactivate",
          entity: "GstSlab",
          entityId: id,
          metadata: {
            before: { isActive: existing.isActive },
            after: { isActive: updated.isActive },
          },
        },
      });

      return updated;
    });
  },

  /**
   * Deletes a GST slab, ensuring remaining active slabs remain continuous.
   */
  async deleteGstSlab(actor: Actor, id: string) {
    return await prisma.$transaction(async (tx) => {
      const existing = await tx.gstSlab.findUnique({ where: { id } });
      if (!existing) {
        throw new AppError("VALIDATION_ERROR", "GST slab not found.");
      }

      const all = await tx.gstSlab.findMany({ orderBy: { minRate: "asc" } });
      const remaining = all
        .filter((s) => s.id !== id)
        .map((s) => ({
          minRate: s.minRate,
          maxRate: s.maxRate,
          percent: s.percent,
          isActive: s.isActive,
        }));

      validateGstSlabsContinuity(remaining);

      await tx.gstSlab.delete({ where: { id } });

      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          action: "gstSlab.delete",
          entity: "GstSlab",
          entityId: id,
          metadata: {
            before: {
              minRate: existing.minRate,
              maxRate: existing.maxRate,
              percent: existing.percent,
              isActive: existing.isActive,
            },
          },
        },
      });

      return { id };
    });
  },
};
