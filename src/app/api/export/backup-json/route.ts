import { NextResponse } from "next/server";
import { requireRole } from "@/server/auth/permissions";
import { ROLES } from "@/lib/constants";
import { backupService } from "@/server/services/backup.service";
import { formatIST } from "@/lib/datetime";
import { AppError } from "@/lib/errors";

export async function GET() {
  try {
    const actor = await requireRole([ROLES.OWNER]);

    const backupData = await backupService.generateFullBackup(actor);
    const jsonString = JSON.stringify(backupData, null, 2);

    const timestamp = formatIST(new Date(), "yyyy-MM-dd-HHmm");
    const filename = `hotel-paul-backup-v1-${timestamp}.json`;

    return new Response(jsonString, {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
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

    console.error("Failed to generate backup JSON:", error);
    return NextResponse.json(
      { ok: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
