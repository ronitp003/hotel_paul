import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/server/auth/permissions";
import { ROLES } from "@/lib/constants";
import { backupService } from "@/server/services/backup.service";
import { exportBookingsFilterSchema } from "@/features/settings/data-schemas";
import { AppError } from "@/lib/errors";

export async function GET(request: NextRequest) {
  try {
    const actor = await requireRole([ROLES.OWNER]);

    const { searchParams } = new URL(request.url);
    const range = searchParams.get("range") || "all";
    const from = searchParams.get("from") || undefined;
    const to = searchParams.get("to") || undefined;
    const status = searchParams.get("status") || "ALL";

    const parsedFilter = exportBookingsFilterSchema.safeParse({
      range,
      from,
      to,
      status,
    });

    if (!parsedFilter.success) {
      return NextResponse.json(
        {
          ok: false,
          error: "Invalid export filter parameters",
          code: "VALIDATION_ERROR",
        },
        { status: 400 }
      );
    }

    const result = await backupService.generateBookingsCsv(
      parsedFilter.data,
      actor
    );

    return new Response(result.csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${result.filename}"`,
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
  } catch (error: unknown) {
    if (error instanceof AppError) {
      const status =
        error.code === "UNAUTHORIZED"
          ? 401
          : error.code === "FORBIDDEN"
          ? 403
          : 400;
      return NextResponse.json(
        { ok: false, error: error.message, code: error.code },
        { status }
      );
    }

    console.error("Failed to export bookings CSV:", error);
    return NextResponse.json(
      { ok: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
