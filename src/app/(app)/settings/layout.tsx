import { requireRole } from "@/server/auth/permissions";
import { ROLES } from "@/lib/constants";
import { redirect } from "next/navigation";
import { AppError } from "@/lib/errors";
import { SettingsNav } from "@/features/settings/components/settings-nav";
import { PageHeader } from "@/components/layout/page-header";

export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  try {
    await requireRole([ROLES.OWNER]);
  } catch (err) {
    if (err instanceof AppError && err.code === "FORBIDDEN") {
      redirect("/");
    }
    redirect("/login");
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings & Administration"
        description="Owner controls: Property details, GST rate tiers, invoicing rules, room types, and staff."
      />
      <SettingsNav />
      {children}
    </div>
  );
}
