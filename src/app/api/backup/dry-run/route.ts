import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/server/auth/permissions";
import { ROLES } from "@/lib/constants";
import { backupService } from "@/server/services/backup.service";
import { AppError } from "@/lib/errors";

export async function POST(request: NextRequest) {
  try {
    await requireRole([ROLES.OWNER]);

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        {
          ok: false,
          error: "Invalid JSON payload in request body",
          code: "VALIDATION_ERROR",
        },
        { status: 400 }
      );
    }

    const diffSummary = await backupService.dryRunBackupImport(body);

    return NextResponse.json({
      ok: true,
      data: diffSummary,
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

    console.error("Backup dry-run failed:", error);
    return NextResponse.json(
      { ok: false, error: "Internal server error during backup dry-run" },
      { status: 500 }
    );
  }
}
