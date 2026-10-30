import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/server/auth/permissions";
import { ROLES } from "@/lib/constants";
import { calendarService } from "@/server/services/calendar.service";
import { z } from "zod";

const calendarQuerySchema = z.object({
  start: z.string().datetime({ message: "Invalid start timestamp" }),
  end: z.string().datetime({ message: "Invalid end timestamp" }),
});

export async function GET(request: NextRequest) {
  try {
    await requireRole([ROLES.OWNER, ROLES.RECEPTIONIST]);

    const { searchParams } = new URL(request.url);
    const parsed = calendarQuerySchema.safeParse({
      start: searchParams.get("start"),
      end: searchParams.get("end"),
    });

    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: parsed.error.issues[0]?.message || "Invalid query parameters" },
        { status: 400 }
      );
    }

    const startUtc = new Date(parsed.data.start);
    const endUtc = new Date(parsed.data.end);

    if (startUtc >= endUtc) {
      return NextResponse.json(
        { ok: false, error: "start timestamp must be before end timestamp" },
        { status: 400 }
      );
    }

    const data = await calendarService.getTimelineData(startUtc, endUtc);

    return NextResponse.json({ ok: true, data });
  } catch (err: unknown) {
    console.error("Calendar GET error:", err);
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
