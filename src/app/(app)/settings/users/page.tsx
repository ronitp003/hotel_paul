import { PageHeader } from "@/components/layout/page-header";
import { StaffList } from "@/features/users/components/staff-list";
import { requireRole } from "@/server/auth/permissions";
import { ROLES } from "@/lib/constants";
import { userService } from "@/server/services/user.service";

export default async function UsersSettingsPage() {
  const actor = await requireRole([ROLES.OWNER]);
  const staff = await userService.listStaff();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Staff & User Management"
        description="Owner controls: Manage employee credentials, role permissions, and access status."
      />

      <StaffList initialStaff={staff} currentUserId={actor.id} />
    </div>
  );
}
