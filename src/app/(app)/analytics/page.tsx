import { redirect } from "next/navigation";
import { requireRole } from "@/server/auth/permissions";
import { ROLES } from "@/lib/constants";

export default async function AnalyticsPage() {
  await requireRole([ROLES.OWNER]);
  redirect("/register?tab=analytics");
}
