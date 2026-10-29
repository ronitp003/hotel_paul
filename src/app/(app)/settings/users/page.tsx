import { StaffList } from "@/features/users/components/staff-list";
import { requireRole } from "@/server/auth/permissions";
import { ROLES } from "@/lib/constants";
import { userService } from "@/server/services/user.service";

export default async function UsersSettingsPage() {
  const actor = await requireRole([ROLES.OWNER]);
  const staff = await userService.listStaff();

  return (
    <div className="space-y-4">
      <StaffList initialStaff={staff} currentUserId={actor.id} />
    </div>
  );
}
