import { NextResponse } from "next/server";
import { requireSession } from "@/server/auth/session";
import { dashboardService } from "@/server/services/dashboard.service";

export async function GET() {
  try {
    await requireSession();
    const data = await dashboardService.getDashboardSummary();
    return NextResponse.json(data);
  } catch (error) {
    console.error("GET /api/dashboard error:", error);
    return NextResponse.json(
      { error: "Failed to fetch dashboard data" },
      { status: 500 }
    );
  }
}
