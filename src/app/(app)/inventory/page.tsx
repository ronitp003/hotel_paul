import { Metadata } from "next";
import { requireRole } from "@/server/auth/permissions";
import { ROLES } from "@/lib/constants";
import { PageHeader } from "@/components/layout/page-header";
import { inventoryService } from "@/server/services/inventory.service";
import { InventoryManager } from "@/features/inventory/components/inventory-manager";

export const metadata: Metadata = {
  title: "Inventory | Hotel Paul",
  description: "Track and manage hotel linen, room supplies, laundry cycles, and stock reorders.",
};

export default async function InventoryPage() {
  await requireRole([ROLES.OWNER, ROLES.RECEPTIONIST]);

  const [items, summary] = await Promise.all([
    inventoryService.listItems({ includeInactive: true }),
    inventoryService.getInventorySummary(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inventory"
        description="Track hotel linen, amenities, and room supplies across store, guest rooms, laundry, and scrap."
      />

      <InventoryManager initialItems={items} summary={summary} />
    </div>
  );
}
