"use client";

import { useQuery } from "@tanstack/react-query";
import type { CalendarTimelineData } from "@/server/services/calendar.service";

interface UseCalendarParams {
  startUtc: string;
  endUtc: string;
  enabled?: boolean;
}

export function useCalendarData({ startUtc, endUtc, enabled = true }: UseCalendarParams) {
  return useQuery<CalendarTimelineData, Error>({
    queryKey: ["calendar-timeline", startUtc, endUtc],
    queryFn: async () => {
      const params = new URLSearchParams({
        start: startUtc,
        end: endUtc,
      });

      const res = await fetch(`/api/calendar?${params.toString()}`);
      if (!res.ok) {
        const errorJson = await res.json().catch(() => ({}));
        throw new Error(errorJson.error || "Failed to load calendar data");
      }

      const json = await res.json();
      if (!json.ok) {
        throw new Error(json.error || "Failed to load calendar data");
      }

      return json.data as CalendarTimelineData;
    },
    enabled: Boolean(startUtc && endUtc && enabled),
    refetchInterval: 30000, // Background refresh every 30 seconds
  });
}
