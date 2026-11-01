"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Cell,
} from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  AnalyticsData,
  AnalyticsDailyCheckIn,
  AnalyticsOccupancyDay,
  CheckInTimeSlot,
  PaymentCollectionItem,
} from "@/features/register/schemas";
import {
  RoomIcon,
  SpinnerIcon,
  ArrowUpIcon,
  ClockIcon,
} from "@/lib/icons";

interface AnalyticsTabProps {
  initialData: AnalyticsData;
}

type RangeOption = "7d" | "14d" | "30d" | "month";

function formatRupee(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function getBarConfig(itemCount: number) {
  if (itemCount <= 7) {
    return {
      maxBarSize: 52,
      barCategoryGap: "20%",
      tickInterval: 0,
    };
  }
  if (itemCount <= 14) {
    return {
      maxBarSize: 28,
      barCategoryGap: "16%",
      tickInterval: 1,
    };
  }
  return {
    maxBarSize: 14,
    barCategoryGap: "10%",
    tickInterval: 3,
  };
}

const checkInChartConfig = {
  checkIns: {
    label: "Check-ins",
    color: "#0d9488", // teal-600
  },
} satisfies ChartConfig;

const occupancyChartConfig = {
  occupancyPercent: {
    label: "Occupancy %",
    color: "#8b5cf6", // violet-500
  },
} satisfies ChartConfig;

const paymentChartConfig = {
  netCollections: {
    label: "Net Collections",
    color: "#0d9488", // teal-600
  },
} satisfies ChartConfig;

const timeDistributionChartConfig = {
  count: {
    label: "Check-ins",
    color: "#0d9488",
  },
} satisfies ChartConfig;

const TIME_SLOT_COLORS: Record<string, string> = {
  MORNING: "#f59e0b", // Amber
  AFTERNOON: "#0d9488", // Teal
  EVENING: "#3b82f6", // Blue
  NIGHT: "#6366f1", // Indigo
};

export function AnalyticsTab({ initialData }: AnalyticsTabProps) {
  const [data, setData] = useState<AnalyticsData>(initialData);
  const [range, setRange] = useState<RangeOption>(initialData.range);
  const [isPending, startTransition] = useTransition();

  const handleRangeChange = (newRange: RangeOption) => {
    setRange(newRange);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/analytics?range=${newRange}`);
        if (!res.ok) throw new Error("Failed to fetch analytics");
        const json = await res.json();
        if (json.ok && json.data) {
          setData(json.data);
        }
      } catch (err) {
        console.error("Error loading analytics:", err);
      }
    });
  };

  const { summary, paymentCollections, checkInTimeDistribution } = data;
  const paymentDailyData = paymentCollections.daily;

  // Dynamic bar sizing and spacing based on data points
  const checkInBarConfig = getBarConfig(data.dailyCheckIns.length);
  const paymentBarConfig = getBarConfig(paymentDailyData.length);

  return (
    <div className="flex flex-col gap-2.5 sm:gap-3 w-full lg:h-[calc(100dvh-7.5rem)] lg:min-h-[500px]">
      {/* ── A. Header: Title, Subtitle, Date Range & Period Controls ── */}
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 shrink-0">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5">
            <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
              Analytics
            </h1>
            <span className="text-xs text-muted-foreground border-l border-border pl-2.5">
              Period: <span className="font-medium text-foreground">{data.startDate}</span> –{" "}
              <span className="font-medium text-foreground">{data.endDate}</span>
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
            Key operational metrics on guest check-in volume, property occupancy, and revenue trends.
          </p>
        </div>

        {/* Date-range filters */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="inline-flex items-center rounded-lg border bg-card p-0.5 shadow-2xs">
            {(["7d", "14d", "30d", "month"] as const).map((r) => {
              const labels: Record<RangeOption, string> = {
                "7d": "Last 7 Days",
                "14d": "Last 14 Days",
                "30d": "Last 30 Days",
                month: "This Month",
              };
              return (
                <Button
                  key={r}
                  variant={range === r ? "default" : "ghost"}
                  size="sm"
                  onClick={() => handleRangeChange(r)}
                  className="h-7 px-2.5 text-xs font-medium"
                >
                  {labels[r]}
                </Button>
              );
            })}
          </div>

          {isPending && (
            <div className="flex items-center text-xs text-muted-foreground">
              <SpinnerIcon className="size-3.5 animate-spin text-primary" />
            </div>
          )}
        </div>
      </header>

      {/* ── B. KPI Section: Horizontal Row with 3 Cards ── */}
      <section
        aria-label="Key Performance Indicators"
        className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3 shrink-0"
      >
        {/* KPI 1: Total Check-ins */}
        <div className="rounded-xl border bg-card p-3 shadow-2xs flex items-center justify-between">
          <div className="min-w-0">
            <span className="text-xs font-medium text-muted-foreground">Total Check-ins</span>
            <div className="text-2xl font-bold tracking-tight text-foreground mt-0.5">
              {summary.totalCheckIns}
            </div>
            <div className="text-[11px] text-muted-foreground truncate">
              Total check-in bookings in period
            </div>
          </div>
          <div className="rounded-lg bg-teal-500/10 p-2 text-teal-600 shrink-0">
            <ClockIcon className="size-4" />
          </div>
        </div>

        {/* KPI 2: Daily Average */}
        <div className="rounded-xl border bg-card p-3 shadow-2xs flex items-center justify-between">
          <div className="min-w-0">
            <span className="text-xs font-medium text-muted-foreground">Daily Average</span>
            <div className="text-2xl font-bold tracking-tight text-foreground mt-0.5">
              {summary.avgDailyCheckIns}
            </div>
            <div className="text-[11px] text-muted-foreground truncate">
              Average check-ins per day
            </div>
          </div>
          <div className="rounded-lg bg-emerald-500/10 p-2 text-emerald-600 shrink-0">
            <ArrowUpIcon className="size-4" />
          </div>
        </div>

        {/* KPI 3: Average Occupancy */}
        <div className="rounded-xl border bg-card p-3 shadow-2xs flex items-center justify-between">
          <div className="min-w-0">
            <span className="text-xs font-medium text-muted-foreground">Average Occupancy</span>
            <div className="text-2xl font-bold tracking-tight text-foreground mt-0.5">
              {summary.occupancyRate}%
            </div>
            <div className="text-[11px] text-muted-foreground truncate">
              Average Room occupancy
            </div>
          </div>
          <div className="rounded-lg bg-purple-500/10 p-2 text-purple-600 shrink-0">
            <RoomIcon className="size-4" />
          </div>
        </div>
      </section>

      {/* ── C. Analytics Charts: 2 × 2 Grid ── */}
      <section
        aria-label="Analytics Charts"
        className="grid grid-cols-1 lg:grid-cols-2 lg:grid-rows-2 gap-2.5 sm:gap-3 flex-1 min-h-0 w-full"
      >
        {/* Chart 1: Daily Check-in Volume (Top-Left) */}
        <div className="rounded-xl border bg-card p-3 shadow-2xs flex flex-col min-h-[220px] lg:min-h-0 h-full">
          <div className="flex items-center justify-between pb-1 shrink-0">
            <div>
              <h2 className="text-xs font-semibold text-foreground">
                Daily Check-in Volume
              </h2>
              <p className="text-[11px] text-muted-foreground">
                Number of arrival check-in bookings per day
              </p>
            </div>
          </div>
          <div className="flex-1 min-h-0 w-full pt-1">
            <ChartContainer config={checkInChartConfig} className="h-full w-full aspect-auto">
              <BarChart
                data={data.dailyCheckIns}
                margin={{ top: 8, right: 8, left: -22, bottom: 0 }}
                barCategoryGap={checkInBarConfig.barCategoryGap}
              >
                <CartesianGrid vertical={false} strokeDasharray="3 3" opacity={0.3} />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={6}
                  fontSize={10}
                  interval={checkInBarConfig.tickInterval}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tickMargin={6}
                  fontSize={10}
                  allowDecimals={false}
                />
                <ChartTooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const item = payload[0].payload as AnalyticsDailyCheckIn;
                    return (
                      <div className="rounded-lg border bg-popover p-2 text-xs shadow-md">
                        <div className="font-semibold text-foreground">
                          {item.label} ({item.dayOfWeek})
                        </div>
                        <div className="mt-1 flex items-center justify-between gap-3 text-muted-foreground">
                          <span>Check-ins:</span>
                          <span className="font-bold text-foreground">
                            {item.checkIns} {item.checkIns === 1 ? "arrival" : "arrivals"}
                          </span>
                        </div>
                      </div>
                    );
                  }}
                />
                <Bar
                  dataKey="checkIns"
                  fill="var(--color-checkIns)"
                  radius={[3, 3, 0, 0]}
                  maxBarSize={checkInBarConfig.maxBarSize}
                />
              </BarChart>
            </ChartContainer>
          </div>
        </div>

        {/* Chart 2: Room Occupancy Rate (%) (Top-Right) */}
        <div className="rounded-xl border bg-card p-3 shadow-2xs flex flex-col min-h-[220px] lg:min-h-0 h-full">
          <div className="flex items-center justify-between pb-1 shrink-0">
            <div>
              <h2 className="text-xs font-semibold text-foreground">
                Room Occupancy Rate (%)
              </h2>
              <p className="text-[11px] text-muted-foreground">
                Daily occupied rooms relative to total capacity
              </p>
            </div>
          </div>
          <div className="flex-1 min-h-0 w-full pt-1">
            <ChartContainer config={occupancyChartConfig} className="h-full w-full aspect-auto">
              <AreaChart
                data={data.occupancyTrend}
                margin={{ top: 8, right: 8, left: -18, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="fillOccupancyCompact" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} strokeDasharray="3 3" opacity={0.3} />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={6}
                  fontSize={10}
                  interval={data.occupancyTrend.length > 20 ? 3 : data.occupancyTrend.length > 10 ? 1 : 0}
                />
                <YAxis
                  domain={[0, 100]}
                  tickLine={false}
                  axisLine={false}
                  tickMargin={6}
                  fontSize={10}
                  unit="%"
                />
                <ChartTooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const item = payload[0].payload as AnalyticsOccupancyDay;
                    return (
                      <div className="rounded-lg border bg-popover p-2 text-xs shadow-md">
                        <div className="font-semibold text-foreground">
                          {item.label}
                        </div>
                        <div className="mt-1 flex items-center justify-between gap-3 text-muted-foreground">
                          <span>Occupancy Rate:</span>
                          <span className="font-bold text-foreground">
                            {item.occupancyPercent}%
                          </span>
                        </div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">
                          {item.occupiedRooms} of {item.totalRooms} rooms occupied
                        </div>
                      </div>
                    );
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="occupancyPercent"
                  stroke="#8b5cf6"
                  strokeWidth={2}
                  fill="url(#fillOccupancyCompact)"
                />
              </AreaChart>
            </ChartContainer>
          </div>
        </div>

        {/* Chart 3: Check-in Time Distribution (Bottom-Left) */}
        <div className="rounded-xl border bg-card p-3 shadow-2xs flex flex-col min-h-[220px] lg:min-h-0 h-full">
          <div className="flex items-center justify-between pb-1 shrink-0">
            <div>
              <h2 className="text-xs font-semibold text-foreground">
                Check-in Time Distribution
              </h2>
              <p className="text-[11px] text-muted-foreground">
                Guest arrival patterns by time of day
              </p>
            </div>
            {/* Compact category legend */}
            <div className="hidden sm:flex items-center gap-2 text-[10px] text-muted-foreground">
              {checkInTimeDistribution.map((slot) => (
                <div key={slot.slot} className="flex items-center gap-1">
                  <span
                    className="size-1.5 rounded-full shrink-0"
                    style={{ backgroundColor: TIME_SLOT_COLORS[slot.slot] || "#0d9488" }}
                  />
                  <span>{slot.label}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="flex-1 min-h-0 w-full pt-1">
            {summary.totalCheckIns === 0 ? (
              <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                No check-ins recorded for this period
              </div>
            ) : (
              <ChartContainer config={timeDistributionChartConfig} className="h-full w-full aspect-auto">
                <BarChart
                  layout="vertical"
                  data={checkInTimeDistribution}
                  margin={{ top: 8, right: 16, left: 4, bottom: 4 }}
                  barCategoryGap="20%"
                >
                  <CartesianGrid horizontal={false} vertical strokeDasharray="3 3" opacity={0.3} />
                  <XAxis
                    type="number"
                    allowDecimals={false}
                    tickLine={false}
                    axisLine={false}
                    tickMargin={4}
                    fontSize={10}
                  />
                  <YAxis
                    type="category"
                    dataKey="label"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={6}
                    fontSize={11}
                    width={72}
                  />
                  <ChartTooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const item = payload[0].payload as CheckInTimeSlot;
                      return (
                        <div className="rounded-lg border bg-popover p-2 text-xs shadow-md">
                          <div className="font-semibold text-foreground">
                            {item.label} ({item.timeRange})
                          </div>
                          <div className="mt-1 flex items-center justify-between gap-3 text-muted-foreground">
                            <span>Arrivals:</span>
                            <span className="font-bold text-foreground">
                              {item.count} ({item.percentage}%)
                            </span>
                          </div>
                        </div>
                      );
                    }}
                  />
                  <Bar
                    dataKey="count"
                    radius={[0, 4, 4, 0]}
                    barSize={30}
                  >
                    {checkInTimeDistribution.map((entry) => (
                      <Cell
                        key={entry.slot}
                        fill={TIME_SLOT_COLORS[entry.slot] || "#0d9488"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ChartContainer>
            )}
          </div>
        </div>

        {/* Chart 4: Payment Collection Trends (Bottom-Right) */}
        <div className="rounded-xl border bg-card p-3 shadow-2xs flex flex-col min-h-[220px] lg:min-h-0 h-full">
          <div className="flex items-center justify-between pb-1 shrink-0">
            <div>
              <h2 className="text-xs font-semibold text-foreground">
                Payment Collection Trends
              </h2>
              <p className="text-[11px] text-muted-foreground">
                Actual completed payments minus refunds
              </p>
            </div>

            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-muted-foreground hidden sm:inline">Total:</span>
              <span className="font-semibold text-teal-700 dark:text-teal-300">
                {formatRupee(paymentCollections.totalNetCollections)}
              </span>
            </div>
          </div>
          <div className="flex-1 min-h-0 w-full pt-1">
            <ChartContainer config={paymentChartConfig} className="h-full w-full aspect-auto">
              <BarChart
                data={paymentDailyData}
                margin={{ top: 8, right: 8, left: -10, bottom: 0 }}
                barCategoryGap={paymentBarConfig.barCategoryGap}
              >
                <CartesianGrid vertical={false} strokeDasharray="3 3" opacity={0.3} />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={6}
                  fontSize={10}
                  interval={paymentBarConfig.tickInterval}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tickMargin={6}
                  fontSize={10}
                  tickFormatter={(val) => `₹${val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}`}
                />
                <ChartTooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const item = payload[0].payload as PaymentCollectionItem;
                    return (
                      <div className="rounded-lg border bg-popover p-2 text-xs shadow-md space-y-1 min-w-[170px]">
                        <div className="font-semibold text-foreground border-b border-border pb-1">
                          {item.label}
                        </div>
                        <div className="flex items-center justify-between text-muted-foreground text-[11px]">
                          <span>Gross:</span>
                          <span className="font-medium text-foreground">
                            {formatRupee(item.grossPayments)}
                          </span>
                        </div>
                        {item.refunds > 0 && (
                          <div className="flex items-center justify-between text-rose-600 dark:text-rose-400 text-[11px]">
                            <span>Refunds:</span>
                            <span className="font-medium">
                              -{formatRupee(item.refunds)}
                            </span>
                          </div>
                        )}
                        <div className="flex items-center justify-between font-bold text-teal-700 dark:text-teal-300 pt-0.5 border-t border-border text-[11px]">
                          <span>Net Collections:</span>
                          <span>{formatRupee(item.netCollections)}</span>
                        </div>
                      </div>
                    );
                  }}
                />
                <Bar
                  dataKey="netCollections"
                  fill="var(--color-netCollections)"
                  radius={[3, 3, 0, 0]}
                  maxBarSize={paymentBarConfig.maxBarSize}
                />
              </BarChart>
            </ChartContainer>
          </div>
        </div>
      </section>
    </div>
  );
}
