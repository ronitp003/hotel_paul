import { requireRole } from "@/server/auth/permissions";
import { ROLES } from "@/lib/constants";
import { registerService } from "@/server/services/register.service";
import { RegisterView } from "@/features/register/components/register-view";

interface RegisterPageProps {
  searchParams: Promise<{
    tab?: string;
    date?: string;
  }>;
}

export default async function RegisterPage({
  searchParams,
}: RegisterPageProps) {
  // Guard page for OWNER only per user requirements
  await requireRole([ROLES.OWNER]);

  const params = await searchParams;
  const targetDate = params.date || undefined;
  const defaultTab = params.tab === "analytics" ? "analytics" : "register";

  const [{ register, rooms }, analytics] = await Promise.all([
    registerService.getCheckInRegister({ date: targetDate }),
    registerService.getAnalytics({ range: "7d" }),
  ]);

  return (
    <RegisterView
      initialRegister={register}
      rooms={rooms}
      initialAnalytics={analytics}
      defaultTab={defaultTab}
    />
  );
}
