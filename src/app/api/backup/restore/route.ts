import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/server/auth/permissions";
import { ROLES } from "@/lib/constants";
import { backupService } from "@/server/services/backup.service";
import { AppError } from "@/lib/errors";

export async function POST(request: NextRequest) {
  try {
    const actor = await requireRole([ROLES.OWNER]);

    let body: { backupData?: unknown; confirmed?: boolean };
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

    if (!body || !body.backupData) {
      return NextResponse.json(
        {
          ok: false,
          error: "Missing backupData in request body",
          code: "VALIDATION_ERROR",
        },
        { status: 400 }
      );
    }

    if (body.confirmed !== true) {
      return NextResponse.json(
        {
          ok: false,
          error: "Restore execution requires explicit confirmation flag (confirmed: true)",
          code: "VALIDATION_ERROR",
        },
        { status: 400 }
      );
    }

    const result = await backupService.executeBackupImport(
      body.backupData,
      actor
    );

    return NextResponse.json({
      ok: true,
      data: result,
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

    console.error("Backup restore failed:", error);
    return NextResponse.json(
      { ok: false, error: "Internal server error during backup restore" },
      { status: 500 }
    );
  }
}
