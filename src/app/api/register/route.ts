import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/server/auth/permissions";
import { ROLES } from "@/lib/constants";
import { registerService } from "@/server/services/register.service";
import { AppError } from "@/lib/errors";

export async function GET(request: NextRequest) {
  try {
    await requireRole([ROLES.OWNER]);

    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date") || undefined;
    const search = searchParams.get("search") || undefined;
    const roomId = searchParams.get("roomId") || undefined;

    const data = await registerService.getCheckInRegister({
      date,
      search,
      roomId,
    });

    return NextResponse.json({ ok: true, data });
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

    console.error("Failed to load check-in register:", error);
    return NextResponse.json(
      { ok: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
