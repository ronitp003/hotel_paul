"use client";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from "@/components/ui/chart";
import type { ForecastDay } from "@/features/dashboard/schemas";
import { CalendarIcon, RoomIcon } from "@/lib/icons";
import { cn } from "@/lib/utils";

interface ForecastChartProps {
  data: ForecastDay[];
  className?: string;
}

const chartConfig = {
  booked: {
    label: "Booked",
    color: "#2563eb",
  },
  maintenance: {
    label: "Maintenance",
    color: "#7e22ce",
  },
  available: {
    label: "Available",
    color: "#10b981",
  },
} satisfies ChartConfig;

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
    <div className="rounded-xl border border-border/80 bg-popover/95 backdrop-blur-md p-3.5 shadow-xl text-xs space-y-2 min-w-[210px] select-none">
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
            <span className="size-2.5 rounded-xs bg-blue-600 inline-block" />
            Booked / Occupied:
          </span>
          <span className="font-bold text-foreground">{booked} rooms</span>
        </div>

        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <span className="size-2.5 rounded-xs bg-purple-600 inline-block" />
            Under Maintenance:
          </span>
          <span className="font-bold text-foreground">{maintenance} rooms</span>
        </div>

        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <span className="size-2.5 rounded-xs bg-emerald-500 inline-block" />
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

export function ForecastChart({ data, className }: ForecastChartProps) {
  const avgOccupancy =
    data.length > 0
      ? Math.round(
          data.reduce((acc, d) => acc + d.occupancyPercent, 0) / data.length
        )
      : 0;

  return (
    <Card className={cn("p-4 sm:p-5 flex flex-col justify-between shadow-xs border-border/80", className)}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/50 pb-3 shrink-0">
        <div>
          <h3 className="text-base font-bold text-foreground flex items-center gap-2">
            <CalendarIcon className="size-4 text-primary" />
            7-Day Room Occupancy Forecast
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Projected room bookings, scheduled maintenance, and unsold availability.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
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
            className="bg-primary/10 text-primary border-primary/20 text-xs px-2 py-0.5 font-semibold"
          >
            <RoomIcon className="size-3 mr-1" />
            {data[0]?.totalRooms || 0} Rooms
          </Badge>
        </div>
      </div>

      <div className="flex-1 min-h-[220px] sm:min-h-[250px] w-full pt-2">
        <ChartContainer config={chartConfig} className="h-full w-full">
          <BarChart
            data={data}
            margin={{ top: 8, right: 10, left: -22, bottom: 0 }}
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
            <ChartTooltip content={<CustomTooltip />} />
            <ChartLegend
              content={<ChartLegendContent />}
              verticalAlign="top"
              align="right"
              wrapperStyle={{ paddingBottom: "8px", fontSize: "11px" }}
            />
            <Bar
              dataKey="booked"
              name="booked"
              stackId="occupancy"
              fill="var(--color-booked)"
              radius={[0, 0, 0, 0]}
            />
            <Bar
              dataKey="maintenance"
              name="maintenance"
              stackId="occupancy"
              fill="var(--color-maintenance)"
              radius={[0, 0, 0, 0]}
            />
            <Bar
              dataKey="available"
              name="available"
              stackId="occupancy"
              fill="var(--color-available)"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ChartContainer>
      </div>
    </Card>
  );
}
