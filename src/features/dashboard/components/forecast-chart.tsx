"use client";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from "recharts";
import type { ForecastDay } from "@/features/dashboard/schemas";
import { CalendarIcon, RoomIcon } from "@/lib/icons";

interface ForecastChartProps {
  data: ForecastDay[];
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    name: string;
    value: number;
    color: string;
    dataKey: string;
  }>;
  label?: string;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;

  const booked = payload.find((p) => p.dataKey === "booked")?.value || 0;
  const maintenance =
    payload.find((p) => p.dataKey === "maintenance")?.value || 0;
  const available = payload.find((p) => p.dataKey === "available")?.value || 0;
  const total = booked + maintenance + available;
  const occupancyPercent = total > 0 ? Math.round((booked / total) * 100) : 0;

  return (
    <div className="rounded-xl border border-border/80 bg-popover/95 backdrop-blur-md p-3.5 shadow-xl text-xs space-y-2 min-w-[200px]">
      <div className="flex items-center justify-between border-b border-border/60 pb-1.5 font-semibold text-foreground">
        <span>{label}</span>
        <Badge
          variant="outline"
          className="bg-primary/10 text-primary border-primary/20 text-[10px] font-bold"
        >
          {occupancyPercent}% Booked
        </Badge>
      </div>

      <div className="space-y-1.5 font-mono">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <span className="size-2.5 rounded-sm bg-blue-500 inline-block" />
            Booked / Occupied:
          </span>
          <span className="font-bold text-foreground">{booked} rooms</span>
        </div>

        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <span className="size-2.5 rounded-sm bg-amber-500 inline-block" />
            Under Maintenance:
          </span>
          <span className="font-bold text-foreground">{maintenance} rooms</span>
        </div>

        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <span className="size-2.5 rounded-sm bg-emerald-500 inline-block" />
            Available for Sale:
          </span>
          <span className="font-bold text-emerald-600 dark:text-emerald-400">
            {available} rooms
          </span>
        </div>

        <div className="flex items-center justify-between pt-1 border-t border-border/50 text-muted-foreground text-[11px]">
          <span>Total Capacity:</span>
          <span>{total} rooms</span>
        </div>
      </div>
    </div>
  );
}

export function ForecastChart({ data }: ForecastChartProps) {
  const avgOccupancy =
    data.length > 0
      ? Math.round(
          data.reduce((acc, d) => acc + d.occupancyPercent, 0) / data.length
        )
      : 0;

  return (
    <Card className="p-4 sm:p-5 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/50 pb-3">
        <div>
          <h3 className="text-base font-bold text-foreground flex items-center gap-2">
            <CalendarIcon className="size-4 text-primary" />
            7-Day Room Occupancy Forecast
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Projected room bookings, scheduled maintenance, and unsold availability.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="text-right text-xs">
            <span className="text-muted-foreground block text-[11px]">
              Avg. 7-Day Occupancy
            </span>
            <span className="font-mono font-bold text-sm text-foreground">
              {avgOccupancy}%
            </span>
          </div>
          <Badge
            variant="outline"
            className="bg-primary/10 text-primary border-primary/20 text-xs px-2.5 py-1 font-semibold"
          >
            <RoomIcon className="size-3 mr-1" />
            {data[0]?.totalRooms || 0} Rooms Total
          </Badge>
        </div>
      </div>

      <div className="h-[260px] sm:h-[300px] w-full pt-2">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              className="stroke-border/40"
            />
            <XAxis
              dataKey="dayOfWeek"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              allowDecimals={false}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              verticalAlign="top"
              align="right"
              iconType="circle"
              wrapperStyle={{ paddingBottom: "12px", fontSize: "12px" }}
              formatter={(value) => {
                if (value === "booked") return "Booked";
                if (value === "maintenance") return "Maintenance";
                if (value === "available") return "Available";
                return value;
              }}
            />
            <Bar
              dataKey="booked"
              name="booked"
              stackId="occupancy"
              fill="#3b82f6"
              radius={[0, 0, 0, 0]}
            />
            <Bar
              dataKey="maintenance"
              name="maintenance"
              stackId="occupancy"
              fill="#f59e0b"
              radius={[0, 0, 0, 0]}
            />
            <Bar
              dataKey="available"
              name="available"
              stackId="occupancy"
              fill="#10b981"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
