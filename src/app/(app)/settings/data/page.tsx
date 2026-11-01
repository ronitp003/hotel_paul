import { requireRole } from "@/server/auth/permissions";
import { ROLES } from "@/lib/constants";
import { DataManagementView } from "@/features/settings/components/data-management-view";

export const metadata = {
  title: "Data Management & Backups | Hotel Desk",
  description: "Owner-level system JSON backup, accountant CSV export, and safe transactional database restore.",
};

export default async function SettingsDataPage() {
  await requireRole([ROLES.OWNER]);

  return (
    <div className="space-y-6">
      <DataManagementView />
    </div>
  );
}
