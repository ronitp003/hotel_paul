"use client";

import { useSearchParams } from "next/navigation";
import { CheckInRegisterTab } from "./checkin-register-tab";
import { AnalyticsTab } from "@/features/analytics/components/analytics-tab";
import type {
  RegisterDayData,
  AnalyticsData,
} from "@/features/register/schemas";

interface RegisterViewProps {
  initialRegister: RegisterDayData;
  rooms: Array<{ id: string; number: string; typeName: string }>;
  initialAnalytics: AnalyticsData;
  defaultTab?: string;
}

export function RegisterView({
  initialRegister,
  rooms,
  initialAnalytics,
  defaultTab = "register",
}: RegisterViewProps) {
  const searchParams = useSearchParams();
  const tabFromUrl = searchParams.get("tab");
  const activeTab =
    tabFromUrl === "analytics"
      ? "analytics"
      : tabFromUrl === "register"
      ? "register"
      : defaultTab;

  if (activeTab === "analytics") {
    return <AnalyticsTab initialData={initialAnalytics} />;
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          Check-in Register
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Official day-by-day guest register with primary and accompanying occupant records.
        </p>
      </div>

      <CheckInRegisterTab initialData={initialRegister} rooms={rooms} />
    </div>
  );
}
