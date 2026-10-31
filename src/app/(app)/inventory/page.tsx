import { Metadata } from "next";
import { requireRole } from "@/server/auth/permissions";
import { ROLES } from "@/lib/constants";
import { PageHeader } from "@/components/layout/page-header";
import { inventoryService } from "@/server/services/inventory.service";
import { InventoryManager } from "@/features/inventory/components/inventory-manager";

export const metadata: Metadata = {
  title: "Inventory | Hotel Paul",
  description: "Track and manage hotel inventory, available stock, room usage, and supplies.",
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
        description="Monitor available stock, track guest room usage, record damaged items, and manage hotel supplies."
      />

      <InventoryManager initialItems={items} summary={summary} />
    </div>
  );
}
