import { requireRole } from "@/server/auth/permissions";
import { ROLES } from "@/lib/constants";
import { dashboardService } from "@/server/services/dashboard.service";
import { DashboardView } from "@/features/dashboard/components/dashboard-view";

export const metadata = {
  title: "Dashboard | Hotel Paul",
  description: "Front desk property operations, room occupancy, guest flows, and revenue summary.",
};

export default async function DashboardPage() {
  const actor = await requireRole([ROLES.OWNER, ROLES.RECEPTIONIST]);
  const summary = await dashboardService.getDashboardSummary(actor.role);

  return <DashboardView data={summary} userRole={actor.role} />;
}
